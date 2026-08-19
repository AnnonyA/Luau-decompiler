import { describe, expect, it } from "vitest";
import { buildControlFlowGraph } from "../src/cfg/ControlFlowGraph.ts";
import { computeDominators, computePostDominators } from "../src/cfg/Dominators.ts";
import { findNaturalLoops } from "../src/cfg/NaturalLoops.ts";
import { computeIfFollows, structureControlFlow } from "../src/cfg/Structure.ts";
import { buildSsa } from "../src/ssa/SsaBuilder.ts";
import { computeLiveness } from "../src/dataflow/Liveness.ts";
import { abc, ad, Opcode, decode, proto, ret } from "./helpers.ts";

function diamond() {
  return decode(
    proto({
      maxStackSize: 3,
      numParams: 1,
      instructions: [
        ad(Opcode.JUMPIFNOT, 0, 2),
        ad(Opcode.LOADN, 1, 1),
        ad(Opcode.JUMP, 0, 1),
        ad(Opcode.LOADN, 1, 2),
        abc(Opcode.RETURN, 1, 2, 0),
      ],
    }),
  ).module.prototypes[0]!;
}

describe("control-flow graph", () => {
  it("splits leaders at branches and join points", () => {
    const cfg = buildControlFlowGraph(diamond());
    expect(cfg.blocks.length).toBeGreaterThanOrEqual(4);
    expect(cfg.blocks[0]?.successors.length).toBe(2);
    expect(cfg.exits.length).toBeGreaterThan(0);
  });

  it("marks unreachable blocks", () => {
    const protoObj = decode(
      proto({
        instructions: [ad(Opcode.JUMP, 0, 2), ad(Opcode.LOADN, 0, 1), ret(), ret()],
      }),
    ).module.prototypes[0]!;
    const cfg = buildControlFlowGraph(protoObj);
    const dead = cfg.blocks.find((block) => block.instructions.some((insn) => insn.opcode === Opcode.LOADN));
    expect(dead?.unreachable).toBe(true);
  });

  it("computes dominators and a dominance frontier at the join", () => {
    const cfg = buildControlFlowGraph(diamond());
    const tree = computeDominators(cfg);
    expect(tree.idom[0]).toBe(0);
    const join = cfg.blocks.find((block) => block.predecessors.length === 2);
    expect(join).toBeTruthy();
    expect(tree.dominates(0, join!.id)).toBe(true);
    const frontierOwners = tree.dominanceFrontier.flatMap((frontier, id) => (frontier.includes(join!.id) ? [id] : []));
    expect(frontierOwners.length).toBeGreaterThan(0);
  });

  it("computes post-dominators for a diamond", () => {
    const cfg = buildControlFlowGraph(diamond());
    const post = computePostDominators(cfg);
    const exit = cfg.exits[0]!;
    expect(post.postDominates(exit, exit)).toBe(true);
  });

  it("finds a natural loop around JUMPBACK", () => {
    const protoObj = decode(
      proto({
        instructions: [ad(Opcode.LOADN, 0, 0), ad(Opcode.JUMPBACK, 0, -2), ret()],
      }),
    ).module.prototypes[0]!;
    const cfg = buildControlFlowGraph(protoObj);
    const loops = findNaturalLoops(cfg, computeDominators(cfg));
    expect(loops.length).toBeGreaterThan(0);
    expect(loops[0]?.kind === "infinite" || loops[0]?.blocks.length).toBeTruthy();
  });

  it("assigns an if-follow to every 2-way diamond", () => {
    const cfg = buildControlFlowGraph(diamond());
    const post = computePostDominators(cfg);
    const follows = computeIfFollows(cfg, post);
    const branch = cfg.blocks.find((block) => block.successors.length === 2);
    expect(branch).toBeTruthy();
    expect(follows.get(branch!.id)).toBeDefined();
  });

  it("structures a diamond as if-then-else and a JUMPBACK as a loop region", () => {
    const diamondCfg = buildControlFlowGraph(diamond());
    const diamondInfo = structureControlFlow(
      diamondCfg,
      computeDominators(diamondCfg),
      computePostDominators(diamondCfg),
      findNaturalLoops(diamondCfg, computeDominators(diamondCfg)),
    );
    expect(diamondInfo.regions.some((region) => region.kind === "if-then" || region.kind === "if-then-else")).toBe(true);

    const loopProto = decode(
      proto({
        instructions: [ad(Opcode.LOADN, 0, 0), ad(Opcode.JUMPBACK, 0, -2), ret()],
      }),
    ).module.prototypes[0]!;
    const loopCfg = buildControlFlowGraph(loopProto);
    const loopDom = computeDominators(loopCfg);
    const info = structureControlFlow(loopCfg, loopDom, computePostDominators(loopCfg), findNaturalLoops(loopCfg, loopDom));
    expect(info.regions.some((region) => region.kind === "infinite" || region.kind === "while" || region.kind === "repeat")).toBe(
      true,
    );
  });
});

describe("ssa", () => {
  it("versions a reused register instead of merging definitions", () => {
    const protoObj = decode(
      proto({
        instructions: [ad(Opcode.LOADN, 0, 1), ad(Opcode.LOADN, 0, 2), abc(Opcode.RETURN, 0, 2, 0)],
      }),
    ).module.prototypes[0]!;
    const cfg = buildControlFlowGraph(protoObj);
    const ssa = buildSsa(cfg, computeDominators(cfg));
    const versions = ssa.values.filter((value) => value.register === 0 && value.op.kind !== "undefined");
    expect(versions.length).toBeGreaterThanOrEqual(2);
    expect(new Set(versions.map((value) => value.version)).size).toBeGreaterThanOrEqual(2);
  });

  it("places a phi at a branch join for the same register", () => {
    const cfg = buildControlFlowGraph(diamond());
    const ssa = buildSsa(cfg, computeDominators(cfg));
    const phis = [...ssa.phis.values()].flat();
    expect(phis.some((phi) => phi.register === 1 && phi.operands.length >= 2)).toBe(true);
  });

  it("tracks def-use edges through renaming", () => {
    const protoObj = decode(
      proto({
        numParams: 1,
        instructions: [abc(Opcode.ADDK, 0, 0, 0), abc(Opcode.RETURN, 0, 2, 0)],
        constants: [{ kind: "number", value: 1 }],
      }),
    ).module.prototypes[0]!;
    const cfg = buildControlFlowGraph(protoObj);
    const ssa = buildSsa(cfg, computeDominators(cfg));
    const param = ssa.values.find((value) => value.op.kind === "parameter");
    expect(param).toBeTruthy();
    expect(param!.uses.length).toBeGreaterThan(0);
  });

  it("computes live-in for a used parameter", () => {
    const protoObj = decode(
      proto({
        numParams: 1,
        instructions: [abc(Opcode.RETURN, 0, 2, 0)],
      }),
    ).module.prototypes[0]!;
    const live = computeLiveness(buildControlFlowGraph(protoObj));
    expect(live.liveIn[0]?.has(0)).toBe(true);
  });
});
