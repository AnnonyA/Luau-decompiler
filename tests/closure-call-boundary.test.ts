import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { analyzeBindings } from "../src/analysis/Bindings.ts";
import { block, chunk, ident, lit, type Expression } from "../src/ast/Ast.ts";
import { cleanupAst } from "../src/ast/AstCleanup.ts";
import { presentClosures } from "../src/ast/ClosurePresentation.ts";
import { decompile, defaultCleanupOptions } from "../src/decompile.ts";
import { printLuau } from "../src/print/LuauPrinter.ts";
import { analyzeCallBoundaries } from "../src/print/CallBoundaries.ts";
import { abc, ad, CaptureType, compile, Opcode, proto } from "./helpers.ts";

function nodes(value: unknown, kind: string): any[] {
  if (!value || typeof value !== "object") return [];
  return [((value as {kind?: string}).kind === kind ? [value] : []),
    ...Object.values(value).map(child => nodes(child, kind))].flat();
}

describe("native closure call boundaries", () => {
  it("keeps a single callee evaluation before open arguments without changing its binding", () => {
    const ast = chunk([
      {kind: "local", names: ["f"], values: [{kind: "function-expr", params: ["value"], isVararg: false,
        body: block([{kind: "return", values: [ident("value")]}])}]},
      {kind: "return", values: [{kind: "call", callee: ident("f"), preserveBoundary: true,
        args: [{kind: "call", callee: ident("arguments"), args: [], open: true}], open: true}]},
    ]);
    const before = analyzeBindings(ast.body).bindings.find(binding => binding.name === "f")!;
    expect(before.writes).toHaveLength(0);
    const cleaned = cleanupAst(presentClosures(ast), defaultCleanupOptions());
    const call = nodes(cleaned, "call").find(call => call.preserveBoundary);
    expect(call.open).toBe(true);
    expect(call.args).toHaveLength(1);
    expect(call.args[0].open).toBe(true);
    const source = printLuau(cleaned);
    expect(source).toMatch(/return \(true and [\s\S]+\)\(arguments\(\)\)/);
    expect(source.match(/arguments\(\)/g)).toHaveLength(1);
    expect(nodes(cleaned, "function-expr").concat(nodes(cleaned, "function-decl"))
      .every(fn => fn.params.length === 1 && fn.isVararg === false)).toBe(true);
  });

  it("forces one result only for an explicitly recovered inline factory", () => {
    const call: Expression = {kind: "call", callee: ident("factory"), args: [ident("value")], open: false,
      preserveBoundary: true, inlineForIdentity: true};
    expect(printLuau(chunk([{kind: "return", values: [call]}]))).toBe("return (factory(value))\n");
    expect(printLuau(chunk([{kind: "return", values: [{...call, inlineForIdentity: false}]}])))
      .toBe("return (factory)(value)\n");
  });

  it("groups a callee's lower-precedence alternatives inside the call fence", () => {
    const callee: Expression = {kind: "binary", op: "or", left: ident("first"), right: ident("fallback")};
    const invocation: Expression = {kind: "call", callee, args: [ident("value")], open: false, preserveBoundary: true};
    expect(printLuau(chunk([{kind: "return", values: [invocation]}])))
      .toBe("return (first or fallback)(value)\n");
  });

  it.each([false, null])("keeps a false-like callee %s without selecting a replacement", value => {
    const invocation: Expression = {kind: "call", callee: lit(value), args: [], open: false, preserveBoundary: true};
    expect(printLuau(chunk([{kind: "return", values: [invocation]}])))
      .toBe(`return (${value === null ? "nil" : "false"})()\n`);
  });

  it("protects a global-reading literal even without a retained second owner", () => {
    const child = proto({constants: [{kind: "string", value: "token"}],
      instructions: [abc(Opcode.GETGLOBAL, 0), 0, abc(Opcode.RETURN, 0, 2)]});
    const result = decompile(compile(proto({children: [child], constants: [{kind: "closure", protoId: 0}],
      instructions: [ad(Opcode.DUPCLOSURE, 0, 0), abc(Opcode.CALL, 0, 1, 2), abc(Opcode.RETURN, 0, 2)]})));
    expect(result.ok).toBe(true); if (!result.ok) throw Error(result.error);
    expect(nodes(result.ast, "call").filter(call => call.preserveBoundary)).toHaveLength(1);
    expect(result.source).toContain("(true and ");
  });

  it("preserves an original call that owns fresh captured closures", () => {
    const inner = proto({numUpvalues: 1, instructions: [abc(Opcode.GETUPVAL, 0, 0), abc(Opcode.RETURN, 0, 2)]});
    const factory = proto({numParams: 1, children: [inner], instructions: [
      ad(Opcode.NEWCLOSURE, 1, 0), abc(Opcode.CAPTURE, CaptureType.VAL, 0), abc(Opcode.RETURN, 1, 2),
    ]});
    const result = decompile(compile(proto({children: [factory], constants: [{kind: "closure", protoId: 1}],
      instructions: [ad(Opcode.DUPCLOSURE, 0, 0), ad(Opcode.LOADN, 1, 7), abc(Opcode.CALL, 0, 2, 2), abc(Opcode.RETURN, 0, 2)]})));
    expect(result.ok).toBe(true); if (!result.ok) throw Error(result.error);
    expect(nodes(result.ast, "call").filter(call => call.preserveBoundary)).toHaveLength(1);
    expect(result.source).toMatch(/\(true and [\s\S]+\)\(7\)/);
    expect(nodes(result.ast, "function-expr").filter(fn => fn.closureIdentity?.captureCount === 1)).toHaveLength(0);
  });

  it("does not fence a proven numeric literal-returning helper", () => {
    const child = proto({instructions: [ad(Opcode.LOADN, 0, 7), abc(Opcode.RETURN, 0, 2)]});
    const result = decompile(compile(proto({children: [child], constants: [{kind: "closure", protoId: 0}],
      instructions: [ad(Opcode.DUPCLOSURE, 0, 0), abc(Opcode.CALL, 0, 1, 2), abc(Opcode.RETURN, 0, 2)]})));
    expect(result.ok).toBe(true); if (!result.ok) throw Error(result.error);
    expect(nodes(result.ast, "call").some(call => call.preserveBoundary)).toBe(false);
  });

  it.each([true, false])("keeps h01's native literal and environment calls with ifExpressions=%s", ifExpressions => {
    const bytes = readFileSync(new URL("../benchmarks/closure-identity/holdouts/bytecode/h01/O2.luauc", import.meta.url));
    const result = decompile(bytes, {opcodeEncoding: "official", ifExpressions});
    expect(result.ok).toBe(true); if (!result.ok) throw Error(result.error);
    expect(result.validation).toEqual([]);
    const identityLoads = nodes(result.ast, "function-expr").concat(nodes(result.ast, "function-decl"))
      .filter(fn => fn.closureIdentity?.ownerProtoId === result.module.mainProtoId && fn.closureIdentity.constantIndex === 7);
    expect(identityLoads).toHaveLength(1);
    expect(result.source).toContain("while true do");
    const boundaries = nodes(result.ast, "call").filter(call => call.preserveBoundary);
    expect(boundaries.filter(call => /^loadedClosure\d*$/.test(call.callee?.name ?? ""))).toHaveLength(4);
    // The three environment operations originated from table field loads;
    // keep their indirect CALLs too, even after naming/materialization.
    expect(boundaries.filter(call => /^(getfenv|setfenv)$/.test(call.callee?.name ?? ""))).toHaveLength(3);
    expect(boundaries).toHaveLength(7);
    // Written closure targets cannot expose a literal or builtin. Environment
    // operations still keep their groups; all seven CALL metadata entries stay.
    const presentation = analyzeCallBoundaries(result.ast.body);
    expect(boundaries.filter(call => presentation.direct.has(call))).toHaveLength(4);
    expect(result.source.match(/\bloadedClosure\d*\(/g)).toHaveLength(4);
    expect(result.source.match(/\((?:getfenv|setfenv)\)\(/g)).toHaveLength(3);
    expect(result.diagnostics.some(diagnostic => diagnostic.code === "closure-identity-unresolved")).toBe(false);
    expect(result.source).not.toContain("--!optimize");
  });

  it("does not label any original NEWCLOSURE as a constant-pool load", () => {
    const bytes = readFileSync(new URL("../benchmarks/closure-identity/holdouts/bytecode/h01/O0.luauc", import.meta.url));
    const result = decompile(bytes, {opcodeEncoding: "official"});
    expect(result.ok).toBe(true); if (!result.ok) throw Error(result.error);
    expect(nodes(result.ast, "function-expr").concat(nodes(result.ast, "function-decl"))
      .some(fn => fn.closureIdentity)).toBe(false);
  });
});
