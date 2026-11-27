import { expect, it } from "vitest";
import type { CallExpression } from "../src/ast/Ast.ts";
import { analyzePrototype, reconstructFunction } from "../src/reconstruct/Reconstructor.ts";
import { abc, ad, decode, Opcode, proto } from "./helpers.ts";

function calls(node: unknown): CallExpression[] {
  if (Array.isArray(node)) return node.flatMap(calls);
  if (!node || typeof node !== "object") return [];
  return [
    ...((node as {kind?: string}).kind === "call" ? [node as CallExpression] : []),
    ...Object.values(node).flatMap(calls),
  ];
}

it.each([Opcode.ADD, Opcode.GETTABLE, Opcode.AND, Opcode.OR])(
  "evaluates one callback before two operands read its scalar result (%s)", opcode => {
    const {module} = decode(proto({numParams: 1, instructions: [
      abc(Opcode.CALL, 0, 1, 2), abc(opcode, 0, 0, 0), abc(Opcode.RETURN, 0, 2, 0),
    ]}));
    const result = reconstructFunction(module, module.prototypes[module.mainProtoId]!);
    expect(calls(result.body)).toHaveLength(1);
  },
);

it.each([Opcode.JUMPIFEQ, Opcode.JUMPIFLT])(
  "compares two references to the same scalar result without a second callback (%s)", opcode => {
    const {module} = decode(proto({numParams: 1, instructions: [
      abc(Opcode.CALL, 0, 1, 2), ad(opcode, 0, 2), 0,
      abc(Opcode.LOADB, 0, 0, 1), abc(Opcode.LOADB, 0, 1, 0), abc(Opcode.RETURN, 0, 2, 0),
    ]}));
    const result = reconstructFunction(module, module.prototypes[module.mainProtoId]!);
    expect(calls(result.body)).toHaveLength(1);
  },
);

it("evaluates one object when SETTABLE uses it as value, table and key", () => {
  const {module} = decode(proto({numParams: 1, instructions: [
    abc(Opcode.CALL, 0, 1, 2), abc(Opcode.SETTABLE, 0, 0, 0), abc(Opcode.RETURN, 0, 1, 0),
  ]}));
  const prototype = module.prototypes[module.mainProtoId]!;
  expect(analyzePrototype(prototype).cfg.blocks[0]!.instructions[1]!.uses).toEqual([0, 0, 0]);
  const result = reconstructFunction(module, prototype);
  expect(calls(result.body)).toHaveLength(1);
});
