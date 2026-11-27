import { computeDominators, computePostDominators } from "../cfg/Dominators.js";
import type { BasicBlock, ControlFlowGraph } from "../cfg/ControlFlowGraph.js";
import { decodeCodeStream, decodeInstructionWord, type DecodedInstruction } from "./DecodedInstruction.js";
import { encodeAd, encodeE, isFastCall, Opcode } from "./Opcode.js";
import { lineAt, type Prototype } from "./Prototype.js";

const genericPrep = (op: Opcode): boolean => op === Opcode.FORGPREP || op === Opcode.FORGPREP_INEXT || op === Opcode.FORGPREP_NEXT;
const jumpsAlways = (i: DecodedInstruction): boolean => i.opcode === Opcode.JUMP || i.opcode === Opcode.JUMPX ||
  i.opcode === Opcode.JUMPBACK || genericPrep(i.opcode) || (i.opcode === Opcode.LOADB && i.c !== 0);

/** Schedule shuffled basic blocks by graph regions, preserving every edge.
 * An arbitrary lexical scope interval cannot in general remain one interval
 * after permutation, so functions with local debug ranges retain their order.
 */
export function layoutControlFlow(proto: Prototype): Prototype {
  if (proto.locals.length || proto.instructions.length < 2) return proto;
  const insns = proto.instructions, leaders = new Set<number>([0]), glued = new Set<number>();
  for (let index = 0; index < insns.length; index++) {
    const insn = insns[index]!;
    if (insn.jumpTarget !== undefined && !isFastCall(insn.opcode) && insn.opcode !== Opcode.LOADB) leaders.add(insn.jumpTarget);
    if ((insn.jumpTarget !== undefined && !isFastCall(insn.opcode)) || insn.opcode === Opcode.RETURN) {
      const next = insns[index + 1]; if (next) leaders.add(next.pc);
    }
    if (insn.opcode === Opcode.CAPTURE || (index > 0 && insns[index - 1]!.opcode === Opcode.NAMECALL)) glued.add(insn.pc);
    if ((isFastCall(insn.opcode) || insn.opcode === Opcode.LOADB) && insn.jumpTarget !== undefined) {
      for (let at = index + 1; at < insns.length && insns[at]!.pc <= insn.jumpTarget; at++) glued.add(insns[at]!.pc);
    }
  }
  const blocks: BasicBlock[] = [], blockOfPc = new Map<number, number>();
  for (const insn of insns) {
    if (blocks.length === 0 || (leaders.has(insn.pc) && !glued.has(insn.pc))) {
      blocks.push({ id: blocks.length, startPc: insn.pc, endPc: insn.pc, instructions: [], successors: [], predecessors: [], unreachable: false });
    }
    const block = blocks.at(-1)!;
    block.instructions.push(insn); block.endPc = insn.pc + insn.width; blockOfPc.set(insn.pc, block.id);
  }
  for (const block of blocks) {
    const last = block.instructions.at(-1)!;
    if (!jumpsAlways(last) && last.opcode !== Opcode.RETURN) block.fallthrough = blockOfPc.get(block.endPc);
    if (last.jumpTarget !== undefined && !isFastCall(last.opcode)) block.branch = blockOfPc.get(last.jumpTarget);
    block.successors = [...new Set([block.fallthrough, block.branch].filter((id): id is number => id !== undefined))];
    for (const id of block.successors) blocks[id]!.predecessors.push(block.id);
  }
  const reachable = new Set<number>(), pending = [0];
  while (pending.length) { const id = pending.pop()!; if (reachable.has(id)) continue; reachable.add(id); pending.push(...blocks[id]!.successors); }
  for (const block of blocks) block.unreachable = !reachable.has(block.id);
  // Dead numeric iteration markers carry structural metadata for a live
  // FORNPREP. Leave their lexical placement intact until it can be paired.
  if (blocks.some(block => block.unreachable && block.instructions.some(insn => insn.opcode === Opcode.FORNLOOP))) return proto;
  const cfg: ControlFlowGraph = { prototype: proto, blocks, entry: 0,
    exits: blocks.filter(block => block.successors.length === 0).map(block => block.id), blockOfPc };
  const dom = computeDominators(cfg);
  // A backward acyclic edge proves that physical order is not execution order.
  if (!blocks.some(block => block.successors.some(id => id < block.id && !dom.dominates(id, block.id) &&
    block.instructions.at(-1)!.opcode !== Opcode.FORGLOOP))) return proto;
  const post = computePostDominators(cfg), seen = new Set<number>(), order: number[] = [];
  type Task = { id: number; stops: ReadonlySet<number>; append?: boolean };
  const work: Task[] = [{ id: 0, stops: new Set() }];
  while (work.length) {
    const task = work.pop()!;
    if (seen.has(task.id) || (!task.append && task.stops.has(task.id))) continue;
    const block = blocks[task.id]; if (!block) continue;
    seen.add(task.id); order.push(task.id);
    if (task.append) continue;
    const last = block.instructions.at(-1)!;
    if (genericPrep(last.opcode) && block.branch !== undefined) {
      const latch = blocks[block.branch]!;
      if (latch.instructions.at(-1)?.opcode === Opcode.FORGLOOP && latch.branch !== undefined &&
          latch.fallthrough !== undefined && !seen.has(latch.id)) {
        const stops = new Set([...task.stops, latch.id, latch.fallthrough]);
        work.push({ id: latch.fallthrough, stops: task.stops }, { id: latch.id, stops: task.stops, append: true }, { id: latch.branch, stops });
        continue;
      }
    }
    const join = post.ipdom[block.id];
    if (block.successors.length === 2 && join !== undefined && join >= 0 && join !== block.id && !seen.has(join)) {
      const stops = new Set([...task.stops, join]);
      work.push({ id: join, stops: task.stops });
      for (let i = block.successors.length - 1; i >= 0; i--) work.push({ id: block.successors[i]!, stops });
    } else {
      for (let i = block.successors.length - 1; i >= 0; i--) work.push({ id: block.successors[i]!, stops: task.stops });
    }
  }
  for (const block of blocks) if (!seen.has(block.id)) order.push(block.id);
  if (order.every((id, index) => id === index)) return proto;
  type Entry = { insn: DecodedInstruction; target?: number; origin?: number; continuation?: number };
  const entries: Entry[] = [], mapped = new Map<number, number>(), bridges = new Map<number, number>();
  let size = 0;
  for (let index = 0; index < order.length; index++) {
    const block = blocks[order[index]!]!;
    for (const insn of block.instructions) {
      mapped.set(insn.pc, size); size += insn.width;
      entries.push({ insn, target: insn.jumpTarget, origin: insn.pc, continuation: block.id });
    }
    if (block.fallthrough !== undefined && order[index + 1] !== block.fallthrough) {
      bridges.set(block.id, size);
      const insn = decodeInstructionWord(Uint32Array.of(encodeE(Opcode.JUMPX, 0)), 0, proto.constants.length);
      entries.push({ insn, target: blocks[block.fallthrough]!.startPc }); size++;
    }
  }
  mapped.set(proto.code.length, size);
  const words: number[] = [], lines: number[] = [];
  for (const entry of entries) {
    const { insn } = entry, pc = words.length;
    let word = insn.rawWord;
    if (entry.target !== undefined) {
      let target = mapped.get(entry.target);
      if (isFastCall(insn.opcode) && entry.continuation !== undefined) {
        const group = blocks[entry.continuation]!;
        if (entry.target === group.endPc && bridges.has(group.id)) target = bridges.get(group.id);
      }
      if (target === undefined) return proto;
      const offset = target - pc - 1;
      if (isFastCall(insn.opcode) || insn.opcode === Opcode.FINCONSTRUCT) {
        if (offset - 1 < 0 || offset - 1 > 255) return proto;
        word = (word & 0x00ffffff) | ((offset - 1) << 24);
      } else if (insn.opcode === Opcode.LOADB) {
        if (offset < 0 || offset > 255) return proto;
        word = (word & 0x00ffffff) | (offset << 24);
      } else if (insn.opcode === Opcode.JUMPX) word = encodeE(insn.opcode, offset);
      else {
        if (offset < -32768 || offset > 32767) return proto;
        word = encodeAd(insn.opcode, insn.a, offset);
      }
    }
    const line = entry.origin === undefined ? (lines.at(-1) ?? proto.lineDefined) : lineAt(proto, entry.origin) ?? proto.lineDefined;
    words.push(word >>> 0); lines.push(line);
    if (insn.width === 2) { words.push(insn.aux!); lines.push(line); }
  }
  const code = Uint32Array.from(words), instructions = decodeCodeStream(code, proto.constants.length);
  for (let index = 0; index < instructions.length; index++) {
    const insn = instructions[index]!, origin = entries[index]!;
    insn.originalPc = origin.insn.originalPc ?? origin.origin;
  }
  return { ...proto, code, instructions, lineInfo: proto.lineInfo ? {
    lineGapLog2: 0, deltas: new Uint8Array(lines.length),
    absolute: Int32Array.from(lines.map((line, index) => line - (lines[index - 1] ?? 0))),
  } : undefined,
    feedback: proto.feedback.map(item => ({ ...item, pc: mapped.get(item.pc) ?? item.pc })),
  };
}
