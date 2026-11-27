import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import type { CallExpression, CompoundAssignment, GenericForStatement, Identifier, RepeatStatement, ReturnStatement, WhileStatement } from "../src/ast/Ast.ts";
import { decompile } from "../src/decompile.ts";
import { decodeBytecode } from "../src/decode/Decoder.ts";
import { normalizeControlFlow } from "../src/decode/NormalizeControlFlow.ts";
import { encodeE, Opcode } from "../src/decode/Opcode.ts";
import { analyzePrototype, reconstructFunction } from "../src/reconstruct/Reconstructor.ts";
import { abc, ad, decode, proto } from "./helpers.ts";

function fixture(name: string) {
  return readFileSync(new URL(`./fixtures/control-flow-normalization/${name}.luauc`, import.meta.url));
}

function nodes<T extends {kind: string}>(node: unknown, kind: T["kind"]): T[] {
  if (Array.isArray(node)) return node.flatMap(value => nodes<T>(value, kind));
  if (!node || typeof node !== "object") return [];
  return [
    ...((node as {kind?: string}).kind === kind ? [node as T] : []),
    ...Object.values(node).flatMap(value => nodes<T>(value, kind)),
  ];
}

it("keeps the repeat's counted return as its follow and its empty return inside the body", () => {
  const module = normalizeControlFlow(decodeBytecode(fixture("repeat-return-follow-O0g1")).module);
  const prototype = module.prototypes.find(prototype => prototype.debugName === "scan")!;
  const ir = analyzePrototype(prototype), loop = ir.loops.find(loop => loop.kind === "repeat")!;
  const follow = ir.structure.loopFollowByLoop.get(loop)!;
  expect(ir.cfg.blocks[follow]!.instructions.at(-1)).toMatchObject({opcode: Opcode.RETURN, b: 2});
  const result = decompile(fixture("repeat-return-follow-O0g1"));
  if (!result.ok) throw new Error(result.error);
  const body = nodes<RepeatStatement>(result.ast, "repeat")[0]!.body;
  expect(nodes<ReturnStatement>(body, "return").some(statement => statement.values.length === 0)).toBe(true);
});

it.each(["O0g1", "O1g1-x2"])("retains the break after the alternative empty return in a generic loop (%s)", profile => {
  const result = decompile(fixture(`generic-break-after-return-${profile}`));
  if (!result.ok) throw new Error(result.error);
  const body = nodes<GenericForStatement>(result.ast, "generic-for")[0]!.body;
  expect(body.statements.at(-1)?.kind).toBe("break");
  expect(nodes<ReturnStatement>(body, "return").some(statement => statement.values.length === 0)).toBe(true);
});

it("tests the loaded element after an inlined repeat return instead of reusing its cancellation guard", () => {
  const result = decompile(fixture("repeat-inlined-return-tail-O2g1"));
  if (!result.ok) throw new Error(result.error);
  const loop = result.ast.body.statements.find(statement => statement.kind === "repeat")! as RepeatStatement;
  expect(loop).toBeDefined();
  expect(nodes<Identifier>(loop.test, "identifier").some(identifier => identifier.name === "cancelSearch")).toBe(false);
  const afterLoop = result.ast.body.statements.slice(result.ast.body.statements.indexOf(loop) + 1);
  expect(afterLoop.some(statement => statement.kind === "if" && statement.consequent.statements.some(statement => statement.kind === "assign"))).toBe(true);
});

it("keeps a nested repeat inside a generic body that always breaks", () => {
  const result = decompile(fixture("nested-loop-first-item-O0g1"));
  if (!result.ok) throw new Error(result.error);
  const loop = nodes<GenericForStatement>(result.ast, "generic-for")[0]!;
  expect(nodes<RepeatStatement>(loop.body, "repeat")).toHaveLength(1);
  expect(loop.body.statements.at(-1)?.kind).toBe("break");
});

it("evaluates a first-item predicate and its observation inside the iterator's scope", () => {
  const result = decompile(fixture("first-item-predicate-O0g1"));
  if (!result.ok) throw new Error(result.error);
  const loop = nodes<GenericForStatement>(result.ast, "generic-for")[0]!;
  const call = nodes<CallExpression>(loop.body, "call").find(call => call.callee.kind === "identifier" && call.callee.name === "print")!;
  expect(call.args.at(-1)).toEqual({kind: "identifier", name: loop.names[1]});
  expect(loop.body.statements.at(-1)?.kind).toBe("break");
});

it("emits the counter update before a boolean guard once per captured iteration", () => {
  const result = decompile(fixture("repeat-boolean-prelude-O1g1"));
  if (!result.ok) throw new Error(result.error);
  const observe = result.ast.body.statements.at(-1)!;
  if (observe.kind !== "expression-stmt" || observe.expression.kind !== "call") throw new Error("missing final observation");
  const counter = observe.expression.args[0]!;
  if (counter.kind !== "identifier") throw new Error("missing loop counter");
  const updates = nodes<CompoundAssignment>(result.ast, "compound-assign").filter(statement =>
    statement.target.kind === "identifier" && statement.target.name === counter.name && statement.op === "+");
  expect(updates).toHaveLength(1);
});

it.each([Opcode.JUMP, Opcode.JUMPX])("does not add a second break for a canonical while exit through %s", opcode => {
  const {module} = decode(proto({numParams: 1, constants: [{kind: "number", value: 1}], instructions: [
    ad(Opcode.LOADN, 1, 0), ad(Opcode.JUMPIFNOT, 0, 4), abc(Opcode.ADDK, 1, 1, 0),
    abc(Opcode.LOADNIL, 0, 0, 0), ad(Opcode.JUMPBACK, 0, -4), abc(Opcode.RETURN, 1, 2, 0),
    opcode === Opcode.JUMP ? ad(opcode, 0, -2) : encodeE(opcode, -2),
  ]}));
  // Exercise the structured CFG directly: a prior layout pass can introduce
  // this adapter after the initial bytecode normalization has already run.
  const result = reconstructFunction(module, module.prototypes[module.mainProtoId]!);
  const loop = nodes<WhileStatement>(result.body, "while")[0]!;
  expect(loop.test.kind).toBe("identifier");
  expect(loop.body.statements.some(statement => statement.kind === "if")).toBe(false);
});

it("keeps the continuing arm of an effectful while exit on the backedge", () => {
  const result = decompile(fixture("while-exit-work-O0g1"));
  if (!result.ok) throw new Error(result.error);
  const loop = nodes<WhileStatement>(result.ast, "while")[0]!;
  expect(loop.body.statements.some(statement => statement.kind === "break")).toBe(false);
  expect(nodes<{kind: "break"}>(loop.body, "break").length).toBeGreaterThan(0);
});

it("keeps a nested loop's enclosing join when its exit crosses a pure adapter", () => {
  const {module} = decode(proto({numParams: 2, constants: [{kind: "number", value: 1}], instructions: [
    ad(Opcode.LOADN, 2, 0), ad(Opcode.JUMPIFNOT, 0, 10), ad(Opcode.JUMPIFNOT, 1, 7),
    ad(Opcode.LOADN, 3, 2), ad(Opcode.LOADN, 4, 1), ad(Opcode.LOADN, 5, 1),
    ad(Opcode.FORNPREP, 3, 4), abc(Opcode.ADDK, 2, 2, 0), ad(Opcode.FORNLOOP, 3, -2),
    ad(Opcode.JUMP, 0, 1), ad(Opcode.LOADN, 2, 10), ad(Opcode.JUMP, 0, 1),
    ad(Opcode.LOADN, 2, 100), abc(Opcode.RETURN, 2, 2, 0),
  ]}));
  // The conditional's join is pc11; the loop resumes at its canonical pc13.
  // Reconstructing that continuation inside one arm duplicates the return and
  // any later work. Exercise the structured IR before optional normalization.
  const result = reconstructFunction(module, module.prototypes[module.mainProtoId]!);
  expect(nodes<ReturnStatement>(result.body, "return")).toHaveLength(1);
  expect(result.body.statements.at(-1)?.kind).toBe("return");
});
