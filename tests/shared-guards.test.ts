import {describe, expect, it} from "vitest";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {computeLiveness} from "../src/dataflow/Liveness.ts";
import {decompile} from "../src/decompile.ts";
import {analyzePrototype} from "../src/reconstruct/Reconstructor.ts";
import {sharedGuardShape} from "../src/reconstruct/SharedGuards.ts";
import {abc, ad, compile, decode, Opcode, proto} from "./helpers.ts";

// Both tests enter the same original callback block. The second test's
// effectful property read is evaluated only when the first test is false.
function triangle(readTwice = false) {
  const code = proto({numParams: 3, maxStackSize: 5,
    constants: [{kind: "string", value: "value"}],
    instructions: readTwice ? [
      ad(Opcode.JUMPIF, 0, 4),
      abc(Opcode.GETTABLEKS, 3, 1, 0), 0,
      ad(Opcode.JUMPIFNOTEQ, 3, 3), 3,
      abc(Opcode.MOVE, 4, 2, 0),
      abc(Opcode.CALL, 4, 1, 1),
      abc(Opcode.RETURN, 0, 1, 0),
    ] : [
      ad(Opcode.JUMPIF, 0, 3),
      abc(Opcode.GETTABLEKS, 3, 1, 0), 0,
      ad(Opcode.JUMPIFNOT, 3, 2),
      abc(Opcode.MOVE, 4, 2, 0),
      abc(Opcode.CALL, 4, 1, 1),
      abc(Opcode.RETURN, 0, 1, 0),
    ],
  });
  const decoded = decode(code);
  const ir = analyzePrototype(decoded.module.prototypes[0]!);
  const at = (pc: number) => ir.cfg.blocks[ir.cfg.blockOfPc.get(pc)!]!;
  const basic = at(0), guard = at(1), body = at(readTwice ? 5 : 4), follow = at(readTwice ? 7 : 6);
  const liveness = computeLiveness(ir.cfg);
  return {code, ir, basic, guard, body, follow, liveness,
    shape: () => sharedGuardShape(ir, basic, follow.id, liveness)};
}

describe("one shared body behind short-circuit guards", () => {
  it("finds the original shared block and preserves a conditional lookup", () => {
    const r = triangle();
    expect(r.shape()).toEqual({guard: r.guard, body: r.body});
    const result = decompile(compile(r.code), {opcodeEncoding: "official", runtimeContext: false});
    if (!result.ok) throw new Error(result.error);
    expect(result.source).toBe("if value or index.value then\n    count()\nend\n");
  });

  it("restores traversal state when the second guard requires a stored read", () => {
    const r = triangle(true);
    expect(r.shape()).toEqual({guard: r.guard, body: r.body});
    const result = decompile(compile(r.code), {opcodeEncoding: "official", runtimeContext: false});
    if (!result.ok) throw new Error(result.error);
    // Reading the property once and comparing the stored result with itself
    // cannot become two property reads, nor may rejection consume its block.
    expect(result.source).toBe(
      "if not value then\n    local value2 = index.value\n    if value2 == value2 then\n        count()\n    end\nelse\n    count()\nend\n");
  });

  it("rejects an extra live entry to either consumed block", () => {
    for (const target of ["guard", "body"] as const) {
      const r = triangle();
      r[target].predecessors.push(r.follow.id);
      expect(r.shape()).toBeUndefined();
    }
  });

  it("rejects a body with another continuation", () => {
    const r = triangle();
    r.body.successors.push(r.guard.id);
    expect(r.shape()).toBeUndefined();
  });

  it("does not fold a loop header or a block with merged values", () => {
    for (const target of ["guard", "body"] as const) {
      const r = triangle();
      r.ir.loops.push({header: r[target].id, latch: r.follow.id,
        blocks: [r[target].id, r.follow.id], backEdges: [], kind: "while"});
      expect(r.shape()).toBeUndefined();
      r.ir.loops.length = 0;
      r.ir.ssa.phis.set(r[target].id, [{value: 0, block: r[target].id, register: 3, operands: []}]);
      expect(r.shape()).toBeUndefined();
    }
  });

  it("does not carry a guard definition across the shared boundary", () => {
    const r = triangle();
    r.liveness.liveOut[r.guard.id]!.add(3);
    expect(r.shape()).toBeUndefined();
  });

  it("retains existing follow phis only when neither consumed block writes them", () => {
    const r = triangle();
    r.ir.ssa.phis.set(r.follow.id, [{value: 0, block: r.follow.id, register: 0, operands: []}]);
    expect(r.shape()).toEqual({guard: r.guard, body: r.body});
    for (const register of [3, 4]) {
      r.ir.ssa.phis.set(r.follow.id, [{value: 0, block: r.follow.id, register, operands: []}]);
      expect(r.shape()).toBeUndefined();
    }
  });

  it.each([
    Opcode.CALL, Opcode.CALLFB, Opcode.NAMECALL, Opcode.NAMECALLUDATA,
    Opcode.SETTABLE, Opcode.SETTABLEKS, Opcode.SETUPVAL, Opcode.SETGLOBAL,
    Opcode.NEWTABLE, Opcode.DUPTABLE, Opcode.NEWCLOSURE, Opcode.DUPCLOSURE,
    Opcode.CAPTURE, Opcode.CLOSEUPVALS, Opcode.GETVARARGS, Opcode.PREPVARARGS,
    Opcode.NATIVECALL, Opcode.NEWCLASS, Opcode.CONSTRUCT, 255 as Opcode,
  ])("does not speculate second-guard state/effect opcode %s", opcode => {
    const r = triangle();
    r.guard.instructions[0] = {...r.guard.instructions[0]!, opcode};
    expect(r.shape()).toBeUndefined();
  });

  it.each([
    Opcode.CAPTURE, Opcode.CLOSEUPVALS, Opcode.NEWCLOSURE, Opcode.DUPCLOSURE,
    Opcode.SETUPVAL, Opcode.GETVARARGS, Opcode.PREPVARARGS, Opcode.FORNPREP,
    Opcode.FORNLOOP, Opcode.FORGPREP, Opcode.FORGPREP_INEXT, Opcode.FORGPREP_NEXT,
    Opcode.FORGLOOP, Opcode.JUMPBACK, Opcode.NATIVECALL, Opcode.NEWCLASSMEMBER,
    Opcode.NEWCLASS, Opcode.CONSTRUCT, Opcode.FINCONSTRUCT, 255 as Opcode,
  ])("keeps cell, pack, loop and unknown opcode %s outside the shared-body proof", opcode => {
    const r = triangle();
    r.body.instructions[0] = {...r.body.instructions[0]!, opcode};
    expect(r.shape()).toBeUndefined();
  });

  it.each([Opcode.CALL, Opcode.CALLFB])("requires closed input and output arity for opcode %s", opcode => {
    for (const open of ["b", "c"] as const) {
      const r = triangle();
      r.body.instructions[1] = {...r.body.instructions[1]!, opcode, [open]: 0};
      expect(r.shape()).toBeUndefined();
    }
  });
});

const fixture = (name: string) => readFileSync(new URL(`fixtures/shared-guards/${name}`, import.meta.url));
const manifest = JSON.parse(fixture("manifest.json").toString()) as {entries: Array<{
  name: string; profile: string; compilerRevision: string; source: string; sourceSha256: string;
  bytecode: string; sha256: string;
}>};
for (const entry of manifest.entries) {
  it(`preserves the shared-block boundary for ${entry.name}/${entry.profile}/${entry.compilerRevision.slice(0, 8)}`, () => {
    const bytes = fixture(entry.bytecode);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(entry.sha256);
    expect(createHash("sha256").update(fixture(entry.source)).digest("hex")).toBe(entry.sourceSha256);
    const result = decompile(bytes, {opcodeEncoding: "official", runtimeContext: false});
    if (!result.ok) throw new Error(result.error);
    expect(result.validation).toEqual([]);
    if (entry.name === "ordered-lookup") expect(result.source.match(/"selected"/g)).toHaveLength(1);
    if (entry.name === "loop-observations") expect(result.source.match(/"w"/g)).toHaveLength(1);
    // This second test invokes a closure that writes captured state. The
    // shared-guard proof must decline; the ordinary branches remain present.
    if (entry.name === "rejected-state") expect(result.source.match(/"selected"/g)).toHaveLength(2);
  });
}
