import {expect, it} from "vitest";
import type {Assignment, CallExpression, NumericForStatement, ReturnStatement} from "../src/ast/Ast.ts";
import {encodeE, Opcode} from "../src/decode/Opcode.ts";
import {reconstructFunction} from "../src/reconstruct/Reconstructor.ts";
import {abc, ad, decode, proto} from "./helpers.ts";

function nodes<T extends {kind: string}>(node: unknown, kind: T["kind"]): T[] {
  if (Array.isArray(node)) return node.flatMap(value => nodes<T>(value, kind));
  if (!node || typeof node !== "object") return [];
  return [...((node as {kind?: string}).kind === kind ? [node as T] : []),
    ...Object.values(node).flatMap(value => nodes<T>(value, kind))];
}

function exitArm(opcode: Opcode.JUMP | Opcode.JUMPX, effect: boolean, copy: boolean) {
  const code = [
    abc(Opcode.LOADNIL, 8, 0, 0), ad(Opcode.LOADN, 7, 2), abc(Opcode.MOVE, 5, 0, 0),
    ad(Opcode.LOADN, 6, 1), 0,
    ad(Opcode.LOADN, 3, 3), abc(Opcode.MOD, 4, 7, 3), ad(Opcode.LOADN, 3, 2), 0, 3,
    ad(Opcode.LOADN, 4, 5), 0, 7,
  ];
  // Without a prefix this is a conditional arm entered through a pure jump.
  // With the callback, ordinary block emission also has to retain work after
  // its unconditional transfer to another block outside the natural loop.
  if (effect) code.push(abc(Opcode.MOVE, 2, 1, 0), abc(Opcode.CALL, 2, 1, 1));
  const adapter = code.length;
  code.push(0);
  const latch = code.length;
  code.push(ad(Opcode.FORNLOOP, 5, 5 - latch - 1), 0);
  const work = code.length;
  if (copy) code.push(abc(Opcode.MOVE, 8, 7, 0));
  const follow = code.length;
  code.push(abc(Opcode.RETURN, 8, 2, 0));
  code[4] = ad(Opcode.FORNPREP, 5, follow - 5);
  code[8] = ad(Opcode.JUMPIFNOTEQ, 4, latch - 9);
  code[11] = ad(Opcode.JUMPIFNOTLT, 4, latch - 12);
  code[adapter] = opcode === Opcode.JUMPX ? encodeE(opcode, work - adapter - 1)
    : ad(opcode, 0, work - adapter - 1);
  code[latch + 1] = ad(Opcode.JUMP, 0, follow - latch - 2);
  const {module} = decode(proto({numParams: effect ? 2 : 1, maxStackSize: 9, instructions: code}));
  return reconstructFunction(module, module.prototypes[module.mainProtoId]!).body;
}

for (const opcode of [Opcode.JUMP, Opcode.JUMPX] as const) for (const effect of [false, true]) {
  it(`preserves the exit assignment across ${Opcode[opcode]} after ${effect ? "an effect" : "a guard"}`, () => {
    const body = exitArm(opcode, effect, true);
    const loop = nodes<NumericForStatement>(body, "numeric-for")[0]!;
    const returned = (body.statements.at(-1) as ReturnStatement).values[0]!;
    expect(returned.kind).toBe("identifier");
    const writes = nodes<Assignment>(loop.body, "assign").filter(statement =>
      statement.targets.some(target => target.kind === "identifier" && returned.kind === "identifier" && target.name === returned.name));
    expect(writes).toHaveLength(1);
    expect(writes[0]!.values).toEqual([{kind: "identifier", name: loop.name}]);
    expect(nodes<CallExpression>(loop.body, "call")).toHaveLength(effect ? 1 : 0);
  });
}

it.each([Opcode.JUMP, Opcode.JUMPX] as const)("retains a pure %s exit as a break without inventing work", opcode => {
  const body = exitArm(opcode, false, false);
  const loop = nodes<NumericForStatement>(body, "numeric-for")[0]!;
  expect(nodes<Assignment>(loop.body, "assign")).toHaveLength(0);
  expect(nodes<{kind: "break"}>(loop.body, "break")).toHaveLength(1);
});
