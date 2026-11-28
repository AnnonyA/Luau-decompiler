import type {Expression} from "../ast/Ast.js";

/** A scalar interpolation uses the same literal-receiver NAMECALL/CALL as
 * `%*` formatting in both pinned Luau compilers. Constant string arguments
 * are the exception: interpolation folds them into the format and removes
 * their arguments, which a replacement format method can observe. */
export function scalarFormatInterpolation(expression: Expression): Extract<Expression, {kind: "interp"}> | undefined {
  if (expression.kind !== "method-call" || expression.name !== "format" ||
      expression.object.kind !== "literal" || typeof expression.object.value !== "string" ||
      expression.args.length === 0 || !expression.args.every(value => cannotFoldToString(value))) return undefined;

  const parts: Extract<Expression, {kind: "interp"}>["parts"] = [];
  const format = expression.object.value;
  let text = "";
  let argument = 0;
  for (let index = 0; index < format.length; index++) {
    const char = format[index]!;
    if (char !== "%") { text += char; continue; }
    const specifier = format[++index];
    if (specifier === "%") { text += "%"; continue; }
    if (specifier !== "*" || argument >= expression.args.length) return undefined;
    if (text) parts.push({kind: "text", value: text});
    text = "";
    parts.push({kind: "expr", value: expression.args[argument++]!});
  }
  if (argument !== expression.args.length) return undefined;
  if (text) parts.push({kind: "text", value: text});
  return {kind: "interp", parts};
}

/** This proves a compiler property, not the runtime type of a value: unknown
 * arithmetic can invoke a metamethod, but the compiler cannot fold its result
 * to a string constant. Names and calls may resolve to string constants after
 * propagation/inlining, so they decline unless wrapped by an operation whose
 * folded result cannot be a string. No inferred annotation is trusted. */
function cannotFoldToString(expression: Expression, depth = 0): boolean {
  if (depth >= 32) return false;
  switch (expression.kind) {
    case "paren": return cannotFoldToString(expression.expression, depth + 1);
    case "literal": return typeof expression.value !== "string";
    case "unary": return true;
    case "binary":
      if (expression.op === "..") return false;
      if (expression.op === "and" || expression.op === "or") return cannotFoldToString(expression.left, depth + 1) &&
        cannotFoldToString(expression.right, depth + 1);
      return true;
    case "table": case "function-expr": return true;
    case "if-expr": return cannotFoldToString(expression.consequent, depth + 1) &&
      cannotFoldToString(expression.alternate, depth + 1) &&
      expression.branches.every(branch => cannotFoldToString(branch.value, depth + 1));
    default: return false;
  }
}
