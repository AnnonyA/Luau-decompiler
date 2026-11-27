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

export type CompoundOperator = "+" | "-" | "*" | "/" | "%" | "..";

export type Statement =
  | LocalDeclaration
  | Assignment
  | CompoundAssignment
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
  types?: Array<string | undefined>;
  /** Exact debug scope of a source parallel declaration, before name styling. */
  debugDeclaration?: { prototypeId: number; startPc: number; endPc: number; register: number };
  /** Private control flag inserted for a loop's distinct normal-exit tail. */
  syntheticLoopTail?: true;
  /** Producer ownership used to resolve debug names in their actual function. */
  definition?: { prototypeId: number; pc: number; register: number; debugName?: string };
}

export interface Assignment {
  kind: "assign";
  targets: Expression[];
  values: Expression[];
}

export interface CompoundAssignment {
  kind: "compound-assign";
  target: Expression;
  op: CompoundOperator;
  value: Expression;
}

export interface FunctionDeclaration {
  kind: "function-decl";
  local: boolean;
  name: string;
  params: string[];
  paramTypes?: Array<string | undefined>;
  returnType?: string;
  isVararg: boolean;
  body: Block;
  /** Source line from the prototype's `lineDefined`, when present. */
  line?: number;
  closureIdentity?: ClosureIdentity;
  creationSite?: {ownerProtoId: number; pc: number};
}

/** A load from the original prototype's constant pool. This is provenance,
 * not a claim that two executions return the same object. */
export interface ClosureIdentity {
  ownerProtoId: number;
  constantIndex: number;
  childProtoId: number;
  pc: number;
  captureCount: number;
  captureNames?: readonly string[];
  /** A recovered factory needs this direct immutable initializer at O2. */
  inlineCaptureInitializer?: boolean;
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
  | ParenthesizedExpression
  | IfExpression
  | InterpolatedString;

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
  /** Preserve a bytecode CALL whose activation can observe an environment or
   * own a closure cache. Lowered only by the printer, after cleanup. */
  preserveBoundary?: boolean;
  /** A deliberately recovered factory whose inlining is part of its contract. */
  inlineForIdentity?: boolean;
  /** SSA evaluation points for callee and each source argument, before
   * closure presentation. Missing entries do not prove evaluation order. */
  evaluation?: {ownerProtoId: number; pc: number; operandPcs: readonly (number | undefined)[]};
}

export interface MethodCallExpression {
  kind: "method-call";
  object: Expression;
  name: string;
  args: Expression[];
  open: boolean;
  /** Receiver then arguments. Luau's NAMECALL lookup follows the arguments. */
  evaluation?: {ownerProtoId: number; pc: number; operandPcs: readonly (number | undefined)[]};
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
  /** Reconstruction provenance: SETLIST entries consume positional slots. */
  list?: boolean;
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
  /** Actual prototype debug name, never an inferred binding name. */
  debugName?: string;
  params: string[];
  paramTypes?: Array<string | undefined>;
  returnType?: string;
  isVararg: boolean;
  body: Block;
  /** Source line from the prototype's `lineDefined`, when present. */
  line?: number;
  closureIdentity?: ClosureIdentity;
  creationSite?: {ownerProtoId: number; pc: number};
}

export interface IfExpressionBranch {
  test: Expression;
  value: Expression;
}

export interface IfExpression {
  kind: "if-expr";
  test: Expression;
  consequent: Expression;
  branches: IfExpressionBranch[];
  alternate: Expression;
}

export interface InterpolatedPart {
  kind: "text" | "expr";
  value: string | Expression;
}

export interface InterpolatedString {
  kind: "interp";
  parts: InterpolatedPart[];
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

/** Clone our plain AST records without serializing numeric primitives.
 * structuredClone canonicalizes NaNs, losing their observable sign bits. Keep
 * shared node identities within the copy while detaching all mutable records. */
export function cloneAst<T>(value: T): T {
  const copies = new Map<object, object>();
  const copy = (node: unknown): unknown => {
    if (node === null || typeof node !== "object") return node;
    const previous = copies.get(node);
    if (previous) return previous;
    const result: object = Array.isArray(node) ? new Array(node.length) : {};
    copies.set(node, result);
    for (const [key, child] of Object.entries(node)) (result as Record<string, unknown>)[key] = copy(child);
    return result;
  };
  return copy(value) as T;
}
