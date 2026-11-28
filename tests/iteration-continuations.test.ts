import {describe, expect, it} from "vitest";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {decompile} from "../src/decompile.ts";
import {computeLiveness} from "../src/dataflow/Liveness.ts";
import {analyzePrototype, findIterationContinuation} from "../src/reconstruct/Reconstructor.ts";
import {abc, ad, decode, Opcode, proto} from "./helpers.ts";

// The only function exit follows the three guards. Global post-dominance
// therefore chooses an earlier guard, even though a surviving iteration
// reaches the ADDK first and can visit that guard only after JUMPBACK.
function region() {
  const decoded = decode(proto({numParams: 3, maxStackSize: 5,
    constants: [{kind: "number", value: 1}],
    instructions: [
      ad(Opcode.LOADN, 3, 0),
      ad(Opcode.JUMPIFNOT, 0, 1),
      ad(Opcode.JUMP, 0, 6),
      abc(Opcode.NOP, 0, 0, 0),
      ad(Opcode.JUMPIFNOT, 1, 1),
      ad(Opcode.JUMP, 0, 3),
      ad(Opcode.JUMPIFNOT, 2, 1),
      ad(Opcode.JUMP, 0, 1),
      abc(Opcode.RETURN, 3, 2, 0),
      abc(Opcode.ADDK, 3, 3, 0),
      ad(Opcode.JUMPBACK, 0, -10),
    ],
  }));
  const ir = analyzePrototype(decoded.module.prototypes[0]!);
  const at = (pc: number) => ir.cfg.blocks[ir.cfg.blockOfPc.get(pc)!]!;
  const basic = at(1), selected = at(3).id, join = at(9).id;
  const loop = ir.loops.find(loop => loop.header === basic.id)!;
  const liveness = computeLiveness(ir.cfg);
  return {ir, at, basic, selected, join, loop, liveness,
    find: (emitted: ReadonlySet<number> = new Set()) =>
      findIterationContinuation(ir, basic, loop, selected, liveness, emitted)};
}

describe("same-iteration shared continuations", () => {
  it("uses the common surviving continuation before a later-iteration post-dominator", () => {
    const r = region();
    expect(r.ir.postDominators.ipdom[r.basic.id]).toBe(r.selected);
    expect(r.ir.ssa.phis.get(r.join) ?? []).toEqual([]);
    expect(r.find()).toBe(r.join);
  });

  it("retains a boundary whose arms already reach it within this iteration", () => {
    const r = region();
    expect(findIterationContinuation(r.ir, r.basic, r.loop, r.join, r.liveness)).toBeUndefined();
  });

  it("does not share already-consumed prefix work or an emitted continuation", () => {
    const r = region();
    expect(r.find(new Set([r.at(3).id]))).toBeUndefined();
    expect(r.find(new Set([r.join]))).toBeUndefined();
  });

  it("rejects a non-return escape around the continuation", () => {
    const r = region();
    const exit = r.at(8);
    exit.instructions = [{...exit.instructions[0]!, opcode: Opcode.BREAK}];
    expect(r.find()).toBeUndefined();
  });

  it("rejects a prefix cycle even when it is not a dominance backedge", () => {
    const r = region();
    r.at(6).successors.push(r.at(3).id);
    expect(r.find()).toBeUndefined();
  });

  it("does not cross another iteration region to stop inside its body", () => {
    const r = region();
    r.ir.loops.push({header: r.at(3).id, latch: r.join,
      blocks: [r.at(3).id, r.at(5).id, r.at(6).id, r.at(7).id, r.join],
      backEdges: [], kind: "numeric-for"});
    expect(r.find()).toBeUndefined();
  });

  it("requires every incoming value to retain its existing SSA owner", () => {
    const r = region();
    expect(r.liveness.liveIn[r.join]!.has(3)).toBe(true);
    r.at(3).instructions[0] = {...r.at(3).instructions[0]!, opcode: Opcode.MOVE, defs: [3], uses: [4]};
    expect(r.find()).toBeUndefined();
  });

  it("does not introduce a new phi boundary", () => {
    const r = region();
    r.ir.ssa.phis.set(r.join, [{value: 0, block: r.join, register: 3, operands: []}]);
    expect(r.find()).toBeUndefined();
  });

  it.each([
    Opcode.CAPTURE, Opcode.CLOSEUPVALS, Opcode.NEWCLOSURE, Opcode.DUPCLOSURE, Opcode.SETUPVAL,
    Opcode.CALL, Opcode.CALLFB, Opcode.NAMECALL, Opcode.NAMECALLUDATA, Opcode.GETVARARGS,
    Opcode.PREPVARARGS, Opcode.BREAK, Opcode.NATIVECALL, Opcode.NEWCLASSMEMBER, Opcode.NEWCLASS,
    Opcode.CONSTRUCT, Opcode.FINCONSTRUCT, Opcode.CMPPROTO, Opcode.FASTPCALL, 255 as Opcode,
    Opcode.NEWTABLE, Opcode.DUPTABLE, Opcode.SETTABLE, Opcode.SETUDATAKS, Opcode.SETLIST,
    Opcode.SETGLOBAL, Opcode.FORNPREP, Opcode.FORNLOOP, Opcode.FORGPREP, Opcode.FORGPREP_INEXT,
    Opcode.FORGPREP_NEXT, Opcode.FORGLOOP,
  ])("rejects cell, pack, effect, allocation or loop preparation opcode %s in the prefix", opcode => {
    const r = region();
    r.at(3).instructions[0] = {...r.at(3).instructions[0]!, opcode};
    expect(r.find()).toBeUndefined();
  });

  it("keeps a close at a terminal return outside the proof", () => {
    const r = region();
    r.at(8).instructions.unshift({...r.at(3).instructions[0]!, opcode: Opcode.CLOSEUPVALS});
    expect(r.find()).toBeUndefined();
  });
});

const fixture = (name: string) => readFileSync(new URL(`fixtures/iteration-continuations/${name}`, import.meta.url));
const manifest = JSON.parse(fixture("manifest.json").toString()) as {entries: Array<{
  name: string; profile: string; compilerRevision: string; source: string; sourceSha256: string;
  bytecode: string; sha256: string;
}>};

for (const entry of manifest.entries) {
  it(`preserves authored ${entry.name} at ${entry.profile} / ${entry.compilerRevision.slice(0, 8)}`, () => {
    const bytes = fixture(entry.bytecode);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(entry.sha256);
    expect(createHash("sha256").update(fixture(entry.source)).digest("hex")).toBe(entry.sourceSha256);
    const result = decompile(bytes, {opcodeEncoding: "official", runtimeContext: false});
    if (!result.ok) throw new Error(result.error);
    expect(result.validation).toEqual([]);
    if (entry.name === "primitive-prefix") {
      // There is one effect in the surviving CFG continuation. The first
      // unmodified reconstruction printed it in three different alternatives.
      expect(result.source.match(/"shared-step"/g)).toHaveLength(1);
    }
    if (entry.name === "shared-closure-tail") expect(result.source.match(/"shared-cell"/g)).toHaveLength(1);
  });
}
