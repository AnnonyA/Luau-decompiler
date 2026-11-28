import { describe, expect, it } from "vitest";
import { block, chunk, ident, lit, type Chunk, type FunctionExpression, type Statement } from "../src/ast/Ast.ts";
import { lowerClosureIdentity } from "../src/reconstruct/ClosureIdentityLowering.ts";
import { analyzeBindings } from "../src/analysis/Bindings.ts";
import { abc, ad, decode, Opcode, proto } from "./helpers.ts";

function example(slots: number[] = [0, 0]) {
  const child = () => proto({instructions: [ad(Opcode.LOADN, 0, 7), abc(Opcode.RETURN, 0, 2)]});
  const module = decode(proto({children: [child(), child()],
    constants: [{kind: "closure", protoId: 0}, {kind: "closure", protoId: 1}],
    instructions: [...slots.map((slot, index) => ad(Opcode.DUPCLOSURE, index, slot)), abc(Opcode.RETURN, 0, slots.length + 1)],
  })).module;
  const fn = (pc: number, slot = slots[pc]!): FunctionExpression => ({kind: "function-expr", params: [], isVararg: false,
    body: block([{kind: "return", values: [lit(7)]}]), closureIdentity: {
      ownerProtoId: module.mainProtoId, constantIndex: slot, childProtoId: slot, pc, captureCount: 0, captureNames: [],
    }});
  return {module, fn};
}

function physicalSlots(ast: Chunk): string[] {
  const slots: string[] = [];
  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    const fn = value as FunctionExpression;
    if (fn.kind === "function-expr" && fn.closureIdentity)
      slots.push(`${fn.closureIdentity.ownerProtoId}:${fn.closureIdentity.constantIndex}`);
    Object.values(value).forEach(child => Array.isArray(child) ? child.forEach(visit) : visit(child));
  };
  visit(ast); return slots;
}

describe("bounded native constant dispatcher", () => {
  it("keeps an exact debug name distinct from its generated result cell", () => {
    const {module, fn} = example();
    const input = chunk([
      {kind: "local", names: ["first"], values: [{...fn(0), debugName: "loadedClosure"}]},
      {kind: "local", names: ["second"], values: [{...fn(1), debugName: "loadedClosure"}]},
      {kind: "return", values: [ident("first"), ident("second")]},
    ]);
    const result = lowerClosureIdentity(input, module);
    expect(result.resolvedKeys.size).toBe(1);
    const {bindings} = analyzeBindings(result.ast.body);
    const literal = bindings.find(binding => binding.declaration.kind === "function-decl")!;
    expect(literal.name).toBe("loadedClosure");
    expect(literal.writes).toHaveLength(0);
    expect(literal.reads).toHaveLength(1);
    const resultCell = bindings.find(binding => binding.name === "loadedClosure2")!;
    expect(resultCell.writes).toHaveLength(1);
    expect(resultCell.reads).toHaveLength(2);
  });

  it("merges interleaved uses of each slot but keeps distinct slots with identical bodies apart", () => {
    const {module, fn} = example([0, 1, 0, 1]);
    const declarations: Statement[] = ["a", "b", "c", "d"].map((name, index) =>
      ({kind: "local", names: [name], values: [fn(index)]}));
    const input = chunk([...declarations, {kind: "return", values: ["a", "b", "c", "d"].map(ident)}]);
    const result = lowerClosureIdentity(input, module);
    expect(result.resolvedKeys.size).toBe(2);
    expect(physicalSlots(result.ast).sort()).toEqual([`${module.mainProtoId}:0`, `${module.mainProtoId}:1`]);
    expect(result.ast.body.statements.filter(statement => statement.kind === "while")).toHaveLength(1);
    const last = result.ast.body.statements.at(-1)!;
    expect(last).toEqual(input.body.statements.at(-1));
  });

  it("refuses to hoist a local captured across dispatcher segments", () => {
    const {module, fn} = example();
    const input = chunk([
      {kind: "local", names: ["first"], values: [fn(0)]},
      {kind: "local", names: ["read"], values: [{kind: "function-expr", params: [], isVararg: false,
        body: block([{kind: "return", values: [ident("first")]}])}]},
      {kind: "local", names: ["second"], values: [fn(1)]},
      {kind: "return", values: [ident("first"), ident("second"), ident("read")]},
    ]);
    const result = lowerClosureIdentity(input, module);
    expect(result.resolvedKeys.size).toBe(0);
    expect(physicalSlots(result.ast)).toHaveLength(2);
    expect(result.ast).toEqual(input);
  });

  it.each(["break", "continue"] as const)("does not redirect an outer-loop %s to its new loop", kind => {
    const {module, fn} = example();
    const input = chunk([{kind: "while", test: ident("running"), body: block([
      {kind: "local", names: ["first"], values: [fn(0)]},
      {kind: "if", test: ident("stop"), consequent: block([{kind}]), branches: []},
      {kind: "local", names: ["second"], values: [fn(1)]},
      {kind: "return", values: [ident("first"), ident("second")]},
    ])}]);
    const result = lowerClosureIdentity(input, module);
    expect(result.resolvedKeys.size).toBe(0);
    expect(result.ast).toEqual(input);
  });

  it("does not move an initializer required by a recovered inline factory", () => {
    const {module, fn} = example([0, 1, 0]);
    const required = fn(1);
    required.closureIdentity!.inlineCaptureInitializer = true;
    const input = chunk([
      {kind: "local", names: ["first"], values: [fn(0)]},
      {kind: "local", names: ["argument"], values: [required]},
      {kind: "local", names: ["second"], values: [fn(2)]},
      {kind: "return", values: [ident("first"), ident("second"), ident("argument")]},
    ]);
    const result = lowerClosureIdentity(input, module);
    expect(result.resolvedKeys.size).toBe(0);
    expect(result.ast).toEqual(input);
  });

  it("leaves a group spanning different lexical blocks unresolved", () => {
    const {module, fn} = example();
    const input = chunk([
      {kind: "local", names: ["first"], values: [fn(0)]},
      {kind: "if", test: ident("selected"), consequent: block([
        {kind: "local", names: ["second"], values: [fn(1)]},
        {kind: "return", values: [ident("first"), ident("second")]},
      ]), branches: []},
    ]);
    expect(lowerClosureIdentity(input, module).resolvedKeys.size).toBe(0);
  });
});
