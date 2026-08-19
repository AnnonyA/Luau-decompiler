export type BinaryOperator = "+" | "-" | "*" | "/" | "//" | "%" | "^" | ".." | "<" | "<=" | ">" | ">=" | "==" | "~=" | "and" | "or";
export type UnaryOperator = "not" | "-" | "#";

export type AstNode =
  | Chunk
  | Block
  | Statement
  | Expression;

export interface Chunk {
  kind: "chunk";
  body: Block;
}

export interface Block {
  kind: "block";
  statements: Statement[];
}

export type Statement =
  | LocalDeclaration
  | Assignment
  | FunctionDeclaration
  | IfStatement
  | WhileStatement
  | RepeatStatement
  | NumericForStatement
  | GenericForStatement
  | ReturnStatement
  | BreakStatement
  | ContinueStatement
  | ExpressionStatement
  | DoStatement;

export interface LocalDeclaration {
  kind: "local";
  names: string[];
  values: Expression[];
}

export interface Assignment {
  kind: "assign";
  targets: Expression[];
  values: Expression[];
}

export interface FunctionDeclaration {
  kind: "function-decl";
  local: boolean;
  name: string;
  params: string[];
  isVararg: boolean;
  body: Block;
}

export interface IfStatement {
  kind: "if";
  test: Expression;
  consequent: Block;
  branches: Array<{ test: Expression; body: Block }>;
  alternate?: Block;
}

export interface WhileStatement {
  kind: "while";
  test: Expression;
  body: Block;
}

export interface RepeatStatement {
  kind: "repeat";
  body: Block;
  test: Expression;
}

export interface NumericForStatement {
  kind: "numeric-for";
  name: string;
  start: Expression;
  stop: Expression;
  step?: Expression;
  body: Block;
}

export interface GenericForStatement {
  kind: "generic-for";
  names: string[];
  iterators: Expression[];
  body: Block;
}

export interface ReturnStatement {
  kind: "return";
  values: Expression[];
}

export interface BreakStatement {
  kind: "break";
}

export interface ContinueStatement {
  kind: "continue";
}

export interface ExpressionStatement {
  kind: "expression-stmt";
  expression: Expression;
}

export interface DoStatement {
  kind: "do";
  body: Block;
}

export type Expression =
  | Identifier
  | Literal
  | VarargExpression
  | UnaryExpression
  | BinaryExpression
  | CallExpression
  | MethodCallExpression
  | IndexExpression
  | PropertyExpression
  | TableExpression
  | FunctionExpression
  | ParenthesizedExpression;

export interface Identifier {
  kind: "identifier";
  name: string;
}

export interface Literal {
  kind: "literal";
  value: null | boolean | number | string | bigint;
}

export interface VarargExpression {
  kind: "vararg";
}

export interface UnaryExpression {
  kind: "unary";
  op: UnaryOperator;
  argument: Expression;
}

export interface BinaryExpression {
  kind: "binary";
  op: BinaryOperator;
  left: Expression;
  right: Expression;
}

export interface CallExpression {
  kind: "call";
  callee: Expression;
  args: Expression[];
  open: boolean;
}

export interface MethodCallExpression {
  kind: "method-call";
  object: Expression;
  name: string;
  args: Expression[];
  open: boolean;
}

export interface IndexExpression {
  kind: "index";
  table: Expression;
  key: Expression;
}

export interface PropertyExpression {
  kind: "property";
  object: Expression;
  name: string;
}

export interface TableField {
  key?: Expression;
  name?: string;
  value: Expression;
}

export interface TableExpression {
  kind: "table";
  fields: TableField[];
}

export interface FunctionExpression {
  kind: "function-expr";
  params: string[];
  isVararg: boolean;
  body: Block;
}

export interface ParenthesizedExpression {
  kind: "paren";
  expression: Expression;
}

export function ident(name: string): Identifier {
  return { kind: "identifier", name };
}

export function lit(value: Literal["value"]): Literal {
  return { kind: "literal", value };
}

export function block(statements: Statement[] = []): Block {
  return { kind: "block", statements };
}

export function chunk(statements: Statement[]): Chunk {
  return { kind: "chunk", body: block(statements) };
}
