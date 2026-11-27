import { layoutControlFlow } from "./ControlFlowLayout.js";
import { decodeCodeStream, type DecodedInstruction } from "./DecodedInstruction.js";
import { CaptureType, encodeAbc, encodeAd, encodeE, isFastCall, Opcode } from "./Opcode.js";
import { lineAt, type BytecodeModule, type LineInfo, type Prototype } from "./Prototype.js";
import type { LuauConstant } from "./Constant.js";

// Facts name VM registers, not source bindings. No heap values or library
// identities enter this lattice: comparisons may otherwise call metamethods.
type Scalar = null | boolean | number | string;
type Facts = Map<number, Scalar>;
const unknown = Symbol("unknown");
type Known = Scalar | typeof unknown;

/** Keep the decoder and public disassembly faithful to the supplied bytes. */
export function normalizeControlFlow(module: BytecodeModule): BytecodeModule {
  const prototypes = module.prototypes.map(prototype => {
    const compact = normalizePrototype(prototype);
    const laidOut = layoutControlFlow(compact);
    return laidOut === compact ? compact : normalizePrototype(laidOut);
  });
  return prototypes.some((prototype, index) => prototype !== module.prototypes[index])
    ? { ...module, prototypes } : module;
}

function constant(value: LuauConstant | undefined): Known {
  switch (value?.kind) {
    case "nil": return null;
    case "boolean": case "number": case "string": return value.value;
    default: return unknown;
  }
}
const truthy = (value: Scalar): boolean => value !== null && value !== false;
const same = (left: Scalar, right: Scalar): boolean => Object.is(left, right);

function resultOf(insn: DecodedInstruction, facts: Facts, proto: Prototype): Known {
  const b: Known = facts.has(insn.b) ? facts.get(insn.b)! : unknown;
  const c: Known = facts.has(insn.c) ? facts.get(insn.c)! : unknown;
  switch (insn.opcode) {
    case Opcode.LOADNIL: return null;
    case Opcode.LOADB: return insn.b !== 0;
    case Opcode.LOADN: return insn.d;
    case Opcode.LOADK: case Opcode.LOADKX: return constant(proto.constants[insn.constantIndex!]);
    case Opcode.MOVE: return b;
    case Opcode.NOT: return b === unknown ? unknown : !truthy(b);
    case Opcode.MINUS: return typeof b === "number" ? -b : unknown;
    case Opcode.AND: return b === unknown ? unknown : truthy(b) ? c : b;
    case Opcode.OR: return b === unknown ? unknown : truthy(b) ? b : c;
    case Opcode.ADD: case Opcode.SUB: case Opcode.MUL:
      if (typeof b !== "number" || typeof c !== "number") return unknown;
      return insn.opcode === Opcode.ADD ? b + c : insn.opcode === Opcode.SUB ? b - c : b * c;
    default: return unknown;
  }
}

function branchOf(insn: DecodedInstruction, facts: Facts, proto: Prototype): boolean | undefined {
  if (!facts.has(insn.a)) return undefined;
  const a = facts.get(insn.a)!;
  switch (insn.opcode) {
    case Opcode.JUMPIF: return truthy(a);
    case Opcode.JUMPIFNOT: return !truthy(a);
    case Opcode.JUMPIFEQ: case Opcode.JUMPIFNOTEQ: {
      if (!facts.has(insn.aux!)) return undefined;
      const equal = a === facts.get(insn.aux!);
      return insn.opcode === Opcode.JUMPIFEQ ? equal : !equal;
    }
    case Opcode.JUMPIFLE: case Opcode.JUMPIFLT: case Opcode.JUMPIFNOTLE: case Opcode.JUMPIFNOTLT: {
      const b = facts.get(insn.aux!);
      // Numeric comparisons retain NaN's actual unordered result. Strings
      // deliberately stay dynamic: Luau compares their encoded bytes.
      if (typeof a !== "number" || typeof b !== "number") return undefined;
      switch (insn.opcode) {
        case Opcode.JUMPIFLE: return a <= b;
        case Opcode.JUMPIFLT: return a < b;
        case Opcode.JUMPIFNOTLE: return !(a <= b);
        default: return !(a < b);
      }
    }
    case Opcode.JUMPXEQKNIL: case Opcode.JUMPXEQKB: case Opcode.JUMPXEQKN: case Opcode.JUMPXEQKS: {
      const b = insn.opcode === Opcode.JUMPXEQKNIL ? null : insn.opcode === Opcode.JUMPXEQKB
        ? (insn.aux! & 1) !== 0 : constant(proto.constants[insn.constantIndex!]);
      if (b === unknown) return undefined;
      const equal = a === b;
      return (insn.aux! & 0x80000000) !== 0 ? !equal : equal;
    }
    default: return undefined;
  }
}

function transfer(insn: DecodedInstruction, facts: Facts, proto: Prototype, captured: ReadonlySet<number>): void {
  const result = resultOf(insn, facts, proto);
  // Operations not proved primitive/inert can invoke a closure (including a
  // metamethod) that writes an open REF capture. Never propagate through it.
  const inert = result !== unknown || isInert(insn.opcode) ||
    (insn.opcode === Opcode.AND || insn.opcode === Opcode.OR || insn.opcode === Opcode.NOT);
  if (!inert) for (const register of captured) facts.delete(register);
  if (insn.call || (insn.opcode === Opcode.GETVARARGS && insn.b === 0)) {
    for (const register of facts.keys()) if (register >= insn.a) facts.delete(register);
  }
  for (const register of insn.defs) facts.delete(register);
  if (result !== unknown) facts.set(insn.a, result);
}

function isInert(opcode: Opcode): boolean {
  return opcode === Opcode.NOP || opcode === Opcode.COVERAGE || opcode === Opcode.PREPVARARGS ||
    opcode === Opcode.LOADNIL || opcode === Opcode.LOADB || opcode === Opcode.LOADN ||
    opcode === Opcode.LOADK || opcode === Opcode.LOADKX || opcode === Opcode.MOVE ||
    opcode === Opcode.JUMP || opcode === Opcode.JUMPX || opcode === Opcode.JUMPBACK ||
    opcode === Opcode.JUMPIF || opcode === Opcode.JUMPIFNOT || opcode === Opcode.RETURN ||
    opcode === Opcode.CAPTURE || opcode === Opcode.CLOSEUPVALS || isFastCall(opcode);
}

function unconditional(insn: DecodedInstruction): boolean {
  return insn.opcode === Opcode.JUMP || insn.opcode === Opcode.JUMPX || insn.opcode === Opcode.JUMPBACK ||
    insn.opcode === Opcode.FORGPREP || insn.opcode === Opcode.FORGPREP_INEXT || insn.opcode === Opcode.FORGPREP_NEXT ||
    (insn.opcode === Opcode.LOADB && insn.c !== 0);
}

function successors(insn: DecodedInstruction, next: number | undefined, decision?: boolean): number[] {
  if (insn.opcode === Opcode.RETURN) return [];
  if (insn.jumpTarget !== undefined && !isFastCall(insn.opcode)) {
    if (unconditional(insn) || decision === true) return [insn.jumpTarget];
    if (decision === false) return next === undefined ? [] : [next];
    return next === undefined ? [insn.jumpTarget] : [next, insn.jumpTarget];
  }
  return next === undefined ? [] : [next];
}

// An executable-edge constant propagation. Incoming states only lose facts as
// additional predecessors become executable; unknown branches retain both arms.
function constantsAt(proto: Prototype): Map<number, Facts> {
  const insns = proto.instructions, byPc = new Map(insns.map((insn, index) => [insn.pc, index]));
  // An unreachable numeric step can still carry a preparation's structural
  // exit through a locally constant guard. Analyze those marker paths with
  // no incoming facts as well. Extra unknown entries can only lose proofs;
  // actual reachability is still computed from the real function entry.
  const entries = [...new Set([insns[0]!.pc, ...insns.filter(insn => insn.opcode === Opcode.FORNLOOP).map(insn => insn.pc)])];
  const incoming = new Map<number, Facts>(entries.map(pc => [pc, new Map()]));
  const captured = new Set(insns.filter(insn => insn.capture?.type === CaptureType.REF).map(insn => insn.capture!.source));
  const work = [...entries], queued = new Set(work);
  let cursor = 0;
  // A bounded optimization may decline without changing reconstruction.
  let budget = Math.max(10000, insns.length * 256);
  while (cursor < work.length && --budget >= 0) {
    const pc = work[cursor++]!; queued.delete(pc);
    const index = byPc.get(pc)!;
    const insn = insns[index]!, state = new Map(incoming.get(pc)!);
    const decision = branchOf(insn, state, proto);
    transfer(insn, state, proto, captured);
    for (const target of successors(insn, insns[index + 1]?.pc, decision)) {
      if (!byPc.has(target)) continue;
      const previous = incoming.get(target);
      let changed = previous === undefined;
      if (previous === undefined) incoming.set(target, new Map(state));
      else for (const [register, value] of previous) {
        if (!state.has(register) || !same(value, state.get(register)!)) { previous.delete(register); changed = true; }
      }
      if (changed && !queued.has(target)) { work.push(target); queued.add(target); }
    }
  }
  return budget < 0 ? new Map() : incoming;
}

/** A top-bounded result tail depends on its producer, not on older scalars in
 * every higher frame slot. Retain that distinction only across a proved
 * transparent window; any write into the tail or ambiguous join declines. */
function openTailsAt(insns: DecodedInstruction[]): Map<number, number> {
  type Tail = { base: number; producer: number };
  const byPc = new Map(insns.map((insn, index) => [insn.pc, index]));
  const incoming = new Map<number, Tail | undefined>([[insns[0]!.pc, undefined]]);
  const transparent = new Set([Opcode.NOP, Opcode.COVERAGE, Opcode.MOVE, Opcode.LOADNIL, Opcode.LOADB,
    Opcode.LOADN, Opcode.LOADK, Opcode.LOADKX, Opcode.GETUPVAL, Opcode.GETIMPORT, Opcode.GETGLOBAL,
    Opcode.JUMP, Opcode.JUMPX, Opcode.JUMPIF, Opcode.JUMPIFNOT]);
  const work = [insns[0]!.pc], queued = new Set(work);
  let cursor = 0, budget = Math.max(10000, insns.length * 256);
  while (cursor < work.length && --budget >= 0) {
    const pc = work[cursor++]!; queued.delete(pc);
    const index = byPc.get(pc)!, insn = insns[index]!;
    let tail = incoming.get(pc);
    if (insn.call?.resultCount === "multret" || (insn.opcode === Opcode.GETVARARGS && insn.b === 0)) {
      tail = { base: insn.a, producer: pc };
    } else if (!tail || (!transparent.has(insn.opcode) && !isFastCall(insn.opcode)) ||
        insn.defs.some(register => register >= tail!.base)) tail = undefined;
    for (const target of successors(insn, insns[index + 1]?.pc)) {
      if (!byPc.has(target)) continue;
      const known = incoming.has(target), previous = incoming.get(target);
      const merged = !known ? tail : previous && tail && previous.base === tail.base && previous.producer === tail.producer ? previous : undefined;
      if (!known || merged !== previous) {
        incoming.set(target, merged);
        if (!queued.has(target)) { work.push(target); queued.add(target); }
      }
    }
  }
  return budget < 0 ? new Map() : new Map([...incoming].flatMap(([pc, tail]) => tail ? [[pc, tail.base]] : []));
}

/** Remove only dead register computations proved free of heap/frame effects.
 * Open argument/result windows participate in liveness, as do REF captures.
 */
function deadResults(proto: Prototype, insns: DecodedInstruction[], facts: Map<number, Facts>): Set<number> {
  const byPc = new Map(insns.map((insn, index) => [insn.pc, index]));
  const openTails = openTailsAt(insns);
  const captured = new Set(insns.filter(insn => insn.capture?.type === CaptureType.REF).map(insn => insn.capture!.source));
  const pure = insns.map(insn => insn.defs.length === 1 && !captured.has(insn.a) && insn.jumpTarget === undefined &&
    (resultOf(insn, facts.get(insn.pc) ?? new Map(), proto) !== unknown ||
      insn.opcode === Opcode.MOVE || insn.opcode === Opcode.NOT || insn.opcode === Opcode.AND || insn.opcode === Opcode.OR));
  const edges = insns.map((insn, index) => successors(insn, insns[index + 1]?.pc)
    .map(pc => byPc.get(pc)).filter((id): id is number => id !== undefined));
  const predecessors = insns.map(() => [] as number[]);
  edges.forEach((targets, id) => targets.forEach(target => predecessors[target]!.push(id)));
  const live = insns.map(() => new Set<number>()), work = insns.map((_, id) => id).reverse(), queued = new Set(work);
  const dead = new Set<number>();
  let cursor = 0, budget = Math.max(10000, insns.length * 256);
  while (cursor < work.length && --budget >= 0) {
    const id = work[cursor++]!; queued.delete(id);
    const insn = insns[id]!, out = new Set<number>();
    for (const target of edges[id]!) for (const register of live[target]!) out.add(register);
    if (pure[id] && !out.has(insn.a)) dead.add(insn.pc);
    else {
      dead.delete(insn.pc);
      // A fixed call definitely writes only its requested result slots. An
      // open pack may be empty: its abstract base definition does not prove
      // that any particular prior scalar register has been overwritten.
      const openResults = insn.call?.resultCount === "multret" || (insn.opcode === Opcode.GETVARARGS && insn.b === 0);
      if (!openResults) for (const register of insn.defs) out.delete(register);
      for (const register of insn.uses) out.add(register);
      const start = insn.call?.argumentCount === "multret" ? insn.a :
        insn.opcode === Opcode.RETURN && insn.b === 0 ? insn.a :
        insn.opcode === Opcode.SETLIST && insn.c === 0 ? insn.b : undefined;
      if (start !== undefined) {
        const tail = openTails.get(insn.pc);
        const end = tail !== undefined && tail >= start ? tail + 1 : proto.maxStackSize;
        for (let register = start; register < end; register++) out.add(register);
      }
    }
    if (out.size !== live[id]!.size || [...out].some(register => !live[id]!.has(register))) {
      live[id] = out;
      for (const previous of predecessors[id]!) if (!queued.has(previous)) { work.push(previous); queued.add(previous); }
    }
  }
  return budget < 0 ? new Set() : dead;
}

function normalizePrototype(proto: Prototype): Prototype {
  if (proto.instructions.length === 0) return proto;
  const facts = constantsAt(proto);
  if (facts.size === 0) return proto;
  const original = proto.instructions;
  const rewritten = original.map(insn => {
    const decision = branchOf(insn, facts.get(insn.pc) ?? new Map(), proto);
    if (decision !== undefined) {
      if (decision) return { ...insn, opcode: Opcode.JUMP, rawWord: encodeAd(Opcode.JUMP, 0, 0), width: 1, aux: undefined, uses: [], defs: [] };
      return { ...insn, opcode: Opcode.NOP, rawWord: 0, width: 1, aux: undefined, jumpTarget: undefined, uses: [], defs: [] };
    }
    if ((insn.opcode === Opcode.AND || insn.opcode === Opcode.OR) && insn.b === insn.c) {
      return { ...insn, opcode: Opcode.MOVE, rawWord: encodeAbc(Opcode.MOVE, insn.a, insn.b, 0) };
    }
    return insn;
  });
  const dead = deadResults(proto, rewritten, facts);
  for (let index = 0; index < rewritten.length; index++) {
    const insn = rewritten[index]!;
    if (dead.has(insn.pc)) rewritten[index] = { ...insn, opcode: Opcode.NOP, rawWord: 0, width: 1, aux: undefined,
      jumpTarget: undefined, uses: [], defs: [] };
  }
  const indexOf = new Map(original.map((insn, index) => [insn.pc, index]));
  // Short C-field skips are local instruction bundles. Preserve their landing
  // stub instead of threading it into a distant block and widening the bundle.
  const pinned = new Set(original.filter(insn => insn.opcode === Opcode.LOADB || isFastCall(insn.opcode))
    .flatMap(insn => insn.jumpTarget === undefined ? [] : [insn.jumpTarget]));
  const thread = (pc: number): number => {
    const seen = new Set<number>();
    while (!seen.has(pc) && !pinned.has(pc)) {
      seen.add(pc);
      const index = indexOf.get(pc), insn = index === undefined ? undefined : rewritten[index];
      if (!insn) break;
      if (insn.opcode === Opcode.NOP) { pc = original[index! + 1]?.pc ?? proto.code.length; continue; }
      if (insn.opcode === Opcode.JUMP || insn.opcode === Opcode.JUMPX) { pc = insn.jumpTarget!; continue; }
      break;
    }
    return pc;
  };
  for (let index = 0; index < rewritten.length; index++) {
    const insn = rewritten[index]!;
    if (insn.jumpTarget !== undefined && !isFastCall(insn.opcode)) {
      rewritten[index] = { ...insn, jumpTarget: thread(insn.jumpTarget) };
    }
  }
  const reachable = new Set<number>(), work = [original[0]!.pc];
  while (work.length) {
    const pc = work.pop()!;
    if (reachable.has(pc)) continue;
    const index = indexOf.get(pc);
    if (index === undefined) continue;
    reachable.add(pc);
    work.push(...successors(rewritten[index]!, original[index + 1]?.pc));
  }
  // Removing a jump that targets its lexical successor rejoins split open
  // result packs; CAPTURE, NAMECALL/CALL and the register protocol stay intact.
  const prepared = new Set(rewritten.filter(insn => reachable.has(insn.pc) && insn.opcode === Opcode.FORNPREP).map(insn => insn.a));
  // A body that always breaks can make FORNLOOP unreachable. Its register
  // protocol still describes the reachable FORNPREP; retain that metadata.
  const loopMarkers = new Set(rewritten.filter(insn => insn.opcode === Opcode.FORNLOOP && prepared.has(insn.a)).map(insn => insn.pc));
  const metadata = new Set(loopMarkers);
  for (const pc of loopMarkers) {
    // A shuffled dead step can fall through a dead jump stub to its exit.
    // Retaining the step alone would give it an unrelated physical successor
    // and erase the prep/step protocol needed by source reconstruction.
    let next = original[indexOf.get(pc)! + 1]?.pc;
    const seen = new Set<number>();
    while (next !== undefined && !reachable.has(next) && !seen.has(next)) {
      seen.add(next);
      const index = indexOf.get(next), insn = index === undefined ? undefined : rewritten[index];
      if (!insn || (insn.opcode !== Opcode.NOP && insn.opcode !== Opcode.JUMP && insn.opcode !== Opcode.JUMPX)) break;
      metadata.add(next);
      next = insn.opcode === Opcode.NOP ? original[index! + 1]?.pc : insn.jumpTarget;
    }
  }
  const live = rewritten.filter(insn => (reachable.has(insn.pc) || metadata.has(insn.pc)) &&
    (insn.opcode !== Opcode.NOP || pinned.has(insn.pc)));
  const kept = live.flatMap((insn, index) => {
    if ((insn.opcode !== Opcode.JUMP && insn.opcode !== Opcode.JUMPX) || insn.jumpTarget !== live[index + 1]?.pc) return [insn];
    if (!pinned.has(insn.pc)) return [];
    // A short-skip landing still owns its PC, but a jump to the following
    // instruction is semantically a NOP. Keeping it as a terminator would
    // split the enclosing FASTCALL/constructor region during reconstruction.
    return [{ ...insn, opcode: Opcode.NOP, rawWord: 0, width: 1, aux: undefined,
      jumpTarget: undefined, uses: [], defs: [] }];
  });
  // A pure jump cycle must remain a cycle, never become an empty function.
  if (kept.length === 0) return proto;
  const mapped = new Map<number, number>();
  let size = 0;
  for (const insn of kept) { mapped.set(insn.pc, size); size += insn.width; }
  mapped.set(proto.code.length, size);
  const newPc = (oldPc: number): number | undefined => mapped.get(oldPc) ?? mapped.get(thread(oldPc));
  const words: number[] = [], lines: number[] = [];
  for (const insn of kept) {
    const pc = words.length;
    let word = insn.rawWord;
    if (insn.jumpTarget !== undefined) {
      const target = newPc(insn.jumpTarget);
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
    words.push(word >>> 0); lines.push(lineAt(proto, insn.pc) ?? proto.lineDefined);
    if (insn.width === 2) { words.push(insn.aux!); lines.push(lineAt(proto, insn.pc + 1) ?? proto.lineDefined); }
  }
  const code = Uint32Array.from(words);
  if (code.length === proto.code.length && code.every((word, pc) => word === proto.code[pc])) return proto;
  const instructions = decodeCodeStream(code, proto.constants.length);
  for (let index = 0; index < instructions.length; index++) {
    const insn = instructions[index]!, origin = kept[index]!;
    insn.originalPc = origin.originalPc ?? origin.pc;
  }
  // Source-local intervals are monotonic in this pass. A deleted instruction
  // maps to the next retained boundary, not its jump destination.
  const boundary = (pc: number): number => {
    let low = 0, high = kept.length;
    while (low < high) { const mid = (low + high) >>> 1; if (kept[mid]!.pc < pc) low = mid + 1; else high = mid; }
    return low < kept.length ? mapped.get(kept[low]!.pc)! : size;
  };
  const lineInfo: LineInfo | undefined = proto.lineInfo ? {
    lineGapLog2: 0, deltas: new Uint8Array(lines.length),
    absolute: Int32Array.from(lines.map((line, index) => line - (lines[index - 1] ?? 0))),
  } : undefined;
  return { ...proto, code, instructions, lineInfo,
    locals: proto.locals.map(local => ({ ...local, startPc: boundary(local.startPc), endPc: boundary(local.endPc) })),
    feedback: proto.feedback.map(item => ({ ...item, pc: newPc(item.pc) ?? boundary(item.pc) })),
  };
}
