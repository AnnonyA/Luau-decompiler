import type { Block, Chunk, Expression, Literal, Statement, TableField } from "../ast/Ast.js";
import { isValidIdentifier } from "../reconstruct/Naming.js";
import { escapedByte } from "../decode/BytecodeString.js";
import { formatInteger, formatNumber } from "../decode/Constant.js";
import { analyzePrinterBindings, type PrintedFunction, type PrinterBindings } from "./PrinterBindings.js";
import { analyzeCallBoundaries, type CallBoundaryPresentation } from "./CallBoundaries.js";

const PREC: Record<string, number> = {
  or: 1,
  and: 2,
  "==": 3,
  "~=": 3,
  "<": 3,
  "<=": 3,
  ">": 3,
  ">=": 3,
  "..": 4,
  "+": 5,
  "-": 5,
  "*": 6,
  "/": 6,
  "//": 6,
  "%": 6,
  unary: 7,
  "^": 8,
};

export interface PrintOptions {
  indent?: "tab" | 2 | 4;
  unicodeStrings?: boolean;
  upvalueComments?: boolean;
  functionLineComments?: boolean;
  preferConst?: boolean;
}

export function printLuau(ast: Chunk, options: PrintOptions = {}): string {
  const bindings = analyzePrinterBindings(ast.body, options.preferConst ?? false, options.upvalueComments ?? false);
  const printer = new Printer(options, bindings, analyzeCallBoundaries(ast.body));
  printer.printBlock(ast.body, false);
  return printer.finish();
}

class Printer {
  private readonly lines: string[] = [];
  private indentLevel = 0;
  private exprDepth = 0;
  private pendingBlank = false;
  private readonly unit: string;

  constructor(private readonly options: PrintOptions, private readonly bindings: PrinterBindings,
    private readonly callBoundaries: CallBoundaryPresentation) {
    const indent = options.indent ?? 4;
    this.unit = indent === "tab" ? "\t" : " ".repeat(indent);
  }

  finish(): string {
    while (this.lines.length > 0 && this.lines[this.lines.length - 1] === "") {
      this.lines.pop();
    }
    return `${this.lines.join("\n")}\n`;
  }

  printBlock(body: Block, wrap: boolean): void {
    if (wrap) {
      this.indentLevel += 1;
    }
    let previous:Statement|undefined;
    for (const statement of body.statements) {
      if (this.indentLevel === 0 && previous && topLevelBoundary(previous,statement)) this.pendingBlank = true;
      this.printStatement(statement, previous !== undefined);
      previous=statement;
    }
    if (wrap) {
      this.indentLevel -= 1;
    }
  }

  private write(text: string, followsStatement = false): void {
    // A newline before '(' can continue the preceding call or initializer.
    if (followsStatement && text.startsWith("(")) this.lines[this.lines.length - 1] += ";";
    if (this.pendingBlank && this.lines.length > 0 && this.lines[this.lines.length - 1] !== "") {
      this.lines.push("");
    }
    this.pendingBlank = false;
    this.lines.push(`${this.unit.repeat(this.indentLevel)}${text}`);
  }

  private printStatement(statement: Statement, followsStatement: boolean): void {
    switch (statement.kind) {
      case "local": {
        const names = formatTypedNames(statement.names, statement.types);
        const keyword = this.bindings.constants.has(statement) ? "const" : "local";
        if (statement.values.length === 0) {
          this.write(`${keyword} ${names}`);
        } else {
          this.write(`${keyword} ${names} = ${this.expressionList(statement.values, statement.names.length === statement.values.length)}`);
        }
        break;
      }
      case "assign":
        // Named function assignment writes the same existing cell. Keep the
        // forward local: converting this into `local function` can replace a
        // REF cell already captured by another closure.
        if (statement.targets.length === 1 && statement.values.length === 1 &&
            statement.targets[0]!.kind === "identifier" && statement.values[0]!.kind === "function-expr" &&
            statement.values[0]!.debugName === statement.targets[0]!.name) {
          this.namedFunction(statement.values[0]!, statement.targets[0]!.name, false);
          break;
        }
        this.write(
          `${statement.targets.map((target) => this.expr(target)).join(", ")} = ${this.expressionList(
            statement.values, statement.targets.length === statement.values.length)}`,
          followsStatement,
        );
        if (statement.values.some(value => value.kind === "function-expr")) this.pendingBlank = true;
        break;
      case "compound-assign":
        this.write(`${this.expr(statement.target)} ${statement.op}= ${this.scalarExpression(statement.value)}`, followsStatement);
        break;
      case "function-decl": {
        this.namedFunction(statement, statement.name, statement.local);
        break;
      }
      case "if": {
        this.write(`if ${this.scalarExpression(statement.test)} then`);
        this.printBlock(statement.consequent, true);
        for (const branch of statement.branches) {
          this.write(`elseif ${this.scalarExpression(branch.test)} then`);
          this.printBlock(branch.body, true);
        }
        if (statement.alternate) {
          this.write("else");
          this.printBlock(statement.alternate, true);
        }
        this.write("end");
        break;
      }
      case "while":
        this.write(`while ${this.scalarExpression(statement.test)} do`);
        this.printBlock(statement.body, true);
        this.write("end");
        break;
      case "repeat":
        this.write("repeat");
        this.printBlock(statement.body, true);
        this.write(`until ${this.scalarExpression(statement.test)}`);
        break;
      case "numeric-for": {
        const step = statement.step ? `, ${this.scalarExpression(statement.step)}` : "";
        this.write(`for ${statement.name} = ${this.scalarExpression(statement.start)}, ${this.scalarExpression(statement.stop)}${step} do`);
        this.printBlock(statement.body, true);
        this.write("end");
        break;
      }
      case "generic-for":
        this.write(`for ${statement.names.join(", ")} in ${this.expressionList(statement.iterators)} do`);
        this.printBlock(statement.body, true);
        this.write("end");
        break;
      case "return":
        this.write(statement.values.length === 0 ? "return" : `return ${this.expressionList(statement.values)}`);
        break;
      case "break":
        this.write("break");
        break;
      case "continue":
        this.write("continue");
        break;
      case "expression-stmt":
        this.write(this.expr(statement.expression), followsStatement);
        break;
      case "do":
        this.write("do");
        this.printBlock(statement.body, true);
        this.write("end");
        break;
    }
  }

  /** An enclosing single-value context already adjusts calls and varargs.
   * Keep the AST's adjustment and every callee group intact; omit only the
   * redundant outer spelling. Other parentheses may encode precedence or
   * function naming and are never removed here. */
  private scalarExpression(expression: Expression, parent = 0, right = false): string {
    let inner = expression;
    while (inner.kind === "paren") inner = inner.expression;
    return this.expr(inner.kind === "call" || inner.kind === "method-call" || inner.kind === "vararg"
      ? inner : expression, parent, right);
  }

  private expressionList(values: readonly Expression[], scalarTail = false): string {
    return values.map((value, index) => scalarTail || index + 1 < values.length
      ? this.scalarExpression(value) : this.expr(value)).join(", ");
  }

  private expr(expression: Expression, parent = 0, right = false): string {
    switch (expression.kind) {
      case "identifier":
        return expression.name;
      case "literal": {
        const text = literalToSource(expression.value, this.options.unicodeStrings ?? true);
        // Negative numeric literals parse as unary minus, below exponentiation.
        // Preserve the base in (-2)^n and (-0)^n, including integer literals.
        return text.startsWith("-") && parent > (PREC.unary ?? 7) ? `(${text})` : text;
      }
      case "vararg":
        return "...";
      case "unary": {
        const prec = PREC.unary ?? 7;
        const arg = this.scalarExpression(expression.argument, prec);
        // Two adjacent minus signs form a Luau line comment, not two unary
        // negations. This also applies to negative numeric literals (-(-4)).
        const safeArg = expression.op === "-" && arg.startsWith("-") ? `(${arg})` : arg;
        const space = expression.op === "not" ? " " : "";
        const text = `${expression.op}${space}${safeArg}`;
        return prec < parent ? `(${text})` : text;
      }
      case "binary": {
        const prec = PREC[expression.op] ?? 0;
        const assocRight = expression.op === "^" || expression.op === "..";
        const left = this.scalarExpression(expression.left, prec, false);
        const rightText = this.scalarExpression(expression.right, prec, true);
        const text = `${left} ${expression.op} ${rightText}`;
        if (prec < parent || (prec === parent && right !== assocRight)) {
          return `(${text})`;
        }
        return text;
      }
      case "call": {
        // Official Luau 9d7748a4 / c87565b8 Compiler.cpp getFunctionExpr
        // and Builtins.cpp getBuiltin do not follow binary expressions. The
        // true left operand keeps the original CALL boundary while evaluating
        // the callee exactly once, before its arguments, and adjusting it to
        // one value. Unlike a truthiness test of the callee, this also keeps
        // false/nil callees and their error behavior unchanged.
        const callee = expression.preserveBoundary && !expression.inlineForIdentity && !this.callBoundaries.direct.has(expression)
          ? this.callBoundaries.grouped.has(expression)
            ? expression.callee.kind === "paren" ? this.expr(expression.callee) : `(${this.expr(expression.callee)})`
            : `(true and ${this.expr(expression.callee, PREC.and, true)})`
          : this.callCallee(expression.callee);
        const call = `${callee}(${this.expressionList(expression.args)})`;
        return expression.inlineForIdentity ? `(${call})` : call;
      }
      case "method-call":
        return `${this.memberObject(expression.object)}:${expression.name}(${this.expressionList(expression.args)})`;
      case "index":
        return `${this.memberObject(expression.table)}[${this.scalarExpression(expression.key)}]`;
      case "property":
        return isValidIdentifier(expression.name)
          ? `${this.memberObject(expression.object)}.${expression.name}`
          : `${this.memberObject(expression.object)}[${quote(expression.name, this.options.unicodeStrings ?? true)}]`;
      case "table":
        return this.table(expression.fields);
      case "function-expr": {
        const text = `function(${formatParams(expression.params, expression.isVararg, expression.paramTypes)})${
          expression.returnType ? `: ${expression.returnType}` : ""
        }\n${this.nested(expression)}end`;
        return parent > 0 ? `(${text})` : text;
      }
      case "if-expr": {
        const branches = expression.branches
          .map((branch) => ` elseif ${this.scalarExpression(branch.test)} then ${this.scalarExpression(branch.value)}`)
          .join("");
        const text = `if ${this.scalarExpression(expression.test)} then ${this.scalarExpression(expression.consequent)}${branches} else ${this.scalarExpression(expression.alternate)}`;
        // A conditional expression has lower precedence than operators. It
        // must be grouped when the recovered AST uses it as an operand.
        return parent > 0 ? `(${text})` : text;
      }
      case "interp":
        return `\`${expression.parts.map((part) => this.interpPart(part)).join("")}\``;
      case "paren":
        return `(${this.expr(expression.expression)})`;
    }
  }

  private callCallee(expression: Expression): string {
    if (
      expression.kind === "identifier" ||
      expression.kind === "property" ||
      expression.kind === "index" ||
      expression.kind === "call" ||
      expression.kind === "method-call" ||
      expression.kind === "paren"
    ) {
      return this.expr(expression);
    }
    return `(${this.expr(expression)})`;
  }

  private memberObject(expression: Expression): string {
    if (
      expression.kind === "identifier" ||
      expression.kind === "property" ||
      expression.kind === "index" ||
      expression.kind === "call" ||
      expression.kind === "method-call" ||
      expression.kind === "paren"
    ) {
      return this.expr(expression);
    }
    // Luau requires a parenthesized primary expression as the receiver for
    // indexing and colon calls. A string/number literal cannot be followed
    // directly by ':method', '.field', or '[key]'.
    return `(${this.expr(expression)})`;
  }

  private interpPart(part: { kind: "text" | "expr"; value: string | Expression }): string {
    if (part.kind === "text") {
      return escapeInterp(String(part.value), this.options.unicodeStrings ?? true);
    }
    return `{${this.scalarExpression(part.value as Expression)}}`;
  }

  private table(fields: TableField[]): string {
    if (fields.length === 0) {
      return "{}";
    }
    this.exprDepth += 1;
    const parts = fields.map((field, index) => {
      if (field.name) {
        const keepsFunctionName = field.value.kind !== "function-expr" || field.value.debugName === field.name;
        const key = isValidIdentifier(field.name) && keepsFunctionName
          ? field.name : `[${quote(field.name, this.options.unicodeStrings ?? true)}]`;
        return `${key} = ${this.scalarExpression(field.value)}`;
      }
      if (field.key) {
        // The record spelling keeps the same constant string key. A direct
        // function literal is special: the parser assigns it the field name,
        // which is observable through debug.info, so retain its proven name.
        if (field.key.kind === "literal" && typeof field.key.value === "string" &&
            isValidIdentifier(field.key.value) &&
            (field.value.kind !== "function-expr" || field.value.debugName === field.key.value)) {
          return `${field.key.value} = ${this.scalarExpression(field.value)}`;
        }
        return `[${this.scalarExpression(field.key)}] = ${this.scalarExpression(field.value)}`;
      }
      return index + 1 < fields.length ? this.scalarExpression(field.value) : this.expr(field.value);
    });
    this.exprDepth -= 1;
    const nestedRecord = this.exprDepth > 0 && fields.length >= 3 && fields.every(field=>field.name || field.key);
    if (nestedRecord || parts.some(part=>part.includes("\n")) || parts.join(", ").length > 80) {
      const inner = parts.map((part) => `${this.unit.repeat(this.indentLevel + this.exprDepth + 1)}${part},`).join("\n");
      return `{\n${inner}\n${this.unit.repeat(this.indentLevel + this.exprDepth)}}`;
    }
    return `{ ${parts.join(", ")} }`;
  }

  private namedFunction(fn: PrintedFunction, name: string, local: boolean): void {
    this.write(`${local ? "local function " : "function "}${name}(${formatParams(fn.params, fn.isVararg, fn.paramTypes)})${
      fn.returnType ? `: ${fn.returnType}` : ""}`);
    this.indentLevel += 1;
    this.functionComments(fn);
    this.printBlock(fn.body, false);
    this.indentLevel -= 1;
    this.write("end");
    this.pendingBlank = true;
  }

  private functionComments(fn: PrintedFunction): void {
    if (this.options.functionLineComments && Number.isSafeInteger(fn.line) && fn.line! > 0) {
      this.write(`-- Line: ${fn.line}`);
    }
    const captures = this.bindings.captures.get(fn);
    if (this.options.upvalueComments && captures?.size) {
      const names = [...captures].map(name => name.replace(/[\x00-\x1f\x7f-\x9f\u2028\u2029]/g, " "));
      this.write(`-- Upvalues: ${names.join(", ")}`);
    }
  }

  private nested(fn: PrintedFunction): string {
    const nested = new Printer(this.options, this.bindings, this.callBoundaries);
    nested.indentLevel = this.indentLevel + 1;
    nested.functionComments(fn);
    nested.printBlock(fn.body, false);
    return nested.lines.length === 0 ? "" : `${nested.lines.join("\n")}\n${this.unit.repeat(this.indentLevel)}`;
  }
}

/** Whitespace groups existing statements; it never sorts declarations or moves
 * initialization. Keep a forward local next to its function assignment. */
function topLevelBoundary(previous:Statement,current:Statement):boolean {
  const section=(statement:Statement):string|undefined=>{
    if(statement.kind!=='local' || statement.values.length!==1)return;
    const value=statement.values[0]!;
    if(value.kind==='call' && value.callee.kind==='identifier' && value.callee.name==='require')return 'imports';
    if(value.kind==='method-call' && value.name==='GetService')return 'services';
    if(value.kind==='table' && value.fields.some(field=>field.value.kind==='table'))return 'records';
  };
  const before=section(previous),after=section(current);
  if(before!==after && (before || after))return true;
  const fn=current.kind==='function-decl' ? current.name : current.kind==='assign' &&
    current.targets.length===1 && current.targets[0]!.kind==='identifier' &&
    current.values.length===1 && current.values[0]!.kind==='function-expr' ? current.targets[0]!.name : undefined;
  return !!fn && !(previous.kind==='local' && previous.values.every(value=>value.kind==='literal' && value.value===null) && previous.names.includes(fn));
}

function formatTypedNames(names: string[], types?: Array<string | undefined>): string {
  return names
    .map((name, index) => {
      const type = types?.[index];
      return type ? `${name}: ${type}` : name;
    })
    .join(", ");
}

function formatParams(params: string[], isVararg: boolean, types?: Array<string | undefined>): string {
  const list = params.map((name, index) => {
    const type = types?.[index];
    return type ? `${name}: ${type}` : name;
  });
  if (isVararg) {
    list.push("...");
  }
  return list.join(", ");
}

function escapeInterp(value: string, unicodeStrings: boolean): string {
  const escaped = value.replace(/[\\`{\x00-\x1f\udc80-\udcff]/gu, (char) => {
    switch (char) {
      case "\n": return "\\n";
      case "\r": return "\\r";
      case "\t": return "\\t";
      case "\\": return "\\\\";
      case "`": return "\\`";
      case "{": return "\\{";
      // Three digits prevent a following decimal digit joining the escape.
      default: return `\\${(escapedByte(char) ?? char.charCodeAt(0)).toString().padStart(3, "0")}`;
    }
  });
  return unicodeStrings ? escaped : escapeUnicode(escaped);
}

function literalToSource(value: Literal["value"], unicodeStrings: boolean): string {
  if (value === null) {
    return "nil";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    return formatNumber(value);
  }
  if (typeof value === "bigint") {
    return formatInteger(value);
  }
  return quote(value, unicodeStrings);
}

function quote(value: string, unicodeStrings: boolean): string {
  let out = '"';
  for (const char of value) {
    switch (char) {
      case "\\":
        out += "\\\\";
        break;
      case '"':
        out += '\\"';
        break;
      case "\n":
        out += "\\n";
        break;
      case "\r":
        out += "\\r";
        break;
      case "\t":
        out += "\\t";
        break;
      case "\0":
        out += "\\000";
        break;
      default: {
        const code = char.charCodeAt(0);
        const raw = escapedByte(char);
        out += raw !== undefined || code < 32 ? `\\${(raw ?? code).toString().padStart(3, "0")}` : char;
      }
    }
  }
  return `${unicodeStrings ? out : escapeUnicode(out)}"`;
}

function escapeUnicode(value: string): string {
  const encoder = new TextEncoder();
  return value.replace(/[^\x00-\x7f]/gu, character =>
    [...encoder.encode(character)].map(byte => `\\${byte.toString().padStart(3, "0")}`).join(""));
}

export function hasArtificialComments(source: string): boolean {
  // Ignore '--' inside emitted quoted and interpolated string literals.
  // Run this diagnostic on output with optional annotations disabled: a bare
  // '--' outside literals is the pattern that should trigger it.
  type Frame = { kind: "code"; braces: number } | { kind: "quoted"; quote: string } | { kind: "interpolated" };
  const frames: Frame[] = [{ kind: "code", braces: 0 }];
  for (let i = 0; i < source.length; i++) {
    const char = source[i]!;
    const frame = frames.at(-1)!;
    if (frame.kind === "quoted") {
      if (char === "\\") i++;
      else if (char === frame.quote) frames.pop();
      continue;
    }
    if (frame.kind === "interpolated") {
      if (char === "\\") {
        // A Unicode escape's braces are literal text, not an interpolation.
        if (source[i + 1] === "u" && source[i + 2] === "{") {
          const end = source.indexOf("}", i + 3);
          i = end < 0 ? source.length : end;
        } else i++;
      } else if (char === "`") frames.pop();
      else if (char === "{") frames.push({ kind: "code", braces: 1 });
      continue;
    }
    if (char === '"' || char === "'") {
      frames.push({ kind: "quoted", quote: char });
    } else if (char === "`") {
      frames.push({ kind: "interpolated" });
    } else if (char === "-" && source[i + 1] === "-") {
      return true;
    } else if (char === "{") {
      frame.braces++;
    } else if (char === "}" && frame.braces > 0) {
      frame.braces--;
      if (frame.braces === 0 && frames.length > 1) frames.pop();
    } else if (char === "[") {
      const opening = /^\[(=*)\[/.exec(source.slice(i));
      if (opening) {
        const closing = `]${opening[1]}]`;
        const end = source.indexOf(closing, i + opening[0].length);
        i = end < 0 ? source.length : end + closing.length - 1;
      }
    }
  }
  return false;
}
