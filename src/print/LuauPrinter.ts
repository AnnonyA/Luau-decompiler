import type { Block, Chunk, Expression, Literal, Statement, TableField } from "../ast/Ast.js";

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

export function printLuau(ast: Chunk): string {
  const printer = new Printer();
  printer.printBlock(ast.body, false);
  return printer.finish();
}

class Printer {
  private readonly lines: string[] = [];
  private indentLevel = 0;
  private pendingBlank = false;

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
    for (const statement of body.statements) {
      this.printStatement(statement);
    }
    if (wrap) {
      this.indentLevel -= 1;
    }
  }

  private write(text: string): void {
    if (this.pendingBlank && this.lines.length > 0 && this.lines[this.lines.length - 1] !== "") {
      this.lines.push("");
    }
    this.pendingBlank = false;
    this.lines.push(`${"    ".repeat(this.indentLevel)}${text}`);
  }

  private printStatement(statement: Statement): void {
    switch (statement.kind) {
      case "local": {
        const names = statement.names.join(", ");
        if (statement.values.length === 0) {
          this.write(`local ${names}`);
        } else {
          this.write(`local ${names} = ${statement.values.map((value) => this.expr(value)).join(", ")}`);
        }
        break;
      }
      case "assign":
        this.write(
          `${statement.targets.map((target) => this.expr(target)).join(", ")} = ${statement.values
            .map((value) => this.expr(value))
            .join(", ")}`,
        );
        break;
      case "function-decl": {
        const header = `${statement.local ? "local function " : "function "}${statement.name}(${formatParams(
          statement.params,
          statement.isVararg,
        )})`;
        this.write(header);
        this.printBlock(statement.body, true);
        this.write("end");
        this.pendingBlank = true;
        break;
      }
      case "if": {
        this.write(`if ${this.expr(statement.test)} then`);
        this.printBlock(statement.consequent, true);
        for (const branch of statement.branches) {
          this.write(`elseif ${this.expr(branch.test)} then`);
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
        this.write(`while ${this.expr(statement.test)} do`);
        this.printBlock(statement.body, true);
        this.write("end");
        break;
      case "repeat":
        this.write("repeat");
        this.printBlock(statement.body, true);
        this.write(`until ${this.expr(statement.test)}`);
        break;
      case "numeric-for": {
        const step = statement.step ? `, ${this.expr(statement.step)}` : "";
        this.write(`for ${statement.name} = ${this.expr(statement.start)}, ${this.expr(statement.stop)}${step} do`);
        this.printBlock(statement.body, true);
        this.write("end");
        break;
      }
      case "generic-for":
        this.write(`for ${statement.names.join(", ")} in ${statement.iterators.map((it) => this.expr(it)).join(", ")} do`);
        this.printBlock(statement.body, true);
        this.write("end");
        break;
      case "return":
        this.write(statement.values.length === 0 ? "return" : `return ${statement.values.map((value) => this.expr(value)).join(", ")}`);
        break;
      case "break":
        this.write("break");
        break;
      case "continue":
        this.write("continue");
        break;
      case "expression-stmt":
        this.write(this.expr(statement.expression));
        break;
      case "do":
        this.write("do");
        this.printBlock(statement.body, true);
        this.write("end");
        break;
    }
  }

  private expr(expression: Expression, parent = 0, right = false): string {
    switch (expression.kind) {
      case "identifier":
        return expression.name;
      case "literal":
        return literalToSource(expression.value);
      case "vararg":
        return "...";
      case "unary": {
        const prec = PREC.unary ?? 7;
        const arg = this.expr(expression.argument, prec);
        const space = expression.op === "not" ? " " : "";
        const text = `${expression.op}${space}${arg}`;
        return prec < parent ? `(${text})` : text;
      }
      case "binary": {
        const prec = PREC[expression.op] ?? 0;
        const assocRight = expression.op === "^" || expression.op === "..";
        const left = this.expr(expression.left, prec, false);
        const rightText = this.expr(expression.right, prec, true);
        const text = `${left} ${expression.op} ${rightText}`;
        if (prec < parent || (prec === parent && right !== assocRight)) {
          return `(${text})`;
        }
        return text;
      }
      case "call":
        return `${this.callCallee(expression.callee)}(${expression.args.map((arg) => this.expr(arg)).join(", ")})`;
      case "method-call":
        return `${this.memberObject(expression.object)}:${expression.name}(${expression.args.map((arg) => this.expr(arg)).join(", ")})`;
      case "index":
        return `${this.memberObject(expression.table)}[${this.expr(expression.key)}]`;
      case "property":
        return `${this.memberObject(expression.object)}.${expression.name}`;
      case "table":
        return this.table(expression.fields);
      case "function-expr":
        return `function(${formatParams(expression.params, expression.isVararg)})\n${this.nested(expression.body)}end`;
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
      expression.kind === "paren" ||
      expression.kind === "literal"
    ) {
      return this.expr(expression);
    }
    return `(${this.expr(expression)})`;
  }

  private table(fields: TableField[]): string {
    if (fields.length === 0) {
      return "{}";
    }
    const parts = fields.map((field) => {
      if (field.name) {
        return `${field.name} = ${this.expr(field.value)}`;
      }
      if (field.key) {
        return `[${this.expr(field.key)}] = ${this.expr(field.value)}`;
      }
      return this.expr(field.value);
    });
    if (parts.join(", ").length > 80) {
      const inner = parts.map((part) => `${"    ".repeat(this.indentLevel + 1)}${part},`).join("\n");
      return `{\n${inner}\n${"    ".repeat(this.indentLevel)}}`;
    }
    return `{ ${parts.join(", ")} }`;
  }

  private nested(body: Block): string {
    const nested = new Printer();
    nested.indentLevel = this.indentLevel + 1;
    nested.printBlock(body, false);
    return nested.lines.length === 0 ? "" : `${nested.lines.join("\n")}\n${"    ".repeat(this.indentLevel)}`;
  }
}

function formatParams(params: string[], isVararg: boolean): string {
  const list = [...params];
  if (isVararg) {
    list.push("...");
  }
  return list.join(", ");
}

function literalToSource(value: Literal["value"]): string {
  if (value === null) {
    return "nil";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    if (Number.isNaN(value)) {
      return "(0/0)";
    }
    if (!Number.isFinite(value)) {
      return value > 0 ? "(1/0)" : "(-1/0)";
    }
    if (Object.is(value, -0)) {
      return "-0";
    }
    return String(value);
  }
  if (typeof value === "bigint") {
    return value.toString();
  }
  return quote(value);
}

function quote(value: string): string {
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
        out += "\\0";
        break;
      default: {
        const code = char.charCodeAt(0);
        out += code < 32 ? `\\${code.toString().padStart(3, "0")}` : char;
      }
    }
  }
  return `${out}"`;
}

export function hasArtificialComments(source: string): boolean {
  for (const line of source.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("--")) {
      return true;
    }
    if (trimmed.includes("--") && !inString(trimmed)) {
      return true;
    }
  }
  return false;
}

function inString(_line: string): boolean {
  return false;
}
