import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import type { GenericForStatement } from "../src/ast/Ast.ts";
import { buildControlFlowGraph } from "../src/cfg/ControlFlowGraph.ts";
import { decompile } from "../src/decompile.ts";
import { decodeBytecode } from "../src/decode/Decoder.ts";
import { Opcode } from "../src/decode/Opcode.ts";
import { analyzePrototype } from "../src/reconstruct/Reconstructor.ts";
import { abc, ad, decode, proto, ret } from "./helpers.ts";

it.each([Opcode.FORGPREP, Opcode.FORGPREP_INEXT, Opcode.FORGPREP_NEXT])(
  "enters the iterator step without an edge to the physical neighbor (%s)", opcode => {
    const { module } = decode(proto({instructions: [
      ad(opcode, 0, 2), ret(), ret(), ad(Opcode.FORGLOOP, 0, 2), 2,
      ret(), abc(Opcode.MOVE, 5, 4, 0), ad(Opcode.JUMP, 0, -5),
    ]}));
    const cfg = buildControlFlowGraph(module.prototypes[module.mainProtoId]!);
    const prep = cfg.blocks[0]!;
    expect(prep.fallthrough).toBeUndefined();
    expect(prep.successors).toEqual([cfg.blockOfPc.get(3)]);
    expect(cfg.blocks[cfg.blockOfPc.get(1)!]!.unreachable).toBe(true);
  },
);

it.each(["O0g1", "O1g1", "O2g1", "O0g2", "O1g2", "O2g2"])(
  "reconstructs the iterator when its continuation precedes its body (%s)", profile => {
    const bytes = readFileSync(new URL(`./fixtures/generic-entry-layout/${profile}-shuffled.luauc`, import.meta.url));
    const module = decodeBytecode(bytes).module;
    const prototype = module.prototypes.find(prototype => prototype.debugName === "collect")!;
    const ir = analyzePrototype(prototype);
    const loop = ir.loops.find(loop => loop.kind === "generic-for")!;
    expect(loop).toBeDefined();
    expect(loop.header).toBeGreaterThan(loop.latch);
    expect(loop.blocks).not.toContain(ir.cfg.entry);
    const result = decompile(bytes);
    if (!result.ok) throw new Error(result.error);
    const visit = (node: unknown): GenericForStatement[] => {
      if (Array.isArray(node)) return node.flatMap(visit);
      if (!node || typeof node !== "object") return [];
      return [...((node as {kind?: string}).kind === "generic-for" ? [node as GenericForStatement] : []), ...Object.values(node).flatMap(visit)];
    };
    const emitted = visit(result.ast);
    expect(emitted).toHaveLength(1);
    expect(emitted[0]!.body.statements.some(statement => statement.kind === "compound-assign" &&
      statement.op === "+" && statement.value.kind === "identifier" && statement.value.name === emitted[0]!.names[1])).toBe(true);
  },
);
