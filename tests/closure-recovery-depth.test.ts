import { describe, expect, it } from "vitest";
import { block, chunk, ident, lit, type Block, type FunctionExpression, type IfStatement } from "../src/ast/Ast.ts";
import { cloneAst } from "../src/ast/AstClone.ts";
import { decodeBytecode } from "../src/decode/Decoder.ts";
import { recoverClosureFactories } from "../src/reconstruct/ClosureInlineRecovery.ts";
import { compile, proto, ret } from "./helpers.ts";

describe("closure recovery on deep ASTs", () => {
  it("copies a 700-arm raw elseif chain before running the unchanged analysis", () => {
    const condition = ident("selection"), value = lit(9007199254740993n);
    let body = block([{ kind: "return", values: [value] }]);
    for (let index = 0; index < 700; index++) {
      body = block([{
        kind: "if", test: condition,
        consequent: block([{ kind: "return", values: [value] }]),
        branches: [], alternate: body,
      }]);
    }
    const input = chunk(body.statements);
    const module = decodeBytecode(compile(proto({ instructions: [ret()] }))).module;
    // The former structuredClone(input) overflows at this depth on Node 22.
    const result = recoverClosureFactories(input, module);
    expect(result.requiresOptimization2).toBe(false);
    expect(result.diagnostics).toEqual([]);
    expect(result.ast === input).toBe(false);

    let original: Block = input.body, cloned: Block = result.ast.body;
    const copiedCondition = (cloned.statements[0] as IfStatement).test;
    const firstReturn = (cloned.statements[0] as IfStatement).consequent.statements[0]!;
    if (firstReturn.kind !== "return") throw new Error("missing branch return");
    const copiedValue = firstReturn.values[0]!;
    expect(copiedCondition === condition).toBe(false);
    expect(copiedValue === value).toBe(false);
    if (copiedValue.kind !== "literal") throw new Error("missing integer literal");
    expect(copiedValue.value).toBe(9007199254740993n);

    // Walk iteratively; a recursive matcher would introduce its own stack limit.
    for (let index = 0; index < 700; index++) {
      const source = original.statements[0]!, target = cloned.statements[0]!;
      if (source.kind !== "if" || target.kind !== "if") throw new Error(`missing arm ${index}`);
      expect(target === source).toBe(false);
      expect(target.test === copiedCondition).toBe(true);
      const returned = target.consequent.statements[0]!;
      if (returned.kind !== "return") throw new Error(`missing return ${index}`);
      expect(returned.values[0] === copiedValue).toBe(true);
      expect(target.branches.length).toBe(0);
      original = source.alternate!;
      cloned = target.alternate!;
    }
    const tail = cloned.statements[0]!;
    if (tail.kind !== "return") throw new Error("missing final return");
    expect(tail.values[0] === copiedValue).toBe(true);
    expect(value.value).toBe(9007199254740993n);
  });

  it("preserves shared closure provenance and evaluation metadata without aliasing the input", () => {
    const closure: FunctionExpression = {
      kind: "function-expr", params: ["argument"], isVararg: false,
      body: block([{ kind: "return", values: [ident("captured")] }]),
      closureIdentity: {
        ownerProtoId: 2, constantIndex: 3, childProtoId: 4, pc: 5,
        captureCount: 1, captureNames: ["captured"], inlineCaptureInitializer: true,
      },
      creationSite: { ownerProtoId: 2, pc: 5 },
    };
    const input = chunk([{ kind: "return", values: [closure, closure, {
      kind: "call", callee: ident("consume"), args: [lit(-0)], open: false,
      preserveBoundary: true,
      evaluation: { ownerProtoId: 2, pc: 9, operandPcs: [undefined, 7] },
    }] }]);
    const protoData = { note: "own data" };
    Object.defineProperty(input.body, "__proto__", {
      value: protoData, enumerable: true, configurable: true, writable: true,
    });
    const copied = cloneAst(input);
    const descriptor = Object.getOwnPropertyDescriptor(copied.body, "__proto__");
    expect(descriptor?.value).toEqual(protoData);
    expect(descriptor?.value === protoData).toBe(false);
    expect(descriptor?.enumerable).toBe(true);
    expect(Object.getPrototypeOf(copied.body) === Object.prototype).toBe(true);
    const returned = copied.body.statements[0]!;
    if (returned.kind !== "return") throw new Error("missing return");
    const fn = returned.values[0]!, call = returned.values[2]!;
    if (fn.kind !== "function-expr" || call.kind !== "call") throw new Error("missing closure/call");
    expect(fn).toBe(returned.values[1]);
    expect(fn).not.toBe(closure);
    expect(fn.closureIdentity).toEqual(closure.closureIdentity);
    expect(fn.closureIdentity).not.toBe(closure.closureIdentity);
    expect(fn.closureIdentity!.captureNames).not.toBe(closure.closureIdentity!.captureNames);
    expect(fn.creationSite).toEqual({ ownerProtoId: 2, pc: 5 });
    expect(call.preserveBoundary).toBe(true);
    expect(call.evaluation).toEqual({ ownerProtoId: 2, pc: 9, operandPcs: [undefined, 7] });
    expect(Object.hasOwn(call.evaluation!.operandPcs, 0)).toBe(true);
    const argument = call.args[0]!;
    if (argument.kind !== "literal") throw new Error("missing argument");
    expect(Object.is(argument.value, -0)).toBe(true);
    fn.params[0] = "renamed";
    expect(closure.params[0]).toBe("argument");
  });
});
