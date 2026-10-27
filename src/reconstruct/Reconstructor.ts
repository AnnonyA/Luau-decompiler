import type {
  BinaryOperator,
  Block,
  Expression,
  IfExpressionBranch,
  Statement,
  TableField,
} from "../ast/Ast.js";
import { block, ident, lit } from "../ast/Ast.js";
import { analyzeBindings, renameFreeBindings } from "../analysis/Bindings.js";
import { effectOf } from "../analysis/SideEffects.js";
import { buildControlFlowGraph, type BasicBlock, type ControlFlowGraph } from "../cfg/ControlFlowGraph.js";
import { computeDominators, computePostDominators, type DominatorTree, type PostDominatorTree } from "../cfg/Dominators.js";
import { findNaturalLoops, type NaturalLoop } from "../cfg/NaturalLoops.js";
import { structureControlFlow, type StructureInfo } from "../cfg/Structure.js";
import type { LuauConstant } from "../decode/Constant.js";
import type { DecodedInstruction } from "../decode/DecodedInstruction.js";
import { CaptureType, Opcode, isFastCall } from "../decode/Opcode.js";
import type { BytecodeModule, Prototype } from "../decode/Prototype.js";
import { buildSsa, type SsaFunction } from "../ssa/SsaBuilder.js";
import { NameAllocator, debugNameAt, isValidIdentifier, parameterNames } from "./Naming.js";
import { eventCallbackName, nameFromMethod, nameFromProperty } from "./RobloxSemantics.js";

export interface FunctionIr {
  cfg: ControlFlowGraph;
  dominators: DominatorTree;
  postDominators: PostDominatorTree;
  ssa: SsaFunction;
  loops: NaturalLoop[];
  structure: StructureInfo;
}

export function analyzePrototype(prototype: Prototype): FunctionIr {
  const cfg = buildControlFlowGraph(prototype);
  const dominators = computeDominators(cfg);
  const postDominators = computePostDominators(cfg);
  const ssa = buildSsa(cfg, dominators);
  const loops = findNaturalLoops(cfg, dominators);
  const structure = structureControlFlow(cfg, dominators, postDominators, loops);
  return { cfg, dominators, postDominators, ssa, loops, structure };
}

export interface ReconstructedFunction {
  name?: string;
  params: string[];
  isVararg: boolean;
  body: Block;
  ir: FunctionIr;
}

export interface CaptureBinding {
  /** The local name the child should use for this upvalue. */
  name?: string;
  /** Expression to inline for immutable (VAL) captures. */
  expression?: Expression;
  /** REF capture: the child may assign to the upvalue. */
  mutable: boolean;
}

export interface ChildContext {
  allocator: NameAllocator;
  captures: Map<number, CaptureBinding>;
}

export function reconstructFunction(
  module: BytecodeModule,
  proto: Prototype,
  parentContext?: ChildContext,
): ReconstructedFunction {
  const ir = analyzePrototype(proto);
  const globals = new Set<string>();
  for (const prototype of module.prototypes) {
    for (const insn of prototype.instructions) {
      if (insn.opcode === Opcode.GETGLOBAL || insn.opcode === Opcode.SETGLOBAL) {
        const constant = prototype.constants[insn.aux ?? 0];
        if (constant?.kind === "string") globals.add(constant.value);
      }
    }
    for (const constant of prototype.constants) {
      if (constant.kind === "import" && constant.path[0]) globals.add(constant.path[0]);
    }
  }
  const allocator = parentContext?.allocator ?? new NameAllocator(globals);
  const builder = new SourceBuilder(module, proto, ir, allocator, parentContext?.captures ?? new Map());
  return {
    name: proto.debugName,
    params: builder.params,
    isVararg: proto.isVararg,
    body: block(builder.build()),
    ir,
  };
}

interface Binding {
  name?: string;
  expression: Expression;
  pinned: boolean;
  /** An identifier borrowed from another register/global is readable, not an
   * assignment target when this register is reused for a different value. */
  alias?: boolean;
  methodSelf?: number;
  /** The binding was created from a literal nil (LOADNIL). */
  nilLiteral?: boolean;
  /** Placeholder created so a later NEWCLOSURE can reuse this name. */
  forwardRef?: boolean;
}

interface PendingTable {
  register: number;
  fields: TableField[];
  nested: Array<{ field: { name?: string; key?: Expression }; child: PendingTable }>;
  startPc: number;
  role: string;
  flushed: boolean;
  name?: string;
}

/** Mutable state of a pending table, for dry-run rollback. */
interface PendingSnapshot {
  pending: PendingTable;
  fields: TableField[];
  nested: PendingTable["nested"];
  flushed: boolean;
  name?: string;
}

interface ValuePath {
  guards: Expression[];
  value?: Expression;
}

class SourceBuilder {
  readonly params: string[] = [];
  private readonly env = new Map<number, Binding>();
  private readonly emitted = new Set<number>();
  private readonly loopsByHeader = new Map<number, NaturalLoop[]>();
  private readonly loopVisitKeys = new Map<NaturalLoop, number>();
  /** Blocks that are the exit (follow) of some natural loop. */
  private readonly loopFollows = new Set<number>();
  /** Loops whose AST is currently being emitted. Break/continue are only valid here. */
  private readonly emittingLoops: NaturalLoop[] = [];
  private readonly consumed = new Set<number>();
  private readonly phiNames = new Map<string, string>();
  private readonly phiInputs = new Map<number, string[]>();
  private readonly phiFamilies = new Map<string, Set<string>>();
  private readonly loopPhiNames = new Map<string, string>();
  private readonly declaredPhis = new Set<string>();
  /** Loop phis whose incoming value is never read (`blockId:register`). */
  private readonly deadLoopPhis = new Set<string>();
  private readonly scopeStack: Array<Set<string>> = [new Set()];
  private readonly openPacks = new Set<number>();
  private readonly fallbackCalls = new Set<number>();
  private pendingStack: PendingTable[] = [];
  /** Closure locals that are assigned to a table field: used for method lifting. */
  private readonly closureFields = new Map<
    string,
    { fieldName: string; tableRegister: number; fn: Expression; params: string[]; isVararg: boolean }
  >();
  private readonly mainProto: Prototype | undefined;
  /** Repeated loads of a capture-free constant within one effect-free block. */
  private readonly sharedClosureConstants = new Map<number, {pc: number; name: string}>();

  constructor(
    private readonly module: BytecodeModule,
    private readonly proto: Prototype,
    private readonly ir: FunctionIr,
    private readonly allocator: NameAllocator,
    private readonly captures: Map<number, CaptureBinding> = new Map(),
  ) {
    for (const [index, loop] of ir.loops.entries()) {
      const siblings = this.loopsByHeader.get(loop.header) ?? [];
      siblings.push(loop);
      siblings.sort((a, b) => b.blocks.length - a.blocks.length);
      this.loopsByHeader.set(loop.header, siblings);
      this.loopVisitKeys.set(loop, -index - 1);
    }
    const requiredLoopPhis = new Set<string>();
    for (const loop of ir.loops) {
      const follow = this.loopFollow(loop);
      if (follow !== undefined) {
        this.loopFollows.add(follow);
      }
      // Phis for the for-loop machinery registers (FORNLOOP/FORGLOOP defs) and
      // phis whose incoming value is never read are dead: a later reuse of the
      // register must not inherit a name from the loop.
      const loopVarRegisters = new Set<number>();
      for (const insn of ir.cfg.blocks[loop.latch]?.instructions ?? []) {
        if (insn.opcode === Opcode.FORNLOOP || insn.opcode === Opcode.FORGLOOP) {
          for (const register of insn.defs) {
            loopVarRegisters.add(register);
          }
        }
      }
      for (const blockId of [loop.header, loop.latch]) {
        for (const phi of ir.ssa.phis.get(blockId) ?? []) {
          const key = `phi:${blockId}:${phi.register}`;
          if (loopVarRegisters.has(phi.register) || this.isDeadLoopPhi(loop, phi.register)) {
            this.deadLoopPhis.add(key);
          } else {
            requiredLoopPhis.add(key);
          }
        }
      }
    }
    // Shared headers can carry an inner loop's mutable iterator variable.
    // Being control machinery for the outer loop does not kill that phi.
    for (const key of requiredLoopPhis) this.deadLoopPhis.delete(key);
    // Phi-to-phi edges carry the same register value across nested joins.
    // Destruct these connected phis into one lexical binding, declared at
    // the enclosing split, rather than unrelated locals in each arm.
    for (const phis of ir.ssa.phis.values()) {
      for (const phi of phis) {
        const key = `phi:${phi.block}:${phi.register}`;
        if (this.deadLoopPhis.has(key)) continue;
        let family = this.phiFamilies.get(key) ?? new Set([key]);
        this.phiFamilies.set(key, family);
        for (const operand of phi.operands) {
          const incoming = ir.ssa.values[operand.value];
          if (incoming?.op.kind !== "phi" || incoming.register !== phi.register) continue;
          const other = `phi:${incoming.block}:${incoming.register}`;
          if (this.deadLoopPhis.has(other)) continue;
          const merged = this.phiFamilies.get(other) ?? new Set([other]);
          if (family === merged) continue;
          family = new Set([...family, ...merged]);
          for (const member of family) this.phiFamilies.set(member, family);
        }
      }
    }
    for (const phis of ir.ssa.phis.values()) for (const phi of phis) {
      const key = `phi:${phi.block}:${phi.register}`;
      if (this.deadLoopPhis.has(key)) continue;
      for (const operand of phi.operands) {
        const keys = this.phiInputs.get(operand.value) ?? [];
        keys.push(key);
        this.phiInputs.set(operand.value, keys);
      }
    }
    this.mainProto = module.prototypes[module.mainProtoId];
    const names = parameterNames(proto, this.allocator, fallbackParam);
    for (let i = 0; i < names.length; i++) {
      const name = names[i]!;
      this.params.push(name);
      this.declareInScope(name);
      this.env.set(i, { name, expression: ident(name), pinned: true });
    }
    this.fallbackCalls = this.collectFallbackCalls();
    this.indexSharedClosureConstants();
  }

  private indexSharedClosureConstants(): void {
    const loads = new Map<number, DecodedInstruction[]>();
    for (const insn of this.proto.instructions) {
      if (insn.opcode !== Opcode.DUPCLOSURE) continue;
      const constant = this.proto.constants[insn.d];
      const child = constant?.kind === "closure" ? this.module.prototypes[constant.protoId] : undefined;
      if (!child || child.numUpvalues !== 0) continue;
      const sites = loads.get(insn.d) ?? [];
      sites.push(insn);
      loads.set(insn.d, sites);
    }
    const inert = new Set([Opcode.NOP, Opcode.MOVE, Opcode.LOADNIL, Opcode.LOADB, Opcode.LOADN, Opcode.LOADK, Opcode.LOADKX]);
    for (const [constant, sites] of loads) {
      if (sites.length < 2) continue;
      const first = sites[0]!, last = sites.at(-1)!;
      const home = this.ir.cfg.blockOfPc.get(first.pc);
      if (home === undefined || sites.some(s => this.ir.cfg.blockOfPc.get(s.pc) !== home)) continue;
      // Calls/metamethods can change environments. Share only within a straight
      // interval of loads/copies, and keep creation at the first original site.
      const interval = this.ir.cfg.blocks[home]!.instructions.filter(i => i.pc > first.pc && i.pc < last.pc);
      if (interval.some(i => !inert.has(i.opcode) && !(i.opcode === Opcode.DUPCLOSURE && loads.has(i.d)))) continue;
      this.sharedClosureConstants.set(constant, {pc: first.pc, name: this.allocator.reserve("sharedFunction")});
    }
  }

  /** Index of the first decoded instruction strictly after the given pc.
   * Instructions are ordered by bytecode pc, including AUX-width opcodes.
   * Binary search avoids rescanning the entire function for every closure
   * and FASTCALL fallback.
   */
  private firstInstructionAfter(pc: number): number {
    const instructions = this.proto.instructions;
    let low = 0;
    let high = instructions.length;
    while (low < high) {
      const middle = low + Math.floor((high - low) / 2);
      if (instructions[middle]!.pc <= pc) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }
    return low;
  }

  /** CALL/CALLFB instructions that are the slow-path fallbacks of a preceding
   * FASTCALL* jump. Their uses must not count as real uses (double counting). */
  private collectFallbackCalls(): Set<number> {
    const fallbacks = new Set<number>();
    const instructions = this.proto.instructions;
    for (const insn of instructions) {
      if (!isFastCallLike(insn.opcode) || insn.jumpTarget === undefined) {
        continue;
      }
      const target = insn.jumpTarget;
      for (let i = this.firstInstructionAfter(insn.pc); i < instructions.length; i++) {
        const other = instructions[i]!;
        if (other.pc >= target) {
          break;
        }
        if (other.opcode === Opcode.CALL || other.opcode === Opcode.CALLFB) {
          fallbacks.add(other.pc);
        }
      }
    }
    return fallbacks;
  }

  build(): Statement[] {
    return this.emitRange(0, undefined, new Set());
  }

  // ------------------------------------------------------------------ scopes

  private pushScope(): void {
    this.scopeStack.push(new Set());
  }

  private popScope(): void {
    this.scopeStack.pop();
  }

  private declareInScope(name: string): void {
    this.scopeStack[this.scopeStack.length - 1]!.add(name);
  }

  private isDeclaredInScope(name: string): boolean {
    for (const scope of this.scopeStack) {
      if (scope.has(name)) {
        return true;
      }
    }
    return false;
  }

  // ------------------------------------------------------------- block walk

  private emitRange(start: number, stop: number | undefined, visited: Set<number>): Statement[] {
    const statements: Statement[] = [];
    let current: number | undefined = start;
    while (current !== undefined && current !== stop) {
      if (visited.has(current) || this.emitted.has(current)) {
        break;
      }
      const activeLoop = this.currentLoop();
      if (activeLoop && current === this.loopFollow(activeLoop)) {
        // A nested conditional may have its own follow beyond this region.
        // Crossing the enclosing loop exit is a break, never permission to
        // emit the post-loop statements inside one alternative.
        statements.push({ kind: "break" });
        break;
      }
      const block = this.ir.cfg.blocks[current];
      if (!block || block.unreachable) {
        break;
      }
      const loop = this.loopsByHeader.get(current)?.find(candidate => !visited.has(this.loopVisitKeys.get(candidate)!));
      if (loop) {
        visited.add(this.loopVisitKeys.get(loop)!);
        statements.push(...this.emitLoop(loop, visited));
        current = this.loopFollow(loop);
        continue;
      }
      const preparedLoop = this.preparedLoop(block);
      if (preparedLoop && !visited.has(this.loopVisitKeys.get(preparedLoop)!)) {
        statements.push(...this.emitStraight(block));
        visited.add(this.loopVisitKeys.get(preparedLoop)!);
        statements.push(...this.emitLoop(preparedLoop, visited));
        current = this.loopFollow(preparedLoop);
        continue;
      }
      const branch = this.tryIf(block, stop, visited);
      if (branch) {
        statements.push(...branch.statements);
        current = branch.follow;
        continue;
      }
      statements.push(...this.emitStraight(block));
      if (activeLoop && block.id === activeLoop.latch &&
          (activeLoop.kind === "numeric-for" || activeLoop.kind === "generic-for")) {
        // Reaching the iterator latch ends this iteration. In a branch
        // whose join is elsewhere, implicit fallthrough would execute that
        // other region instead of advancing the iterator.
        statements.push({ kind: "continue" });
        break;
      }
      if (block.successors.length === 0) {
        break;
      }
      if (block.successors.length === 1) {
        const successor = block.successors[0]!;
        const loop = this.currentLoop();
        const last = block.instructions.at(-1);
        if (loop && last?.opcode === Opcode.JUMP) {
          if (successor === loop.header || this.isPureLoopLatch(successor, loop)) {
            statements.push({ kind: "continue" });
            break;
          }
          if (!loop.blocks.includes(successor)) {
            statements.push({ kind: "break" });
            current = undefined;
            continue;
          }
        }
        // A pure control stub that jumps to the loop we are emitting is a
        // `break`, even when it is not part of the natural loop (blocks that
        // never reach the latch are excluded from the loop body).
        if (
          last?.opcode === Opcode.JUMP &&
          successor === stop &&
          stop !== undefined &&
          loop !== undefined &&
          this.loopFollow(loop) === stop &&
          block.instructions.every((insn) => isControlOnly(insn.opcode))
        ) {
          statements.push({ kind: "break" });
          current = undefined;
          continue;
        }
        current = successor;
        continue;
      }
      // FORGPREP blocks have two successors (header and the FORGLOOP latch that
      // handles the first iteration); the emission continues at the header.
      if (isGenericPrep(block.instructions.at(-1)?.opcode)) {
        current = block.fallthrough;
        continue;
      }
      break;
    }
    return statements;
  }

  // ------------------------------------------------------------------ loops

  private emitLoop(loop: NaturalLoop, visited: Set<number>): Statement[] {
    this.emittingLoops.push(loop);
    const entryEnv = new Map(this.env);
    try {
      const statements = this.emitStructuredLoop(loop, visited);
      const written = new Set(loop.blocks.flatMap(id => this.ir.cfg.blocks[id]!.instructions.flatMap(insn => insn.defs)));
      const follow = this.loopFollow(loop);
      const merged = new Set((follow === undefined ? [] : this.ir.ssa.phis.get(follow) ?? []).map(phi => phi.register));
      // Terminal alternatives are not natural-loop members: their register
      // writes cannot leak into the normal exit. Preserve the entry value
      // of registers unchanged by every completing iteration, unless an
      // exit phi explicitly merges a break-path definition.
      for (const [register, binding] of entryEnv) {
        if (!written.has(register) && !merged.has(register)) this.env.set(register, binding);
      }
      return statements;
    } finally {
      this.emittingLoops.pop();
    }
  }

  private emitStructuredLoop(loop: NaturalLoop, visited: Set<number>): Statement[] {
    const header = this.ir.cfg.blocks[loop.header]!;
    const declarations = this.hoistLoopPhis(loop);
    this.pushScope();
    try {
      if (loop.kind === "numeric-for") {
        return [...declarations, this.emitNumericFor(loop, header, visited)];
      }
      if (loop.kind === "generic-for") {
        return [...declarations, this.emitGenericFor(loop, header, visited)];
      }
      if (loop.kind === "repeat") {
        return [...declarations, this.emitRepeat(loop, header, visited)];
      }
      const last = header.instructions.at(-1);
      let test: Expression = lit(true);
      let bodyStart = loop.header;
      const headerSetup: Statement[] = [];
      const exitSetup: Statement[] = [];
      if (loop.kind !== "infinite" && last && isCompare(last.opcode) && header.successors.length === 2) {
        // while: the header test jumps to the exit when true, so the loop test is its negation
        this.consumed.add(last.pc);
        const bodyCandidate = header.successors.find((id) => loop.blocks.includes(id) && id !== loop.header);
        if (bodyCandidate !== undefined) {
          bodyStart = bodyCandidate;
        }
        headerSetup.push(...this.emitStraight(header));
        // Either edge can enter the body (e.g. while true / if not value
        // then break). Derive polarity from that edge, not bytecode layout.
        test = this.conditionFrom(last, bodyCandidate === header.fallthrough);
        const exit = header.successors.find(id => !loop.blocks.includes(id));
        const follow = this.loopFollow(loop);
        if (exit !== undefined && follow !== undefined && exit !== follow) {
          // Inlined returns may join after a normal-exit fallback assignment.
          // Execute that region only when the entry test fails, not on break.
          this.declareJoinPhis(follow, declarations, 1);
          const savedEnv = new Map(this.env);
          exitSetup.push(...this.emitRange(exit, follow, new Set(visited)));
          this.env.clear();
          for (const [register, binding] of savedEnv) this.env.set(register, binding);
        }
      }
      const body =
        loop.kind === "infinite"
          ? this.emitRange(loop.header, this.loopFollow(loop), new Set(visited))
          : this.emitLoopBody(loop, visited, bodyStart, bodyStart === loop.header ? undefined : loop.header);
      if (headerSetup.length > 0 || exitSetup.length > 0) {
        // These instructions belong to the header's backedge, not its preheader.
        // Materialized calls and register writes must run before EVERY test.
        return [...declarations, { kind: "while", test: lit(true), body: block([
          ...headerSetup,
          { kind: "if", test: { kind: "unary", op: "not", argument: test }, consequent: block([...exitSetup, { kind: "break" }]), branches: [] },
          ...body,
        ]) }];
      }
      return [...declarations, { kind: "while", test, body: block(body) }];
    } finally {
      // Deferred register expressions cannot refer to locals whose loop
      // scope has ended. Keep only bindings owned by an enclosing scope.
      const leaving = this.scopeStack.at(-1)!;
      for (const [register, binding] of this.env) {
        const free = analyzeBindings(block([{ kind: "expression-stmt", expression: binding.expression }])).globals;
        if ([...free].some(name => leaving.has(name))) this.env.delete(register);
      }
      this.popScope();
    }
  }

  private emitRepeat(loop: NaturalLoop, header: BasicBlock, visited: Set<number>): Statement {
    const testBlockId = loop.testBlock ?? loop.latch;
    const testBlock = this.ir.cfg.blocks[testBlockId]!;
    const last = testBlock.instructions.at(-1);
    if (last && isCompare(last.opcode)) {
      this.consumed.add(last.pc);
    }
    const body =
      loop.header === loop.latch
        ? this.emitStraight(header)
        : this.emitRange(loop.header, this.loopFollow(loop), new Set(visited));
    const test =
      last && isCompare(last.opcode)
        ? this.conditionFrom(last, testBlockId === loop.latch && testBlock.branch === loop.header)
        : lit(false);
    return { kind: "repeat", body: block(body), test };
  }

  /** Reuse a live pinned local in this register instead of minting a new phi name. */
  private existingPhiName(register: number): string | undefined {
    const binding = this.env.get(register);
    if (binding?.name && binding.pinned && !binding.alias && this.isDeclaredInScope(binding.name)) {
      return binding.name;
    }
    return undefined;
  }

  private hoistLoopPhis(loop: NaturalLoop): Statement[] {
    const statements: Statement[] = [];
    const controlRegisters = new Set(this.ir.cfg.blocks[loop.latch]!.instructions
      .filter(insn => insn.opcode === Opcode.FORGLOOP || insn.opcode === Opcode.FORNLOOP)
      .flatMap(insn => insn.defs));
    const namesByRegister = new Map<number, string>();
    for (const blockId of [loop.header, loop.latch]) {
      for (const phi of this.ir.ssa.phis.get(blockId) ?? []) {
        const key = `phi:${blockId}:${phi.register}`;
        if (this.deadLoopPhis.has(key) || controlRegisters.has(phi.register)) {
          continue;
        }
        const name =
          namesByRegister.get(phi.register) ??
          this.loopPhiNames.get(`${blockId}:${phi.register}`) ??
          this.existingPhiName(phi.register) ??
          this.phiNameFor(key, phi.register, this.ir.cfg.blocks[blockId]!.startPc);
        namesByRegister.set(phi.register, name);
        this.loopPhiNames.set(`${blockId}:${phi.register}`, name);
        this.setPhiName(key, name);
        if (this.declaredPhis.has(key) || this.isDeclaredInScope(name)) {
          this.declaredPhis.add(key);
          this.env.set(phi.register, { name, expression: ident(name), pinned: true });
          continue;
        }
        this.declaredPhis.add(key);
        // A latch phi may merge values defined during this iteration rather
        // than carry a value from entry. It still needs an outer declaration,
        // but evaluating a stale incoming register can access a dead scope.
        const incoming = this.isDeadLoopPhi(loop, phi.register, false)
          ? undefined : this.env.get(phi.register)?.expression;
        statements.push({ kind: "local", names: [name], values: incoming ? [incoming] : [] });
        this.declareInScope(name);
        this.env.set(phi.register, { name, expression: ident(name), pinned: true });
      }
    }
    return statements;
  }

  /** Whether the loop redefines `register` before anything reads its incoming
   * value, making the phi's entry value dead. */
  private isDeadLoopPhi(loop: NaturalLoop, register: number, includeLatch = true): boolean {
    // An entry value is dead only if every reachable path overwrites it
    // before any read. Linear pc order misses conditional writes and values
    // consumed after a zero-iteration loop.
    const pending = includeLatch ? [loop.header, loop.latch] : [loop.header];
    // Even when every iteration kills the entry value, its final definition
    // needs an outer binding if the continuation reads it (including zero
    // iterations). Do not confuse a dead input with a dead lexical binding.
    const follow = this.loopFollow(loop);
    if (follow !== undefined) pending.push(follow);
    const visited = new Set<number>();
    while (pending.length) {
      const id = pending.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const basic = this.ir.cfg.blocks[id];
      if (!basic || basic.unreachable) continue;
      let killed = false;
      for (const insn of basic.instructions) {
        if (insn.uses.includes(register) && !isFakeUse(insn.opcode)) return false;
        if (insn.defs.includes(register)) { killed = true; break; }
      }
      if (!killed) pending.push(...basic.successors);
    }
    return true;
  }

  private emitLoopBody(loop: NaturalLoop, visited: Set<number>, start: number, skipHeader?: number): Statement[] {
    const inner = new Set(visited);
    if (skipHeader !== undefined) {
      inner.add(skipHeader);
    }
    const follow = this.loopFollow(loop);
    return this.emitRange(start, follow, inner);
  }

  private preparedLoop(block: BasicBlock): NaturalLoop | undefined {
    const last = block.instructions.at(-1);
    if (last?.opcode !== Opcode.FORNPREP || block.fallthrough === undefined) {
      return undefined;
    }
    const loop = this.loopsByHeader.get(block.fallthrough)?.find(loop => loop.kind === "numeric-for");
    return loop?.kind === "numeric-for" ? loop : undefined;
  }

  private numericForPrep(loop: NaturalLoop): DecodedInstruction | undefined {
    for (const block of this.ir.cfg.blocks) {
      const last = block.instructions.at(-1);
      if (last?.opcode === Opcode.FORNPREP && block.fallthrough === loop.header) {
        return last;
      }
    }
    return undefined;
  }

  /** Whether `register` is a result (or the self copy) of the call expression
   * in slot `base` of a generic-for. */
  private callDefinedSlot(base: number, register: number): boolean {
    for (const insn of this.proto.instructions) {
      if ((insn.opcode === Opcode.NAMECALL || insn.opcode === Opcode.CALL || insn.opcode === Opcode.CALLFB) && insn.a === base && insn.defs.includes(register)) {
        return true;
      }
    }
    return false;
  }

  private genericForPrep(loop: NaturalLoop): DecodedInstruction | undefined {
    for (const block of this.ir.cfg.blocks) {
      for (const insn of block.instructions) {
        if (
          insn.opcode === Opcode.FORGPREP ||
          insn.opcode === Opcode.FORGPREP_INEXT ||
          insn.opcode === Opcode.FORGPREP_NEXT
        ) {
          const target = insn.jumpTarget;
          if (target === undefined) {
            continue;
          }
          const targetBlock = this.ir.cfg.blockOfPc.get(target);
          if (targetBlock === loop.header || targetBlock === loop.latch) {
            return insn;
          }
        }
      }
    }
    return undefined;
  }

  private emitNumericFor(loop: NaturalLoop, header: BasicBlock, visited: Set<number>): Statement {
    const prep = this.numericForPrep(loop) ?? header.instructions[0];
    const base = prep?.a ?? 0;
    const start = this.readRegister(base + 2, prep);
    const stop = this.readRegister(base, prep);
    const stepExpr = this.readRegister(base + 1, prep);
    const name = this.bindLocal(base + 2, prep?.pc ?? header.startPc, "index");
    const step = isLiteralOne(stepExpr) ? undefined : stepExpr;
    const follow = this.loopFollow(loop);
    const body = this.emitRange(loop.header, follow, new Set(visited));
    // The for-loop registers are dead once the loop ends; drop the bindings so
    // a later reuse of the same register starts with a fresh name.
    this.env.delete(base);
    this.env.delete(base + 1);
    this.env.delete(base + 2);
    return { kind: "numeric-for", name, start, stop, step, body: block(body) };
  }

  private emitGenericFor(loop: NaturalLoop, header: BasicBlock, visited: Set<number>): Statement {
    const latch = this.ir.cfg.blocks[loop.latch]!;
    const loopInsn =
      latch.instructions.find((insn) => insn.opcode === Opcode.FORGLOOP) ??
      header.instructions.find((insn) => insn.opcode === Opcode.FORGLOOP) ??
      header.instructions.at(-1);
    const prep = this.genericForPrep(loop);
    const base = loopInsn?.a ?? 0;
    const count = loopInsn?.aux !== undefined ? loopInsn.aux & 0xff : 2;
    const names: string[] = [];
    const followId = this.loopFollow(loop);
    const followPc = followId !== undefined ? this.ir.cfg.blocks[followId]?.startPc : undefined;
    for (let i = 0; i < count; i++) {
      const register = base + 3 + i;
      if (this.useCountInRange(register, header.startPc, followPc) === 0) {
        // The variable is never read in the body: emit `_` like the source did.
        this.env.set(register, { name: "_", expression: ident("_"), pinned: true });
        names.push("_");
        continue;
      }
      names.push(this.bindLocal(register, loopInsn?.pc ?? header.startPc, i === 0 ? "key" : "value"));
    }
    let iterators: Expression[];
    if (prep?.opcode === Opcode.FORGPREP_INEXT || prep?.opcode === Opcode.FORGPREP_NEXT) {
      iterators = [this.readRegister(base, prep)];
    } else {
      const slots = [base, base + 1, base + 2];
      iterators = slots.map((register) => this.readRegister(register, prep));
      // The compiler emits `nil, nil, <expr>` for `for ... in <expr>`; drop the
      // trailing slots that are nil-valued so the loop reads like the source.
      while (iterators.length > 1 && this.env.get(slots[iterators.length - 1]!)?.nilLiteral) {
        iterators.pop();
      }
      // A call expression (`for ... in f() do`) fills the state/control slots
      // with its trailing results (and a method call with its self); they can
      // be dropped because re-evaluating `f()` yields the same slots.
      const first = iterators[0];
      if (iterators.length > 1 && (first?.kind === "call" || first?.kind === "method-call")) {
        while (iterators.length > 1 && this.callDefinedSlot(base, slots[iterators.length - 1]!)) {
          iterators.pop();
        }
      }
    }
    const follow = this.loopFollow(loop);
    const body = this.emitRange(loop.header, follow, new Set(visited));
    // The for-loop registers are dead once the loop ends; drop the bindings so
    // a later reuse of the same register starts with a fresh name.
    for (let i = 0; i < count; i++) {
      this.env.delete(base + 3 + i);
    }
    return { kind: "generic-for", names, iterators, body: block(body) };
  }

  private loopFollow(loop: NaturalLoop): number | undefined {
    const structured = this.ir.structure.loopFollowByLoop.get(loop);
    if (structured !== undefined) {
      return structured;
    }
    const header = this.ir.cfg.blocks[loop.header];
    if (header) {
      const ipdom = this.ir.postDominators.ipdom[loop.header];
      if (ipdom !== undefined && ipdom >= 0 && ipdom < this.ir.cfg.blocks.length && !loop.blocks.includes(ipdom) && ipdom !== loop.header) {
        return ipdom;
      }
    }
    const outside: number[] = [];
    for (const id of loop.blocks) {
      for (const succ of this.ir.cfg.blocks[id]?.successors ?? []) {
        if (!loop.blocks.includes(succ)) {
          outside.push(succ);
        }
      }
    }
    return outside.sort((a, b) => a - b)[0];
  }

  private currentLoop(): NaturalLoop | undefined {
    return this.emittingLoops.at(-1);
  }

  private innermostLoopContaining(blockId: number): NaturalLoop | undefined {
    return this.ir.loops
      .filter((loop) => loop.blocks.includes(blockId))
      .sort((left, right) => left.blocks.length - right.blocks.length)[0];
  }

  private isPureLoopLatch(blockId: number, loop: NaturalLoop): boolean {
    if (blockId !== loop.latch) {
      return false;
    }
    const instructions = this.ir.cfg.blocks[blockId]?.instructions ?? [];
    return instructions.every((insn) => isControlOnly(insn.opcode));
  }

  // ------------------------------------------------------------- if handling

  private tryIf(
    basic: BasicBlock,
    stop: number | undefined,
    visited: Set<number>,
  ): { statements: Statement[]; follow: number | undefined } | undefined {
    const last = basic.instructions.at(-1);
    if (!last || this.consumed.has(last.pc) || !isCompare(last.opcode) || basic.successors.length !== 2) {
      return undefined;
    }
    const thenId = basic.fallthrough;
    const elseId = basic.branch;
    if (thenId === undefined || elseId === undefined) {
      return undefined;
    }
    const activeLoop = this.currentLoop();

    // Boolean assignment pattern: `r = <comparison>` compiled through a
    // JUMP + two LOADB blocks (`r = true/false` on each side).
    const booleanAssign = this.tryBooleanAssign(basic, thenId, elseId, last);
    if (booleanAssign) {
      return booleanAssign;
    }

    if (activeLoop) {
      const thenLatch = this.isPureLoopLatch(thenId, activeLoop);
      const elseLatch = this.isPureLoopLatch(elseId, activeLoop);
      if (thenLatch || elseLatch) {
        this.consumed.add(last.pc);
        const statements = this.emitStraight(basic);
        const other = thenLatch ? elseId : thenId;
        const exits = other === this.loopFollow(activeLoop);
        statements.push({
          kind: "if",
          test: this.conditionFrom(last, exits ? !thenLatch : thenLatch),
          consequent: block([{ kind: exits ? "break" : "continue" }]),
          branches: [],
        });
        return { statements, follow: exits ? (thenLatch ? thenId : elseId) : other };
      }
      if (elseId === activeLoop.header) {
        this.consumed.add(last.pc);
        const statements = this.emitStraight(basic);
        statements.push({
          kind: "if",
          test: this.conditionFrom(last, false),
          consequent: block([{ kind: "continue" }]),
          branches: [],
        });
        return { statements, follow: thenId };
      }
      const thenInside = activeLoop.blocks.includes(thenId);
      const elseInside = activeLoop.blocks.includes(elseId);
      if (thenInside !== elseInside) {
        // One arm leaves the loop we are emitting. The follow may be a RETURN
        // (zero successors); that is still `break`, not a wrapping if.
        const outsideId = thenInside ? elseId : thenId;
        const outsideBlock = this.ir.cfg.blocks[outsideId];
        const follow = this.loopFollow(activeLoop);
        const exitsLoop =
          outsideId === follow ||
          (outsideBlock !== undefined &&
            outsideBlock.instructions.every((insn) => isControlOnly(insn.opcode)) &&
            outsideBlock.successors.length > 0 &&
            outsideBlock.successors.every((id) => !activeLoop.blocks.includes(id)));
        if (exitsLoop) {
          const jumpExits = thenInside;
          this.consumed.add(last.pc);
          const statements = this.emitStraight(basic);
          statements.push({
            kind: "if",
            test: this.conditionFrom(last, !jumpExits),
            consequent: block([{ kind: "break" }]),
            branches: [],
          });
          return { statements, follow: thenInside ? thenId : elseId };
        }
      }
    }

    const join = this.joinOf(basic);
    if (join === undefined) {
      // Terminal branch: emit the if without a follow; both arms end on their own.
      this.consumed.add(last.pc);
      const statements = this.emitStraight(basic);
      const test = this.conditionFrom(last, true);
      const branchEnv = new Map(this.env);
      const branchEmitted = new Set(this.emitted);
      const branchConsumed = new Set(this.consumed);
      const branchPhis = new Map(this.phiNames);
      const branchDeclared = new Set(this.declaredPhis);
      this.pushScope();
      const consequent = block(this.emitRange(thenId, stop, new Set(visited)));
      this.popScope();
      // With no post-dominating join, shared terminal regions belong to both
      // alternatives. Emission and register state in one arm cannot suppress
      // a return (or supply a value) in the other.
      this.env.clear();
      for (const [register, binding] of branchEnv) this.env.set(register, binding);
      this.emitted.clear();
      for (const id of branchEmitted) this.emitted.add(id);
      this.consumed.clear();
      for (const pc of branchConsumed) this.consumed.add(pc);
      this.phiNames.clear();
      for (const [key, name] of branchPhis) this.setPhiName(key, name);
      this.declaredPhis.clear();
      for (const key of branchDeclared) this.declaredPhis.add(key);
      this.pushScope();
      const alternateStmts = this.emitRange(elseId, stop, new Set(visited));
      this.popScope();
      statements.push({
        kind: "if",
        test,
        consequent,
        branches: [],
        alternate: alternateStmts.length > 0 ? block(alternateStmts) : undefined,
      });
      return { statements, follow: undefined };
    }

    const valueIf = this.tryValueIf(basic, thenId, elseId, join, last);
    if (valueIf) {
      return valueIf;
    }

    this.consumed.add(last.pc);
    const statements = this.emitStraight(basic);
    this.declareJoinPhis(join, statements);
    const test = this.conditionFrom(last, true);
    const branchEnv = new Map(this.env);
    const branchEmitted = new Set(this.emitted);
    const branchConsumed = new Set(this.consumed);
    this.pushScope();
    const consequent = block(this.emitRange(thenId, join, new Set(visited)));
    this.popScope();
    this.env.clear();
    for (const [register, binding] of branchEnv) this.env.set(register, binding);
    this.emitted.clear();
    for (const id of branchEmitted) this.emitted.add(id);
    this.consumed.clear();
    for (const pc of branchConsumed) this.consumed.add(pc);
    this.pushScope();
    const alternateStmts = this.emitRange(elseId, join, new Set(visited));
    this.popScope();
    // Only the split's live bindings and the join's phis survive both arms.
    // Branch-local temporaries have no lexical ownership after the join.
    this.env.clear();
    for (const [register, binding] of branchEnv) this.env.set(register, binding);
    for (const phi of this.ir.ssa.phis.get(join) ?? []) {
      const name = this.phiNames.get(`phi:${join}:${phi.register}`);
      if (name && this.isDeclaredInScope(name)) this.env.set(phi.register, { name, expression: ident(name), pinned: true });
    }
    const ifStmt: Statement = {
      kind: "if",
      test,
      consequent,
      branches: [],
      alternate: alternateStmts.length > 0 ? block(alternateStmts) : undefined,
    };
    // Fuse `if a then <if b then X end> end` into `if a and b then X end`.
    const fused = fuseGuardChain(ifStmt);
    return { statements: [...statements, fused], follow: join };
  }

  private joinOf(basic: BasicBlock): number | undefined {
    if (basic.fallthrough === undefined || basic.branch === undefined) {
      return undefined;
    }
    const structured = this.ir.structure.ifFollow.get(basic.id);
    const ipdom = structured ?? this.ir.postDominators.ipdom[basic.id];
    const loop = this.currentLoop() ?? this.innermostLoopContaining(basic.id);
    if (ipdom !== undefined && ipdom >= 0 && ipdom < this.ir.cfg.blocks.length && ipdom !== basic.id) {
      if (!loop || loop.blocks.includes(ipdom)) {
        return ipdom;
      }
      // The immediate post-dominator leaves the loop (e.g. a break in one
      // branch); the structural join is where the non-exiting flows merge.
      return this.commonJoin(basic.fallthrough, basic.branch, undefined) ?? ipdom;
    }
    // Reachability alone does not establish a join: an alternative may
    // return before reaching that block. Terminal regions have no follow.
    return loop ? this.commonJoin(basic.fallthrough, basic.branch, undefined) : undefined;
  }

  private commonJoin(a: number, b: number, stop: number | undefined): number | undefined {
    const distances = (start: number): Map<number, number> => {
      const result = new Map<number, number>();
      const pending: Array<[number, number]> = [[start, 0]];
      while (pending.length > 0) {
        const [current, distance] = pending.shift()!;
        if (result.has(current)) {
          continue;
        }
        result.set(current, distance);
        if (current === stop) {
          continue;
        }
        for (const successor of this.ir.cfg.blocks[current]?.successors ?? []) {
          if (!this.ir.dominators.dominates(successor, current)) {
            pending.push([successor, distance + 1]);
          }
        }
      }
      return result;
    };
    const fromA = distances(a);
    const fromB = distances(b);
    const joins = [...fromA.keys()].filter((id) => fromB.has(id));
    joins.sort((left, right) => {
      const leftMax = Math.max(fromA.get(left)!, fromB.get(left)!);
      const rightMax = Math.max(fromA.get(right)!, fromB.get(right)!);
      return leftMax - rightMax || fromA.get(left)! + fromB.get(left)! - fromA.get(right)! - fromB.get(right)!;
    });
    return joins[0];
  }

  private declareJoinPhis(join: number, statements: Statement[], outerScopes = 0): void {
    for (const phi of this.ir.ssa.phis.get(join) ?? []) {
      const key = `phi:${join}:${phi.register}`;
      const established = this.phiNames.get(key);
      const reused = established && this.isDeclaredInScope(established)
        ? established : this.existingPhiName(phi.register);
      if (reused) {
        this.setPhiName(key, reused);
        this.declaredPhis.add(key);
        continue;
      }
      const name = this.phiNameFor(key, phi.register, this.ir.cfg.blocks[join]!.startPc);
      if (!this.declaredPhis.has(key) && !this.isDeclaredInScope(name)) {
        this.declaredPhis.add(key);
        statements.push({ kind: "local", names: [name], values: [] });
        this.scopeStack[this.scopeStack.length - 1 - outerScopes]!.add(name);
      }
      // The phi name is bound by the branch defines themselves (phiBinding
      // consults the join's phi); pre-setting it here would make a temporary
      // define inside a branch (e.g. GETIMPORT before CALL) reuse the name.
    }
  }

  private setPhiName(key: string, name: string): void {
    for (const member of this.phiFamilies.get(key) ?? [key]) this.phiNames.set(member, name);
  }

  private phiNameFor(key: string, register: number, pc: number, reuse = true): string {
    const existing = this.phiNames.get(key);
    if (existing) {
      return existing;
    }
    const blockMatch = /^phi:(\d+):(\d+)$/.exec(key);
    if (blockMatch) {
      const loopName = this.loopPhiNames.get(`${blockMatch[1]}:${blockMatch[2]}`);
      if (loopName) {
        this.phiNames.set(key, loopName);
        return loopName;
      }
    }
    const reused = reuse ? this.existingPhiName(register) : undefined;
    if (reused) {
      this.setPhiName(key, reused);
      return reused;
    }
    const debug = debugNameAt(this.proto, register, pc);
    const name = this.allocator.reserve(debug ?? "result");
    this.setPhiName(key, name);
    return name;
  }

  // ------------------------------------------- boolean pattern (LOADB pairs)

  private tryBooleanAssign(
    basic: BasicBlock,
    thenId: number,
    elseId: number,
    last: DecodedInstruction,
  ): { statements: Statement[]; follow: number | undefined } | undefined {
    const thenBlock = this.ir.cfg.blocks[thenId];
    const elseBlock = this.ir.cfg.blocks[elseId];
    if (!thenBlock || !elseBlock) {
      return undefined;
    }
    const thenInsn = thenBlock.instructions[0];
    const elseInsn = elseBlock.instructions[0];
    if (
      thenBlock.instructions.length !== 1 ||
      elseBlock.instructions.length !== 1 ||
      thenInsn?.opcode !== Opcode.LOADB ||
      elseInsn?.opcode !== Opcode.LOADB ||
      thenInsn.a !== elseInsn.a ||
      thenInsn.b === elseInsn.b
    ) {
      return undefined;
    }
    const join = this.joinOf(basic);
    if (join === undefined) {
      return undefined;
    }
    // The fallthrough (then) block runs when the jump condition is false.
    // A failed boolean pattern is speculative just like a value-if. Its
    // prelude may have reused key/value registers or materialized tables.
    // Restore all of that state before ordinary statement reconstruction.
    const savedEnv = new Map(this.env);
    const savedOpen = new Set(this.openPacks);
    const savedConsumed = new Set(this.consumed);
    const savedPending = [...this.pendingStack];
    const savedPendingState = this.snapshotPendings();
    const savedNames = this.allocator.snapshot();
    const savedScopes = this.scopeStack.map(scope => new Set(scope));
    const savedPhiNames = new Map(this.phiNames);
    const savedDeclaredPhis = new Set(this.declaredPhis);
    const walk = this.walkGuardBlock(basic, thenInsn.a);
    if (!walk) {
      this.restoreValueIf(savedEnv, savedOpen, savedConsumed, savedPending,
        savedPendingState, savedNames, savedScopes, savedPhiNames, savedDeclaredPhis);
      return undefined;
    }
    const thenValue = thenInsn.b !== 0;
    const jumpCond = this.conditionFrom(last, false);
    const expr: Expression = thenValue ? { kind: "unary", op: "not", argument: jumpCond } : jumpCond;
    this.consumed.add(last.pc);
    const usedAfterJoin = this.usedAfterPc(this.ir.cfg.blocks[join]!.startPc, thenInsn.a);
    const mergedName = this.phiNameFor(`phi:${join}:${thenInsn.a}`, thenInsn.a, this.ir.cfg.blocks[join]!.startPc);
    const statements = [...walk.statements, ...this.define(thenInsn.a, expr, last, usedAfterJoin, mergedName)];
    return { statements, follow: join };
  }

  // ------------------------------------------------- short-circuit values

  private tryValueIf(
    basic: BasicBlock,
    thenId: number,
    elseId: number,
    join: number,
    last: DecodedInstruction,
  ): { statements: Statement[]; follow: number | undefined } | undefined {
    const phis = this.ir.ssa.phis.get(join);
    if (!phis || phis.length !== 1) {
      return undefined;
    }
    const t = phis[0]!.register;
    // A comparison that skips an assignment is not a truthiness selection
    // of the destination register. Keep its statements and condition intact.
    if (elseId === join &&
        (last.a !== t || (last.opcode !== Opcode.JUMPIF && last.opcode !== Opcode.JUMPIFNOT))) {
      return undefined;
    }
    const savedEnv = new Map(this.env);
    const savedOpen = new Set(this.openPacks);
    const savedConsumed = new Set(this.consumed);
    const savedPending = [...this.pendingStack];
    const savedPendingState = this.snapshotPendings();
    const savedNames = this.allocator.snapshot();
    const savedScopes = this.scopeStack.map((scope) => new Set(scope));
    // Failed speculative paths must roll back cached phi bindings together
    // with the name allocator; otherwise a subsequent value may reuse a name.
    const savedPhiNames = new Map(this.phiNames);
    const savedDeclaredPhis = new Set(this.declaredPhis);
    // The value the guard tests before any define inside the block runs.
    const condReg = this.readRegister(last.a, last);

    // Walk the guard block itself: it may hold the value (e.g. `t = x or y`)
    // while its other statements are ordinary prelude statements.
    const basicWalk = this.walkGuardBlock(basic, t);
    if (!basicWalk) {
      this.restoreValueIf(savedEnv, savedOpen, savedConsumed, savedPending, savedPendingState, savedNames, savedScopes, savedPhiNames, savedDeclaredPhis);
      return undefined;
    }
    const basicValue = basicWalk.value;
    // The value `t` carries when the jump is taken: the guard block's define,
    // or the pre-existing binding when the block only tests the register.
    const guardValue = basicValue ?? condReg;
    // Branch dry runs reuse temporary registers, including BOTH operands of
    // the comparison. Capture the guard after its prelude, before either arm.
    const guardTest = this.conditionFrom(last, true);
    const guardEnv = new Map(this.env);
    const restoreGuardEnv = (): void => {
      this.env.clear();
      for (const [register, binding] of guardEnv) this.env.set(register, binding);
    };

    const thenPath = this.walkValuePath(thenId, join, t, elseId);
    if (!thenPath || (thenPath.value === undefined && basicValue === undefined)) {
      this.restoreValueIf(savedEnv, savedOpen, savedConsumed, savedPending, savedPendingState, savedNames, savedScopes, savedPhiNames, savedDeclaredPhis);
      return undefined;
    }
    // Both alternatives start with the values at the split. In particular an
    // in-place update in one arm must not become the input of the other arm.
    restoreGuardEnv();
    const elseValue =
      elseId === join
        ? // The taken branch lands directly on the join: it carries the value
          // `t` had at the guard (`t = <cond> or <fallback>`).
          guardValue
        : this.buildElseValue(elseId, join, t);
    if (elseValue === undefined) {
      this.restoreValueIf(savedEnv, savedOpen, savedConsumed, savedPending, savedPendingState, savedNames, savedScopes, savedPhiNames, savedDeclaredPhis);
      return undefined;
    }

    const thenValue = thenPath.value ?? basicValue!;
    const orForm =
      thenPath.guards.length === 0 &&
      (sameExpr(thenValue, condReg) || (basicValue !== undefined && last.a === t && sameExpr(thenValue, basicValue)));
    const andForm =
      !orForm && thenPath.guards.length === 0 && thenPath.value !== undefined && sameExpr(elseValue, condReg);
    let expr: Expression;
    if (elseId === join && thenPath.guards.length === 0 && thenPath.value !== undefined) {
      // `JUMPIF t -> join`: the taken branch reuses the guard's value, so the
      // result is `t or <fallback>` (short-circuit).
      expr = { kind: "binary", op: last.opcode === Opcode.JUMPIFNOT ? "and" : "or", left: guardValue, right: thenValue };
    } else if (orForm) {
      expr = { kind: "binary", op: "or", left: thenValue, right: elseValue };
    } else if (andForm) {
      expr = { kind: "binary", op: "and", left: condReg, right: thenValue };
    } else if (thenPath.guards.length > 0) {
      const test = foldAnd([guardTest, ...thenPath.guards]);
      const lastGuardInsn = thenPath.lastGuardBlock?.instructions.at(-1);
      const lastGuardReg =
        lastGuardInsn && lastGuardInsn.a === t
          ? thenValue
          : this.conditionRegisterOf(thenPath.lastGuardBlock);
      if (lastGuardReg !== undefined && sameExpr(thenValue, lastGuardReg)) {
        expr = { kind: "binary", op: "or", left: test, right: elseValue };
      } else {
        expr = makeIfExpr(test, thenValue, elseValue);
      }
    } else {
      expr = makeIfExpr(guardTest, thenValue, elseValue);
    }

    this.consumed.add(last.pc);
    // Restore the scope mutated by the dry runs; the final define declares the
    // value local (or assigns to an already-declared phi) in the true scope.
    this.scopeStack.length = 0;
    for (const scope of savedScopes) {
      this.scopeStack.push(new Set(scope));
    }
    // Guard preludes are retained statements, so their declarations survive
    // successful speculation. Only declarations from discarded value arms
    // must be rolled back.
    for (const statement of basicWalk.statements) {
      if (statement.kind === "local") statement.names.forEach(name => this.declareInScope(name));
      if (statement.kind === "function-decl" && statement.local) this.declareInScope(statement.name);
    }
    const usedAfterJoin = this.usedAfterPc(this.ir.cfg.blocks[join]!.startPc, t);
    restoreGuardEnv();
    const mergedName = this.phiNameFor(`phi:${join}:${t}`, t, this.ir.cfg.blocks[join]!.startPc);
    const statements = [...basicWalk.statements, ...this.define(t, expr, last, usedAfterJoin, mergedName)];
    return { statements, follow: join };
  }

  /** Whether `register` is read (by a real use) at or after `pc`. */
  private usedAfterPc(pc: number, register: number): boolean {
    for (const insn of this.proto.instructions) {
      if (insn.pc < pc) {
        continue;
      }
      if (insn.uses.includes(register) && !isFakeUse(insn.opcode)) {
        return true;
      }
    }
    return false;
  }

  /** Walk a value-if guard block: keep ordinary statements, capture the last
   * define of `t` (the value on the fallthrough path). */
  private walkGuardBlock(basic: BasicBlock, t: number): { statements: Statement[]; value?: Expression } | undefined {
    const pendingSnapshot = this.snapshotPendings();
    const statements: Statement[] = [];
    let value: Expression | undefined;
    this.inDryRun = true;
    const fail = (): undefined => {
      this.inDryRun = false;
      this.restorePendings(pendingSnapshot);
      return undefined;
    };
    for (const insn of basic.instructions) {
      if (this.consumed.has(insn.pc) || isControlOnly(insn.opcode) || insn === basic.instructions.at(-1)) {
        continue;
      }
      const target = this.writeTargetOf(insn);
      if (target === undefined) {
        // Mirror emitStraight: a table used by a non-write instruction (e.g. a
        // call argument) must be materialized before it is read.
        statements.push(...this.flushObserved(insn));
      }
      if (insn.defs.includes(t)) {
        // Registers are reused; only the last define before the guard is the
        // value, but earlier definitions must not carry side effects we drop.
        const before = new Map(this.env);
        const produced = this.interpret(insn, target);
        // Alias snapshots are real prelude statements. A scalar value path
        // cannot absorb them by taking the first statement's initializer.
        if (produced.statements.length > 1) return fail();
        if (value !== undefined && produced.statements.length > 0) {
          return fail();
        }
        const captured = captureDefine(produced.statements, t) ?? this.capturedEnvDiff(before, t);
        if (captured === undefined) {
          return fail();
        }
        // The assignment is removed from the prelude, so subsequent reads
        // must see its captured value, not the old local occupying this slot.
        value = captured;
        this.env.set(t, { expression: captured, pinned: false });
        continue;
      }
      const before = new Map(this.env);
      const produced = this.interpret(insn, target);
      if (produced.pendingTable) {
        this.pendingStack.push(produced.pendingTable);
        continue;
      }
      if (produced.statements.length > 0) {
        statements.push(...produced.statements);
      } else if (insn.defs.length > 0 && this.capturedEnvDiff(before, insn.a) === undefined) {
        return fail();
      }
    }
    // Match emitStraight at the guard boundary: fields already written
    // must capture their values before either branch reuses a register.
    for (const pending of [...this.pendingStack].reverse()) {
      if (!pending.flushed) statements.push(...this.flushPending(pending));
    }
    this.inDryRun = false;
    return { statements, value };
  }

  private conditionRegisterOf(block: BasicBlock | undefined): Expression | undefined {
    if (!block) {
      return undefined;
    }
    const last = block.instructions.at(-1);
    return last && isCompare(last.opcode) ? this.readRegister(last.a, last) : undefined;
  }

  private walkValuePath(
    start: number,
    join: number,
    t: number,
    outerFallback: number,
  ): { guards: Expression[]; value?: Expression; lastGuardBlock?: BasicBlock } | undefined {
    const guards: Expression[] = [];
    let current = start;
    let lastGuard: BasicBlock | undefined;
    let seen = new Set<number>();
    while (current !== undefined && current !== join) {
      if (seen.has(current)) {
        return undefined;
      }
      seen.add(current);
      const block = this.ir.cfg.blocks[current];
      if (!block || block.unreachable) {
        return undefined;
      }
      const last = block.instructions.at(-1);
      if (last && isCompare(last.opcode) && block.successors.length === 2) {
        if (block.branch === outerFallback && !this.blockDefines(block, t)) {
          if (!this.dryRunBlock(block, t, () => undefined)) {
            return undefined;
          }
          guards.push(this.conditionFrom(last, true));
          lastGuard = block;
          current = block.fallthrough!;
          continue;
        }
        if (block.fallthrough === outerFallback) {
          const value = this.blockValue(block, join, t);
          if (value === undefined) {
            return undefined;
          }
          // The jump tests the value register itself: use the captured value
          // as the guard (a phi name bound during the dry run must not leak
          // into the expression).
          guards.push(last.a === t ? value : this.conditionFrom(last, false));
          lastGuard = block;
          return { guards, value, lastGuardBlock: block };
        }
        return undefined;
      }
      const value = this.blockValue(block, join, t);
      return value !== undefined ? { guards, value, lastGuardBlock: lastGuard } : undefined;
    }
    return { guards, value: undefined, lastGuardBlock: lastGuard };
  }

  private buildElseValue(start: number, join: number, t: number): Expression | undefined {
    const block = this.ir.cfg.blocks[start];
    if (!block || block.unreachable) {
      return undefined;
    }
    const last = block.instructions.at(-1);
    if (last && isCompare(last.opcode) && block.successors.length === 2) {
      // An elseif owns its guard prelude, and its alternatives start with
      // the same register state. Capture the test before either arm reuses
      // its temporary registers. Unsupported preludes remain statements.
      if (this.blockDefines(block, t) || !this.dryRunBlock(block, t, () => undefined)) return undefined;
      const guard = this.conditionFrom(last, true);
      const guardEnv = new Map(this.env);
      const path = this.walkValuePath(block.fallthrough!, join, t, block.branch!);
      if (!path || path.value === undefined) {
        return undefined;
      }
      this.env.clear();
      for (const [register, binding] of guardEnv) this.env.set(register, binding);
      const elseValue = this.buildElseValue(block.branch!, join, t);
      if (elseValue === undefined) {
        return undefined;
      }
      const test =
        path.guards.length > 0
          ? foldAnd([guard, ...path.guards])
          : guard;
      return makeIfExpr(test, path.value, elseValue);
    }
    return this.blockValue(block, join, t);
  }

  private blockDefines(block: BasicBlock, t: number): boolean {
    return block.instructions.some((insn) => insn.defs.includes(t));
  }

  /** Dry-run a pure value block: only defines of `t` (captured) and single-use
   * temps are allowed; returns the value expression for `t`, or undefined. */
  private blockValue(block: BasicBlock, join: number, t: number): Expression | undefined {
    if (!this.reaches(block.id, join)) {
      return undefined;
    }
    let value: Expression | undefined;
    if (!this.dryRunBlock(block, t, (captured) => (value = captured))) {
      return undefined;
    }
    return value;
  }

  private reaches(start: number, target: number): boolean {
    const pending = [start];
    const seen = new Set<number>();
    while (pending.length > 0) {
      const current = pending.pop()!;
      if (current === target) {
        return true;
      }
      if (seen.has(current)) {
        continue;
      }
      seen.add(current);
      for (const succ of this.ir.cfg.blocks[current]?.successors ?? []) {
        pending.push(succ);
      }
    }
    return false;
  }

  private dryRunBlock(block: BasicBlock, t: number, capture: (value: Expression) => void): boolean {
    const saved = new Map(this.env);
    const pendingSnapshot = this.snapshotPendings();
    this.inDryRun = true;
    const fail = (): false => {
      this.inDryRun = false;
      this.env.clear();
      for (const [k, v] of saved) {
        this.env.set(k, v);
      }
      this.restorePendings(pendingSnapshot);
      return false;
    };
    for (const insn of block.instructions) {
      if (this.consumed.has(insn.pc) || isControlOnly(insn.opcode)) {
        continue;
      }
      const target = this.writeTargetOf(insn);
      if (insn.defs.includes(t)) {
        const before = new Map(this.env);
        const produced = this.interpret(insn, target);
        if (produced.statements.length > 1) return fail();
        const value = captureDefine(produced.statements, t) ?? this.capturedEnvDiff(before, insn.a);
        if (value === undefined) {
          return fail();
        }
        capture(value);
        this.env.set(t, { expression: value, pinned: false });
        continue;
      }
      const before = new Map(this.env);
      const produced = this.interpret(insn, target);
      if (produced.statements.length > 0 || produced.pendingTable) {
        return fail();
      }
      if (this.capturedEnvDiff(before, insn.a) === undefined && insn.defs.length > 0) {
        return fail();
      }
    }
    this.inDryRun = false;
    return true;
  }

  private capturedEnvDiff(before: Map<number, Binding>, register: number): Expression | undefined {
    const after = this.env.get(register);
    const prior = before.get(register);
    if (after && after !== prior) {
      return after.expression;
    }
    return undefined;
  }

  private restore(savedEnv: Map<number, Binding>, savedOpen: Set<number>, savedConsumed: Set<number>, savedPending: PendingTable[]): void {
    this.env.clear();
    for (const [k, v] of savedEnv) {
      this.env.set(k, v);
    }
    this.openPacks.clear();
    for (const v of savedOpen) {
      this.openPacks.add(v);
    }
    this.consumed.clear();
    for (const v of savedConsumed) {
      this.consumed.add(v);
    }
    this.pendingStack = savedPending;
  }

  /** Snapshot the mutable state of every pending table (the dry runs mutate
   * the shared objects in place, e.g. absorbing or flushing a table). */
  private snapshotPendings(): PendingSnapshot[] {
    return this.pendingStack.map((pending) => ({
      pending,
      fields: [...pending.fields],
      nested: [...pending.nested],
      flushed: pending.flushed,
      name: pending.name,
    }));
  }

  private restorePendings(snapshot: PendingSnapshot[]): void {
    for (const snap of snapshot) {
      snap.pending.fields = snap.fields;
      snap.pending.nested = snap.nested;
      snap.pending.flushed = snap.flushed;
      snap.pending.name = snap.name;
    }
  }

  private restoreValueIf(
    savedEnv: Map<number, Binding>,
    savedOpen: Set<number>,
    savedConsumed: Set<number>,
    savedPending: PendingTable[],
    savedPendingState: PendingSnapshot[],
    savedNames: Set<string>,
    savedScopes: Array<Set<string>>,
    savedPhiNames: Map<string, string>,
    savedDeclaredPhis: Set<string>,
  ): void {
    this.phiNames.clear();
    for (const [key, name] of savedPhiNames) {
      this.setPhiName(key, name);
    }
    this.declaredPhis.clear();
    for (const key of savedDeclaredPhis) {
      this.declaredPhis.add(key);
    }
    this.restore(savedEnv, savedOpen, savedConsumed, savedPending);
    this.restorePendings(savedPendingState);
    this.allocator.restore(savedNames);
    this.scopeStack.length = 0;
    for (const scope of savedScopes) {
      this.scopeStack.push(new Set(scope));
    }
  }

  // ------------------------------------------------------------ table flush

  private topPending(): PendingTable | undefined {
    return this.pendingStack[this.pendingStack.length - 1];
  }

  private pendingOf(register: number): PendingTable | undefined {
    for (let i = this.pendingStack.length - 1; i >= 0; i--) {
      const pending = this.pendingStack[i]!;
      if (pending.register === register && !pending.flushed) {
        return pending;
      }
    }
    return undefined;
  }

  /** Materialize every pending table observed by `insn` (via uses or defs). */
  private flushObserved(insn: DecodedInstruction, except?: PendingTable): Statement[] {
    const statements: Statement[] = [];
    if (["call", "mutation", "metamethod", "table-read"].includes(effectOf(insn))) {
      // Constructor fields are writes at their bytecode position. Delaying
      // their reads/calls until the literal is flushed can snapshot state
      // AFTER a callback mutates it. Materialize scalar field expressions,
      // keeping the constructor open for a later SETLIST multret tail.
      for (const pending of this.pendingStack) {
        if (pending.flushed) continue;
        const snapshot = (value: Expression): Expression => {
          if (value.kind === "literal" || value.kind === "identifier" || value.kind === "function-expr") return value;
          const name = this.allocator.reserve("field");
          this.declareInScope(name);
          statements.push({kind: "local", names: [name], values: [singleValue(value)]});
          return ident(name);
        };
        pending.fields = pending.fields.map(field => {
          // An open list tail must remain multiple-valued. Its table will
          // be materialized by the normal register observation below.
          if (field.list && isPackish(field.value)) return field;
          return {...field, ...(field.key ? {key: snapshot(field.key)} : {}), value: snapshot(field.value)};
        });
      }
    }
    const observed: PendingTable[] = [];
    const openEnd = insn.opcode === Opcode.SETLIST && insn.c === 0
      ? Math.min(...[...this.openPacks].filter(register => register >= insn.b), this.proto.maxStackSize)
      : -1;
    for (const pending of this.pendingStack) {
      if (pending !== except && (insn.defs.includes(pending.register) || insn.uses.includes(pending.register) ||
          (pending.register >= insn.b && pending.register < openEnd))) {
        observed.push(pending);
      }
    }
    for (const pending of observed) {
      if (!pending.flushed) {
        statements.push(...this.flushPending(pending));
      }
    }
    return statements;
  }

  private flushPending(pending: PendingTable): Statement[] {
    pending.flushed = true;
    const prefix: Statement[] = [];
    const fields: TableField[] = [...pending.fields];
    for (const nested of pending.nested) {
      const child = nested.child;
      if (!child.flushed && !this.hasMultipleTableReads(child)) {
        fields.push({ ...nested.field, value: this.nestedLiteral(child, prefix) });
      } else if (!child.flushed) {
        // A child with multiple readers must keep its table identity.
        prefix.push(...this.flushPending(child));
        fields.push({ ...nested.field, value: ident(child.name ?? `r${child.register}`) });
      } else {
        fields.push({ ...nested.field, value: ident(child.name ?? `r${child.register}`) });
      }
    }
    // Constructors are SSA definitions too. A table created in one branch
    // must assign the join binding, rather than disappear in a branch local.
    const definition = this.proto.instructions.find(insn => insn.pc === pending.startPc);
    const phi = definition ? this.phiBinding(pending.register, definition) : undefined;
    const name = pending.name ?? phi ?? this.bindLocal(pending.register, pending.startPc, pending.role);
    const assignment = phi === name && this.isDeclaredInScope(name);
    const aliases = assignment ? this.snapshotRegisterAliases(pending.register, name) : [];
    this.declareInScope(name);
    this.env.set(pending.register, { name, expression: ident(name), pinned: true });
    pending.name = name;
    // Method lifting: closures assigned to fields become method declarations
    // after the table literal (and are dropped from it).
    const liftedFields = new Set<TableField>();
    const liftedStatements: Statement[] = [];
    for (const field of fields) {
      const lifted = this.tryLiftMethod(field, name);
      if (lifted) {
        liftedFields.add(field);
        liftedStatements.push(lifted);
      }
    }
    const literalFields = fields.filter((field) => !liftedFields.has(field));
    const literal: Expression = { kind: "table", fields: normalizeArrayFields(literalFields) };
    const statements: Statement[] = [...prefix, ...aliases, assignment
      ? { kind: "assign", targets: [ident(name)], values: [literal] }
      : { kind: "local", names: [name], values: [literal] }];
    statements.push(...liftedStatements);
    this.pendingStack = this.pendingStack.filter((p) => p !== pending);
    return statements;
  }

  private nestedLiteral(pending: PendingTable, prefix: Statement[]): Expression {
    pending.flushed = true;
    const fields: TableField[] = [...pending.fields];
    for (const nested of pending.nested) {
      const child = nested.child;
      if (!child.flushed && !this.hasMultipleTableReads(child)) {
        fields.push({ ...nested.field, value: this.nestedLiteral(child, prefix) });
      } else if (!child.flushed) {
        prefix.push(...this.flushPending(child));
        fields.push({ ...nested.field, value: ident(child.name ?? `r${child.register}`) });
      } else {
        fields.push({ ...nested.field, value: ident(child.name ?? `r${child.register}`) });
      }
    }
    return { kind: "table", fields: normalizeArrayFields(fields) };
  }

  private hasMultipleTableReads(pending: PendingTable): boolean {
    let reads = 0;
    for (const insn of this.proto.instructions) {
      if (insn.pc <= pending.startPc) continue;
      const ownWrite = (insn.opcode === Opcode.SETLIST && insn.a === pending.register) ||
        ([Opcode.SETTABLE, Opcode.SETTABLEKS, Opcode.SETTABLEN].includes(insn.opcode) && insn.b === pending.register);
      if (!ownWrite && insn.uses.includes(pending.register) && ++reads > 1) return true;
      if (insn.defs.includes(pending.register)) break;
    }
    return false;
  }

  private tableName(pending: PendingTable): string {
    return this.env.get(pending.register)?.name ?? `r${pending.register}`;
  }

  /** Lift `table.field = <closure>` into `function table:field(...)` when the
   * closure is a method (its first parameter is used as a receiver). */
  private tryLiftMethodAssignment(insn: DecodedInstruction, fieldName: string | undefined, object: Expression): Statement | undefined {
    if (!fieldName || !isValidIdentifier(fieldName)) {
      return undefined;
    }
    // A pinned local is a real binding (and may be captured later). Keep
    // `table.field = name` so we do not clone the body.
    if (this.env.get(insn.a)?.pinned) {
      return undefined;
    }
    const record = this.closureFields.get(this.env.get(insn.a)?.name ?? "");
    if (!record || record.fieldName !== fieldName) {
      return undefined;
    }
    const fn = record.fn;
    if (fn.kind !== "function-expr") {
      return undefined;
    }
    const receiver = fn.params.length > 0 && firstParamIsReceiver(fn);
    const tableText = objectText(object);
    if (!tableText) {
      return undefined;
    }
    const params = receiver ? fn.params.slice(1) : fn.params;
    const body = receiver ? renameIdentifiers(fn.body, new Map([[fn.params[0]!, "self"]])) : fn.body;
    return {
      kind: "function-decl",
      local: false,
      name: `${tableText}${receiver ? ":" : "."}${fieldName}`,
      params,
      isVararg: fn.isVararg,
      body,
    };
  }

  private tryLiftMethod(field: TableField, tableName: string): Statement | undefined {
    if (!field.name || field.name.startsWith("__")) {
      return undefined;
    }
    // An identifier refers to an existing closure. Copying its body into a
    // method declaration changes identity when another field or local holds
    // the same function. Only an unbound function expression can be lifted.
    const fn = field.value;
    if (fn.kind !== "function-expr") {
      return undefined;
    }
    const receiver = fn.params.length > 0 && firstParamIsReceiver(fn);
    const params = receiver ? fn.params.slice(1) : fn.params;
    const body = receiver ? renameIdentifiers(fn.body, new Map([[fn.params[0]!, "self"]])) : fn.body;
    return {
      kind: "function-decl",
      local: false,
      name: `${tableName}${receiver ? ":" : "."}${field.name}`,
      params,
      isVararg: fn.isVararg,
      body,
    };
  }

  // ------------------------------------------------------------- statements

  private emitStraight(basic: BasicBlock): Statement[] {
    const statements: Statement[] = [];
    for (const insn of basic.instructions) {
      if (this.consumed.has(insn.pc) || isControlOnly(insn.opcode)) {
        continue;
      }
      const writeTarget = this.writeTargetOf(insn);
      if (writeTarget === undefined) {
        statements.push(...this.flushObserved(insn));
      } else if (insn.opcode === Opcode.SETLIST) {
        // SETLIST reads every element register, which may itself hold an
        // unfinished constructor. Materialize those values before taking the
        // parent snapshot, without prematurely flushing the parent itself.
        statements.push(...this.flushObserved(insn, writeTarget));
      }
      const produced = this.interpret(insn, writeTarget ?? this.topPending());
      if (produced.pendingTable) {
        this.pendingStack.push(produced.pendingTable);
      }
      statements.push(...produced.statements);
    }
    for (const pending of [...this.pendingStack].reverse()) {
      if (!pending.flushed) {
        statements.push(...this.flushPending(pending));
      }
    }
    this.emitted.add(basic.id);
    return statements;
  }

  /** If `insn` writes into a pending table, that table; otherwise undefined. */
  private writeTargetOf(insn: DecodedInstruction): PendingTable | undefined {
    if (insn.opcode === Opcode.SETTABLEKS || insn.opcode === Opcode.SETTABLEN || insn.opcode === Opcode.SETTABLE) {
      return this.pendingOf(insn.b);
    }
    if (insn.opcode === Opcode.SETLIST) {
      return this.pendingOf(insn.a);
    }
    return undefined;
  }

  /** True while a value-if / boolean dry run is walking instructions: pending
   * tables must not be flushed (a failed walk would lose the declaration). */
  private inDryRun = false;

  private interpret(
    insn: DecodedInstruction,
    pendingTable?: PendingTable,
  ): { statements: Statement[]; pendingTable?: PendingTable } {
    const statements: Statement[] = [];
    if (pendingTable && insn.a === pendingTable.register && insn.b === pendingTable.register &&
        [Opcode.SETTABLE, Opcode.SETTABLEKS, Opcode.SETUDATAKS, Opcode.SETTABLEN].includes(insn.opcode)) {
      // A self reference needs the table's identity now. Deferring this write
      // until the constructor closes would move it after later overwrites
      // (for example, replacing a module's initial __index = module).
      statements.push(...this.flushPending(pendingTable));
      pendingTable = undefined;
    }
    // Reusing a register ends its old open-pack binding. Calls consume their
    // arguments before overwriting result registers, which can overlap a pack.
    if (insn.opcode !== Opcode.CALL && insn.opcode !== Opcode.CALLFB) {
      for (const register of insn.defs) {
        this.openPacks.delete(register);
      }
    }
    switch (insn.opcode) {
      case Opcode.LOADNIL:
        statements.push(...this.define(insn.a, lit(null), insn));
        break;
      case Opcode.LOADB:
        statements.push(...this.define(insn.a, lit(insn.b !== 0), insn));
        break;
      case Opcode.LOADN:
        statements.push(...this.define(insn.a, lit(insn.d), insn));
        break;
      case Opcode.LOADK:
      case Opcode.LOADKX:
        statements.push(...this.define(insn.a, this.constantExpr(insn.constantIndex ?? insn.d), insn));
        break;
      case Opcode.MOVE:
        statements.push(...this.handleMove(insn));
        break;
      case Opcode.GETGLOBAL:
        statements.push(...this.define(insn.a, ident(this.stringConstant(insn.aux ?? 0) ?? "global"), insn));
        break;
      case Opcode.SETGLOBAL:
        statements.push({
          kind: "assign",
          targets: [ident(this.stringConstant(insn.aux ?? 0) ?? "global")],
          values: [this.readRegister(insn.a, insn)],
        });
        break;
      case Opcode.GETUPVAL:
        statements.push(...this.define(insn.a, this.upvalueExpr(insn.b), insn,
          this.captures.get(insn.b)?.mutable !== false &&
          (this.usedOutsideBlock(insn.a, insn) || this.crossesStatementBeforeUse(insn.a, insn))));
        break;
      case Opcode.SETUPVAL:
        statements.push({
          kind: "assign",
          targets: [ident(this.upvalueName(insn.b))],
          values: [this.readRegister(insn.a, insn)],
        });
        break;
      case Opcode.GETIMPORT:
        statements.push(...this.define(insn.a, this.importExpr(insn.d), insn));
        break;
      case Opcode.GETTABLE:
        statements.push(
          ...this.define(insn.a, { kind: "index", table: this.readRegister(insn.b, insn), key: this.readRegister(insn.c, insn) }, insn),
        );
        break;
      case Opcode.GETTABLEKS:
      case Opcode.GETUDATAKS: {
        const name = this.stringConstant(insn.constantIndex ?? 0);
        const object = this.readRegister(insn.b, insn);
        statements.push(
          ...this.define(
            insn.a,
            name && isValidIdentifier(name)
              ? { kind: "property", object, name }
              : { kind: "index", table: object, key: this.constantExpr(insn.constantIndex ?? 0) },
            insn,
          ),
        );
        break;
      }
      case Opcode.GETTABLEN:
        statements.push(
          ...this.define(insn.a, { kind: "index", table: this.readRegister(insn.b, insn), key: lit(insn.c + 1) }, insn),
        );
        break;
      case Opcode.SETTABLE:
        if (pendingTable && pendingTable.register === insn.b) {
          const nested = this.nestedChildOf(insn.a, pendingTable);
          if (nested) {
            this.removePureField(pendingTable, { key: this.readRegister(insn.c, insn), value: lit(null) });
            pendingTable.nested.push({ field: { key: this.readRegister(insn.c, insn) }, child: nested });
          } else if (this.mutableFieldValue(insn.a, insn)) {
            // The value is a mutable local that gets reassigned later in the
            // block; capture the write as a statement so the table literal
            // does not read the final value.
            statements.push(...this.flushPending(pendingTable));
            statements.push({
              kind: "assign",
              targets: [{ kind: "index", table: this.readRegister(insn.b, insn), key: this.readRegister(insn.c, insn) }],
              values: [this.readRegister(insn.a, insn)],
            });
            return { statements };
          } else {
            this.addField(pendingTable, { key: this.readRegister(insn.c, insn), value: this.readRegister(insn.a, insn) });
          }
          return { statements };
        }
        statements.push({
          kind: "assign",
          targets: [{ kind: "index", table: this.readRegister(insn.b, insn), key: this.readRegister(insn.c, insn) }],
          values: [this.readRegister(insn.a, insn)],
        });
        break;
      case Opcode.SETTABLEKS:
      case Opcode.SETUDATAKS: {
        const name = this.stringConstant(insn.constantIndex ?? 0);
        const object = this.readRegister(insn.b, insn);
        const validFieldName = name !== undefined && isValidIdentifier(name);
        if (pendingTable && pendingTable.register === insn.b && name) {
          // Bytecode keys are arbitrary strings. Only valid Luau identifiers
          // may be written as dotted properties or bare table fields.
          const fieldKey = validFieldName ? { name } : { key: lit(name) };
          const targetFor = (table: Expression): Expression =>
            validFieldName
              ? { kind: "property", object: table, name }
              : { kind: "index", table, key: lit(name) };
          const nested = this.nestedChildOf(insn.a, pendingTable);
          if (nested) {
            this.removePureField(pendingTable, { ...fieldKey, value: lit(null) });
            pendingTable.nested.push({ field: fieldKey, child: nested });
          } else if (this.mutableFieldValue(insn.a, insn)) {
            // The value is a mutable local that gets reassigned later in the
            // block; capture the write as a statement so the table literal
            // does not read the final value.
            statements.push(...this.flushPending(pendingTable));
            statements.push({
              kind: "assign",
              targets: [targetFor(this.readRegister(insn.b, insn))],
              values: [this.readRegister(insn.a, insn)],
            });
            return { statements };
          } else {
            this.addField(pendingTable, { ...fieldKey, value: this.readRegister(insn.a, insn) });
          }
          return { statements };
        }
        const lifted = validFieldName ? this.tryLiftMethodAssignment(insn, name, object) : undefined;
        if (lifted) {
          statements.push(lifted);
        } else {
          statements.push({
            kind: "assign",
            targets: [
              validFieldName
                ? { kind: "property", object, name: name! }
                : { kind: "index", table: object, key: this.constantExpr(insn.constantIndex ?? 0) },
            ],
            values: [this.readRegister(insn.a, insn)],
          });
        }
        break;
      }
      case Opcode.SETTABLEN:
        if (pendingTable && pendingTable.register === insn.b) {
          const nested = this.nestedChildOf(insn.a, pendingTable);
          if (nested) {
            this.removePureField(pendingTable, { key: lit(insn.c + 1), value: lit(null) });
            pendingTable.nested.push({ field: { key: lit(insn.c + 1) }, child: nested });
          } else {
            this.addField(pendingTable, { key: lit(insn.c + 1), value: this.readRegister(insn.a, insn) });
          }
          return { statements };
        }
        statements.push({
          kind: "assign",
          targets: [{ kind: "index", table: this.readRegister(insn.b, insn), key: lit(insn.c + 1) }],
          values: [this.readRegister(insn.a, insn)],
        });
        break;
      case Opcode.NEWTABLE:
        return { statements, pendingTable: { register: insn.a, fields: [], nested: [], startPc: insn.pc, role: this.tableRole(insn), flushed: false } };
      case Opcode.DUPTABLE: {
        const fields = this.dupTableFields(insn.d);
        return { statements, pendingTable: { register: insn.a, fields, nested: [], startPc: insn.pc, role: this.tableRole(insn), flushed: false } };
      }
      case Opcode.SETLIST: {
        const startIndex = insn.aux ?? 1;
        const fields: TableField[] = [];
        if (insn.c !== 0) {
          const count = insn.c - 1;
          for (let i = 0; i < count; i++) {
            fields.push({ list: true, key: lit(startIndex + i), value: singleValue(this.readRegister(insn.b + i, insn)) });
          }
        } else {
          // MULTRET: fixed elements followed by one open pack register.
          const fixed = this.openPackFixed(insn.b);
          for (let i = 0; i < fixed; i++) {
            fields.push({ list: true, key: lit(startIndex + i), value: this.readRegister(insn.b + i, insn) });
          }
          fields.push({ list: true, key: lit(startIndex + fixed), value: this.readRegister(insn.b + fixed, insn) });
        }
        if (pendingTable && pendingTable.register === insn.a) {
          for (const field of fields) {
            this.addField(pendingTable, field);
          }
          return { statements };
        }
        statements.push(...this.define(insn.a, { kind: "table", fields: normalizeArrayFields(fields) }, insn, true));
        break;
      }
      case Opcode.ADD:
      case Opcode.SUB:
      case Opcode.MUL:
      case Opcode.DIV:
      case Opcode.MOD:
      case Opcode.POW:
      case Opcode.IDIV:
      case Opcode.AND:
      case Opcode.OR:
        statements.push(
          ...this.define(
            insn.a,
            { kind: "binary", op: binop(insn.opcode), left: this.readRegister(insn.b, insn), right: this.readRegister(insn.c, insn) },
            insn,
          ),
        );
        break;
      case Opcode.ADDK:
      case Opcode.SUBK:
      case Opcode.MULK:
      case Opcode.DIVK:
      case Opcode.MODK:
      case Opcode.POWK:
      case Opcode.IDIVK:
      case Opcode.ANDK:
      case Opcode.ORK:
        statements.push(
          ...this.define(
            insn.a,
            { kind: "binary", op: binop(insn.opcode), left: this.readRegister(insn.b, insn), right: this.constantExpr(insn.c) },
            insn,
          ),
        );
        break;
      case Opcode.SUBRK:
      case Opcode.DIVRK:
        statements.push(
          ...this.define(
            insn.a,
            { kind: "binary", op: binop(insn.opcode), left: this.constantExpr(insn.b), right: this.readRegister(insn.c, insn) },
            insn,
          ),
        );
        break;
      case Opcode.NOT:
      case Opcode.MINUS:
      case Opcode.LENGTH:
        statements.push(
          ...this.define(insn.a, { kind: "unary", op: unop(insn.opcode), argument: this.readRegister(insn.b, insn) }, insn),
        );
        break;
      case Opcode.CONCAT: {
        let expr: Expression = this.readRegister(insn.c, insn);
        for (let register = insn.c - 1; register >= insn.b; register--) {
          expr = { kind: "binary", op: "..", left: this.readRegister(register, insn), right: expr };
        }
        statements.push(...this.define(insn.a, expr, insn));
        break;
      }
      case Opcode.NAMECALL:
      case Opcode.NAMECALLUDATA:
        this.env.set(insn.a, {
          name: undefined,
          expression: {
            kind: "method-call",
            object: this.readRegister(insn.b, insn),
            name: this.stringConstant(insn.constantIndex ?? 0) ?? "method",
            args: [],
            open: false,
          },
          pinned: false,
          methodSelf: insn.b,
        });
        // The self copy is a transient object reference; it must never be
        // pinned (the register is usually reused right after the call).
        this.env.set(insn.a + 1, { expression: this.readRegister(insn.b, insn), pinned: false });
        break;
      case Opcode.CALL:
      case Opcode.CALLFB: {
        const resultCount = insn.call?.resultCount ?? 0;
        const argCount = insn.call?.argumentCount ?? 0;
        const calleeBinding = this.env.get(insn.a);
        let expression: Expression;
        if (calleeBinding?.expression.kind === "method-call") {
          const args: Expression[] = [];
          if (argCount === "multret") {
            args.push(...this.openArgs(insn.a + 2, insn));
          } else {
            const n = Math.max(argCount - 1, 0);
            for (let i = 0; i < n; i++) {
              const arg = this.readRegister(insn.a + 2 + i, insn);
              args.push(i === n - 1 ? singleValue(arg) : arg);
            }
          }
          expression = { ...calleeBinding.expression, args, open: argCount === "multret" };
        } else {
          const args: Expression[] = [];
          if (argCount === "multret") {
            args.push(...this.openArgs(insn.a + 1, insn));
          } else {
            for (let i = 0; i < argCount; i++) {
              const arg = this.readRegister(insn.a + 1 + i, insn);
              args.push(i === argCount - 1 ? singleValue(arg) : arg);
            }
          }
          expression = { kind: "call", callee: this.readRegister(insn.a, insn), args, open: argCount === "multret" };
        }
        // A call consumes the previous top and establishes its own results.
        this.openPacks.clear();
        if (resultCount === 0) {
          // CALL consumes the callee slot. Keeping a NAMECALL placeholder
          // here lets a later phi initializer execute that method again.
          this.env.delete(insn.a);
          statements.push({ kind: "expression-stmt", expression });
        } else if (resultCount === "multret") {
          this.openPacks.add(insn.a);
          const forwarded = this.isPackForwarded(insn.a, insn.pc);
          statements.push(...this.define(insn.a, expression, insn, !forwarded));
        } else if (this.isGenericPrepTarget(insn.a, insn.pc)) {
          // The generic loop consumes the whole iterator triple, including
          // implicit state/control slots. Keep its producer for the loop header.
          this.env.set(insn.a, { expression, pinned: false });
        } else if (resultCount === 1) {
          statements.push(...this.define(insn.a, expression, insn));
        } else {
          const names: string[] = [];
          for (let i = 0; i < resultCount; i++) {
            names.push(this.bindLocal(insn.a + i, insn.pc + insn.width, i === 0 ? "result" : "value"));
          }
          statements.push({ kind: "local", names, values: [expression] });
        }
        break;
      }
      case Opcode.RETURN: {
        const count = insn.b === 0 ? -1 : insn.b - 1;
        const values: Expression[] = [];
        if (count < 0) {
          // RETURN B=0 forwards a variable-length final pack, but can also
          // contain fixed leading values: return count(...), ...
          // The prior implementation returned only R[A] and silently lost
          // trailing open packs from GETVARARGS or CALL.
          const hasOpenTail = [...this.openPacks].some((register) =>
            register >= insn.a && register < insn.a + 64);
          values.push(...(hasOpenTail
            ? this.openArgs(insn.a, insn)
            : [this.readRegister(insn.a, insn)]));
        } else {
          for (let i = 0; i < count; i++) {
            const value = this.readRegister(insn.a + i, insn);
            values.push(i === count - 1 ? singleValue(value) : value);
          }
        }
        if (!(count === 0 && this.isTerminalReturn(insn))) {
          statements.push({ kind: "return", values });
        }
        break;
      }
      case Opcode.GETVARARGS:
        if (insn.b === 0) {
          this.openPacks.clear();
          this.openPacks.add(insn.a);
          statements.push(
            ...this.define(insn.a, { kind: "vararg" }, insn, !this.isPackForwarded(insn.a, insn.pc)),
          );
        } else {
          const count = insn.b - 1;
          const names: string[] = [];
          for (let i = 0; i < count; i++) {
            names.push(this.bindLocal(insn.a + i, insn.pc, i === 0 ? "first" : "value"));
          }
          if (names.length > 0) {
            statements.push({ kind: "local", names, values: [{ kind: "vararg" }] });
          }
        }
        break;
      case Opcode.NEWCLOSURE:
      case Opcode.DUPCLOSURE:
        statements.push(...this.emitClosure(insn));
        break;
      case Opcode.CLOSEUPVALS:
        for (const [register, binding] of this.env) {
          if (register >= insn.a && binding.forwardRef) {
            // The register still holds a readable value, but its closed cell
            // belongs to existing closures. A later definition in this slot
            // must not adopt that cell as its phi assignment target.
            this.env.set(register, { ...binding, forwardRef: false, alias: true });
          }
        }
        break;
      case Opcode.PREPVARARGS:
      case Opcode.FASTCALL:
      case Opcode.FASTCALL1:
      case Opcode.FASTCALL2:
      case Opcode.FASTCALL2K:
      case Opcode.FASTCALL3:
      case Opcode.FASTPCALL:
      case Opcode.CAPTURE:
      case Opcode.NOP:
      case Opcode.COVERAGE:
      case Opcode.BREAK:
        break;
      default:
        break;
    }
    return { statements };
  }

  // -------------------------------------------------------- closures

  private emitClosure(insn: DecodedInstruction): Statement[] {
    let child: Prototype | undefined;
    if (insn.opcode === Opcode.NEWCLOSURE) {
      const childId = this.proto.childProtoIds[insn.d];
      child = childId !== undefined ? this.module.prototypes[childId] : undefined;
    } else {
      const constant = this.proto.constants[insn.d];
      if (constant?.kind === "closure") {
        child = this.module.prototypes[constant.protoId];
      }
    }
    if (!child) {
      return [];
    }
    const shared = insn.opcode === Opcode.DUPCLOSURE ? this.sharedClosureConstants.get(insn.d) : undefined;
    if (shared) {
      const statements: Statement[] = [];
      if (shared.pc === insn.pc) {
        const reconstructed = reconstructFunction(this.module, child, {allocator: this.allocator, captures: new Map()});
        statements.push({kind: "local", names: [shared.name], values: [{kind: "function-expr",
          params: reconstructed.params, isVararg: child.isVararg, body: reconstructed.body, line: child.lineDefined || undefined}]});
        this.declareInScope(shared.name);
      }
      // Use the normal register definition path: a destination can still be a
      // phi or a mutable REF cell even though the loaded function has no captures.
      return [...statements, ...this.define(insn.a, ident(shared.name), insn)];
    }
    const captures = this.capturesAfter(insn.pc);
    // Captured pending tables must be materialized before their names are read.
    const statements: Statement[] = [];
    const valueSnapshots = new Map<number, string>();
    const mergedLocals = new Set(this.phiNames.values());
    for (const cap of captures) {
      const source = cap.capture?.source ?? -1;
      const pending = this.pendingOf(source);
      if (pending && !pending.flushed) {
        statements.push(...this.flushPending(pending));
      }
      // A REF capture is a real variable. Pin an unpinned temp so the child
      // mutates a named local, not a ghost `callback`.
      if (cap.capture?.type === CaptureType.REF && source !== insn.a) {
        statements.push(...this.pinRefCapture(source, insn.pc));
      }
      if (cap.capture?.type === CaptureType.VAL && source !== insn.a) {
        const binding = this.env.get(source);
        // Pinning only gives an expression a name. A phi's named cell can
        // still be assigned on the next loop iteration; VAL captures the
        // current value, not that cell. Keep the snapshot separate from the
        // register environment so REF captures retain their original owner.
        if (binding && binding.expression.kind !== "literal" && !valueSnapshots.has(source) &&
            (!binding.pinned || binding.forwardRef || (binding.name && mergedLocals.has(binding.name)))) {
          const name = this.allocator.reserve("captured");
          statements.push({ kind: "local", names: [name], values: [binding.expression] });
          this.declareInScope(name);
          valueSnapshots.set(source, name);
          if (!binding.pinned) this.env.set(source, { name, expression: ident(name), pinned: true });
        }
      }
    }
    const debug = child.debugName ?? debugNameAt(this.proto, insn.a, insn.pc + insn.width);
    const fieldName = this.nextFieldName(insn);
    const mutable = captures.some((capture) => capture.capture?.type === CaptureType.REF);
    const selfCaptured = captures.some((capture) => capture.capture?.source === insn.a);
    const onlyField = Boolean(fieldName) && !selfCaptured && !mutable && this.onlyUsedAsFieldWrite(insn);
    const existing = this.env.get(insn.a);
    const preferred =
      (existing?.forwardRef ? existing.name : undefined) ??
      debug ??
      fieldName ??
      this.pendingCallbackHint(insn.a) ??
      peekPredicateName(child) ??
      "function";
    const name =
      existing?.forwardRef && existing.name
        ? existing.name
        : onlyField
          ? preferred
          : this.allocator.reserve(preferred);

    // Build the capture bindings for the child.
    const captureMap = new Map<number, CaptureBinding>();
    captures.forEach((cap, index) => {
      const source = cap.capture!.source;
      const snapshot = cap.capture!.type === CaptureType.VAL ? valueSnapshots.get(source) : undefined;
      if (snapshot) {
        captureMap.set(index, {name: snapshot, expression: ident(snapshot), mutable: false});
        return;
      }
      if (source === insn.a && cap.capture!.type !== CaptureType.UPVAL) {
        captureMap.set(index, { name, expression: ident(name), mutable: cap.capture!.type === CaptureType.REF });
        return;
      }
      if (cap.capture!.type === CaptureType.UPVAL) {
        const parent = this.captures.get(source);
        if (parent) {
          captureMap.set(index, {
            name: parent.name,
            expression: parent.name ? ident(parent.name) : parent.expression,
            mutable: parent.mutable,
          });
          return;
        }
        const fallback = child.upvalueNames[index] ?? `up${index}`;
        captureMap.set(index, { name: fallback, expression: ident(fallback), mutable: false });
        return;
      }
      const binding = this.env.get(source);
      if (cap.capture!.type === CaptureType.REF) {
        let refName = binding?.name;
        if (refName && !this.isDeclaredInScope(refName)) {
          refName = undefined;
        }
        if (!refName) {
          const hint = this.futureClosureHint(source, insn.pc) ?? child.upvalueNames[index] ?? "callback";
          refName = this.allocator.reserve(hint);
          this.env.set(source, { name: refName, expression: ident(refName), pinned: true, forwardRef: true });
          this.declareInScope(refName);
        }
        captureMap.set(index, { name: refName, expression: ident(refName), mutable: true });
      } else if (binding?.name && binding.pinned) {
        captureMap.set(index, { name: binding.name, expression: ident(binding.name), mutable: false });
      } else if (binding) {
        captureMap.set(index, { name: undefined, expression: binding.expression, mutable: false });
      } else {
        const fallback = child.upvalueNames[index] ?? `up${index}`;
        captureMap.set(index, { name: fallback, expression: ident(fallback), mutable: false });
      }
    });

    const reconstructed = reconstructFunction(this.module, child, { allocator: this.allocator, captures: captureMap });
    const fn: Expression = {
      kind: "function-expr",
      params: reconstructed.params,
      isVararg: child.isVararg,
      body: reconstructed.body,
      line: child.lineDefined || undefined,
    };

    if (existing?.forwardRef && existing.name) {
      this.env.set(insn.a, { name, expression: ident(name), pinned: true, forwardRef: true });
      return [...statements, { kind: "assign", targets: [ident(name)], values: [fn] }];
    }
    if (selfCaptured || mutable) {
      this.env.set(insn.a, { name, expression: ident(name), pinned: true });
      this.declareInScope(name);
      return [
        ...statements,
        { kind: "local", names: [name], values: [] },
        { kind: "assign", targets: [ident(name)], values: [fn] },
      ];
    }
    if (fieldName) {
      this.closureFields.set(name, { fieldName, tableRegister: this.nextFieldTable(insn), fn, params: reconstructed.params, isVararg: child.isVararg });
    }
    if (onlyField) {
      // The only use is `table.field = <closure>`; leave the function-expr
      // unpinned so SETTABLEKS can lift it without a dead local.
      this.env.set(insn.a, { name, expression: fn, pinned: false });
      return statements;
    }
    this.env.set(insn.a, { name, expression: ident(name), pinned: true });
    return [...statements, { kind: "local", names: [name], values: [fn] }];
  }

  private upvalueExpr(index: number): Expression {
    const binding = this.captures.get(index);
    if (binding?.mutable && binding.name) {
      return ident(binding.name);
    }
    if (binding?.expression) {
      return binding.expression;
    }
    return ident(this.upvalueName(index));
  }

  private upvalueName(index: number): string {
    const binding = this.captures.get(index);
    if (binding?.name) {
      return binding.name;
    }
    return this.proto.upvalueNames[index] ?? `up${index}`;
  }

  /** Turn a REF-captured register into a real named local before the child is built. */
  private pinRefCapture(register: number, fromPc: number): Statement[] {
    const existing = this.env.get(register);
    if (existing?.name && existing.pinned && this.isDeclaredInScope(existing.name)) {
      this.env.set(register, { ...existing, forwardRef: true });
      return [];
    }
    if (existing && !existing.name) {
      const name = this.allocator.reserve(nameHint(existing.expression) ?? "value");
      this.declareInScope(name);
      this.env.set(register, { name, expression: ident(name), pinned: true, forwardRef: true });
      return [{ kind: "local", names: [name], values: [existing.expression] }];
    }
    const hint = this.futureDefineHint(register, fromPc) ?? "value";
    const name = this.allocator.reserve(hint);
    this.declareInScope(name);
    this.env.set(register, { name, expression: ident(name), pinned: true, forwardRef: true });
    return [{ kind: "local", names: [name], values: [] }];
  }

  /** Hint a not-yet-defined register from how it is first written after `fromPc`. */
  private futureDefineHint(register: number, fromPc: number): string | undefined {
    const closure = this.futureClosureHint(register, fromPc);
    if (closure) {
      return closure;
    }
    for (const other of this.proto.instructions) {
      if (other.pc <= fromPc) {
        continue;
      }
      if (other.opcode === Opcode.CAPTURE || other.opcode === Opcode.NOP) {
        continue;
      }
      if (!other.defs.includes(register)) {
        continue;
      }
      if (other.opcode === Opcode.CALL || other.opcode === Opcode.CALLFB) {
        const callee = this.env.get(other.a)?.expression;
        if (callee?.kind === "method-call" && (callee.name === "Connect" || callee.name === "Once")) {
          return "connection";
        }
        if (callee?.kind === "method-call" && callee.name === "Create") {
          return "tween";
        }
      }
      if (other.opcode === Opcode.LOADN && other.d === 0) {
        return "count";
      }
      if (other.opcode === Opcode.LOADNIL) {
        return "value";
      }
      return undefined;
    }
    return undefined;
  }

  private willBeRefCaptured(register: number, fromPc: number): boolean {
    for (const insn of this.proto.instructions) {
      if (insn.pc <= fromPc) {
        continue;
      }
      if (insn.opcode === Opcode.CAPTURE && insn.capture?.type === CaptureType.REF && insn.capture.source === register) {
        return true;
      }
      if (insn.defs.includes(register)) {
        return false;
      }
    }
    return false;
  }

  private capturesAfter(pc: number): DecodedInstruction[] {
    const captures: DecodedInstruction[] = [];
    const instructions = this.proto.instructions;
    for (let i = this.firstInstructionAfter(pc); i < instructions.length; i++) {
      const insn = instructions[i]!;
      if (insn.opcode !== Opcode.CAPTURE) {
        break;
      }
      captures.push(insn);
    }
    return captures;
  }

  /** The name of the table field this closure is immediately assigned to. */
  private nextFieldName(insn: DecodedInstruction): string | undefined {
    const next = this.nextFieldWrite(insn);
    if (!next) {
      return undefined;
    }
    const name = this.stringConstant(next.constantIndex ?? 0);
    return name && isValidIdentifier(name) ? name : undefined;
  }

  private nextFieldTable(insn: DecodedInstruction): number {
    return this.nextFieldWrite(insn)?.b ?? -1;
  }

  /** True when the closure register is written to exactly one table field and
   * never read afterwards (so a local binding would be dead). */
  private onlyUsedAsFieldWrite(insn: DecodedInstruction): boolean {
    const register = insn.a;
    let writes = 0;
    for (const other of this.proto.instructions) {
      if (other.pc <= insn.pc) {
        continue;
      }
    if (other.opcode === Opcode.NOP) {
      continue;
    }
    if (other.opcode === Opcode.CAPTURE) {
      // A child that captures this register needs the local to stay.
      if (other.capture?.source === register || other.uses.includes(register)) {
        return false;
      }
      continue;
    }
    if (
      (other.opcode === Opcode.SETTABLEKS || other.opcode === Opcode.SETUDATAKS) &&
      other.a === register &&
      other.b !== register
    ) {
      writes += 1;
      continue;
    }
      if (other.defs.includes(register)) {
        break;
      }
      if (other.uses.includes(register)) {
        return false;
      }
    }
    return writes === 1;
  }

  /** Look ahead for the NEWCLOSURE that will define `register` and steal its name. */
  private futureClosureHint(register: number, fromPc: number): string | undefined {
    for (const other of this.proto.instructions) {
      if (other.pc <= fromPc) {
        continue;
      }
      if (other.opcode === Opcode.CAPTURE || other.opcode === Opcode.NOP) {
        continue;
      }
      if ((other.opcode === Opcode.NEWCLOSURE || other.opcode === Opcode.DUPCLOSURE) && other.a === register) {
        const future = this.childOf(other);
        return (
          future?.debugName ??
          this.nextFieldName(other) ??
          (future ? peekPredicateName(future) : undefined) ??
          "callback"
        );
      }
      if (other.defs.includes(register)) {
        return undefined;
      }
    }
    return undefined;
  }

  private childOf(insn: DecodedInstruction): Prototype | undefined {
    if (insn.opcode === Opcode.NEWCLOSURE) {
      const childId = this.proto.childProtoIds[insn.d];
      return childId !== undefined ? this.module.prototypes[childId] : undefined;
    }
    const constant = this.proto.constants[insn.d];
    if (constant?.kind === "closure") {
      return this.module.prototypes[constant.protoId];
    }
    return undefined;
  }

  /** Name a closure from a pending NAMECALL / known callee sitting in a nearby register. */
  private pendingCallbackHint(register: number): string | undefined {
    for (let base = register - 1; base >= Math.max(0, register - 4); base--) {
      const expr = this.env.get(base)?.expression;
      if (!expr) {
        continue;
      }
      if (expr.kind === "method-call" && (expr.name === "Connect" || expr.name === "Once")) {
        return expr.object.kind === "property" ? eventCallbackName(expr.object.name) : "callback";
      }
      if (expr.kind === "property") {
        if (expr.object.kind === "identifier" && expr.object.name === "table" && expr.name === "sort") {
          return "compare";
        }
        if (expr.object.kind === "identifier" && expr.object.name === "coroutine" && expr.name === "create") {
          return "routine";
        }
        if (expr.object.kind === "identifier" && expr.object.name === "task") {
          if (expr.name === "delay") {
            return "delayed";
          }
          if (expr.name === "spawn") {
            return "spawned";
          }
        }
      }
      if (expr.kind === "identifier") {
        if (expr.name === "xpcall") {
          return "onError";
        }
        if (expr.name === "pcall") {
          return "protected";
        }
      }
    }
    return undefined;
  }

  private nextFieldWrite(insn: DecodedInstruction): DecodedInstruction | undefined {
    const register = insn.a;
    for (const other of this.proto.instructions) {
      if (other.pc <= insn.pc) {
        continue;
      }
      if (other.opcode === Opcode.CAPTURE || other.opcode === Opcode.NOP) {
        continue;
      }
      if (
        (other.opcode === Opcode.SETTABLEKS || other.opcode === Opcode.SETUDATAKS) &&
        other.a === register &&
        other.b !== register
      ) {
        return other;
      }
      if (other.defs.includes(register)) {
        return undefined;
      }
      if (other.uses.includes(register)) {
        return undefined;
      }
    }
    return undefined;
  }

  private isGenericPrepTarget(register: number, fromPc: number): boolean {
    for (const insn of this.proto.instructions) {
      if (insn.pc <= fromPc) {
        continue;
      }
      if (insn.opcode === Opcode.FORGPREP || insn.opcode === Opcode.FORGPREP_INEXT || insn.opcode === Opcode.FORGPREP_NEXT) {
        if (insn.a === register) {
          return true;
        }
        return false;
      }
      if (insn.defs.includes(register)) {
        return false;
      }
    }
    return false;
  }

  // -------------------------------------------------------- open packs

  /** Number of fixed elements before the open pack of a SETLIST MULTRET. */
  private openPackFixed(register: number): number {
    let fixed = 0;
    while (fixed < 64) {
      if (this.openPacks.has(register + fixed)) {
        break;
      }
      const binding = this.env.get(register + fixed);
      if (!binding) {
        break;
      }
      if (binding.expression.kind === "vararg") {
        break;
      }
      fixed += 1;
    }
    return fixed;
  }

  private openArgs(first: number, insn: DecodedInstruction): Expression[] {
    const args: Expression[] = [];
    let register = first;
    let guard = 0;
    while (guard < 64) {
      guard += 1;
      const binding = this.env.get(register);
      args.push(this.readRegister(register, insn));
      // A fixed one-result CALL also has a call expression in its binding.
      // Only a real open result pack (or an open vararg) terminates a B=0
      // argument list. Stopping at an arbitrary nested call silently drops
      // following arguments to print(f(), g(), h()).
      if (this.openPacks.has(register) || binding?.expression.kind === "vararg") {
        break;
      }
      register += 1;
    }
    return args;
  }

  private isPackForwarded(register: number, fromPc: number): boolean {
    for (const insn of this.proto.instructions) {
      if (insn.pc <= fromPc) {
        continue;
      }
      if (
        // An open `return ...` forwards every live register at or after `a`.
        (insn.opcode === Opcode.RETURN && insn.b === 0 && register >= insn.a) ||
        // An open call consumes every live register after `a` as an argument.
        ((insn.opcode === Opcode.CALL || insn.opcode === Opcode.CALLFB) && insn.b === 0 && register >= insn.a + 1) ||
        (insn.opcode === Opcode.SETLIST && insn.c === 0) ||
        (insn.opcode === Opcode.MOVE && insn.b === register)
      ) {
        return true;
      }
      if (insn.uses.includes(register) || insn.defs.includes(register)) {
        return false;
      }
    }
    return false;
  }

  private handleMove(insn: DecodedInstruction): Statement[] {
    const source = this.env.get(insn.b);
    if (source && !source.pinned && isPackish(source.expression)) {
      // Unpacking a multret pack through consecutive MOVE instructions.
      const moves: Array<{ dst: number; src: number }> = [{ dst: insn.a, src: insn.b }];
      for (const other of this.proto.instructions) {
        if (other.pc <= insn.pc) {
          continue;
        }
        const next = moves.length;
        if (other.opcode === Opcode.MOVE && other.a === insn.a + next && other.b === insn.b + next) {
          moves.push({ dst: other.a, src: other.b });
          continue;
        }
        break;
      }
      if (moves.length > 1) {
        const names: string[] = [];
        for (let i = 0; i < moves.length; i++) {
          names.push(this.bindLocal(moves[i]!.dst, insn.pc, i === 0 ? "result" : "value"));
        }
        for (let i = 0; i < moves.length; i++) {
          this.env.set(moves[i]!.src, { name: names[i], expression: ident(names[i]!), pinned: true, alias: true });
        }
        return [{ kind: "local", names, values: [source.expression] }];
      }
    }
    return this.define(insn.a, this.readRegister(insn.b, insn), insn);
  }

  // -------------------------------------------------------- tables details

  /** Register copies retain the old value when an SSA binding is assigned. */
  private snapshotRegisterAliases(register: number, name: string): Statement[] {
    const reads = (value: unknown): boolean => {
      if (!value || typeof value !== "object") return false;
      const node = value as {kind?: string; name?: string};
      if (node.kind === "function-expr") return false;
      if (node.kind === "identifier") return node.name === name;
      return Object.values(value).some(reads);
    };
    const aliases = [...this.env].filter(([slot, binding]) => slot !== register &&
      !binding.forwardRef && reads(binding.expression));
    if (!aliases.length) return [];
    const snapshot = this.allocator.reserve("snapshot");
    this.declareInScope(snapshot);
    const replace = (value: any): any => {
      if (!value || typeof value !== "object" || value.kind === "function-expr") return value;
      if (value.kind === "identifier" && value.name === name) return ident(snapshot);
      if (Array.isArray(value)) return value.map(replace);
      return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, replace(child)]));
    };
    for (const [slot, binding] of aliases) {
      const expression = replace(binding.expression) as Expression;
      this.env.set(slot, {...binding, expression,
        ...(expression.kind === "identifier" ? {name: snapshot, pinned: true, alias: true} : {})});
    }
    return [{kind: "local", names: [snapshot], values: [ident(name)]}];
  }

  private tableRole(insn: DecodedInstruction): string {
    if (this.proto === this.mainProto) {
      const ret = this.proto.instructions.find((i) => i.opcode === Opcode.RETURN);
      if (ret && ret.b === 2 && ret.a === insn.a) {
        return "module";
      }
    }
    return "config";
  }

  private isEscaping(expression: Expression): boolean {
    if (expression.kind === "function-expr" || expression.kind === "table") {
      return true;
    }
    if (expression.kind === "method-call") {
      return expression.name === "GetService" || expression.name === "WaitForChild";
    }
    return expression.kind === "call" && expression.callee.kind === "identifier" && expression.callee.name === "require";
  }

  private nestedChildOf(register: number, parent: PendingTable): PendingTable | undefined {
    const child = this.pendingOf(register);
    return child && child !== parent ? child : undefined;
  }

  private addField(pending: PendingTable, field: TableField): void {
    this.removePureField(pending, field);
    pending.fields.push(field);
  }

  private removePureField(pending: PendingTable, field: TableField): void {
    const previous = pending.fields.findIndex((candidate) => sameFieldKey(candidate, field));
    if (previous >= 0 && !pending.fields[previous]!.list && isPureValue(pending.fields[previous]!.value)) {
      pending.fields.splice(previous, 1);
    }
  }

  private dupTableFields(index: number): TableField[] {
    const constant = this.proto.constants[index];
    if (!constant) {
      return [];
    }
    if (constant.kind === "table") {
      // DUPTABLE key reservations initially contain nil, not source-level
      // assignments. Explicit subsequent nil writes must remain observable.
      return [];
    }
    if (constant.kind === "tableWithConstants") {
      return constant.entries.flatMap(({ key, value }) => {
        const name = this.proto.constants[key];
        if (name?.kind === "string") {
          return [{ name: name.value, value: this.constantExpr(value) }];
        }
        return [];
      });
    }
    return [];
  }

  // ------------------------------------------------------------ definitions

  private define(register: number, expression: Expression, insn: DecodedInstruction, forceLocal = false, mergedName?: string): Statement[] {
    // A forwarded open pack cannot be materialized in a single local: doing
    // so silently truncates it. Its consumer supplies the list context.
    if (!forceLocal && (insn.call?.resultCount === "multret" ||
        (insn.opcode === Opcode.GETVARARGS && insn.b === 0))) {
      this.env.set(register, { expression, pinned: false });
      return [];
    }
    const debug = debugNameAt(this.proto, register, insn.pc + insn.width);
    const uses = this.useCount(register, insn.pc);
    const liveAcrossBlocks = this.usedOutsideBlock(register, insn);
    const phi = mergedName ?? this.phiBinding(register, insn);
    const envBind = this.env.get(register);
    if (envBind?.forwardRef && envBind.name) {
      const nilLiteral = isNilLiteral(expression);
      const aliases = this.snapshotRegisterAliases(register, envBind.name);
      this.env.set(register, { name: envBind.name, expression: ident(envBind.name), pinned: true, nilLiteral, forwardRef: true });
      return [...aliases, { kind: "assign", targets: [ident(envBind.name)], values: [expression] }];
    }
    // A literal nil has no identity worth keeping in a local: only a debug
    // name or a phi (real variable slot) pins it.
    const nilLiteral = isNilLiteral(expression);
    const refCaptured = this.willBeRefCaptured(register, insn.pc);
    const canHaveEffects =
      expression.kind !== "literal" &&
      expression.kind !== "vararg" &&
      expression.kind !== "function-expr" &&
      (expression.kind !== "identifier" ||
        insn.opcode === Opcode.GETGLOBAL ||
        insn.opcode === Opcode.GETIMPORT);
    const pin =
      forceLocal ||
      Boolean(debug) ||
      refCaptured ||
      (uses > 0 && (canHaveEffects || expression.kind === "identifier") &&
        this.crossesStatementBeforeUse(register, insn, expression)) ||
      (!nilLiteral && (uses > 1 || liveAcrossBlocks)) ||
      this.isEscaping(expression) ||
      phi !== undefined;
    if (pin) {
      const preferred = debug ?? (nilLiteral && refCaptured ? this.futureClosureHint(register, insn.pc) : undefined)
        ?? nameHint(expression) ?? "value";
      if (
        expression.kind === "identifier" &&
        expression.name === preferred &&
        !forceLocal &&
        !debug &&
        phi === undefined &&
        !refCaptured
      ) {
        this.env.set(register, { name: preferred, expression, pinned: true, alias: true });
        return [];
      }
      const existing = phi;
      if (existing) {
        if (!this.isDeclaredInScope(existing)) {
          this.declareInScope(existing);
          this.env.set(register, { name: existing, expression: ident(existing), pinned: true, nilLiteral });
          return [{ kind: "local", names: [existing], values: [expression] }];
        }
        const aliases = this.snapshotRegisterAliases(register, existing);
        this.env.set(register, { name: existing, expression: ident(existing), pinned: true, nilLiteral });
        return [...aliases, { kind: "assign", targets: [ident(existing)], values: [expression] }];
      }
      const name = this.allocator.reserve(preferred);
      this.declareInScope(name);
      this.env.set(register, { name, expression: ident(name), pinned: true, nilLiteral });
      return [{ kind: "local", names: [name], values: [expression] }];
    }
    this.env.set(register, { name: undefined, expression, pinned: false, nilLiteral: isNilLiteral(expression) });
    // Even if no subsequent instruction reads this register, its evaluation
    // may still call a metamethod, access a dynamic global, or raise an error.
    // Dropping a dead MUL/ADD/GETTABLE/GETGLOBAL changes program behavior:
    // emit a discard binding that preserves the original evaluation point.
    // The expression-stmt AST form cannot hold arbitrary arithmetic in Luau.
    if (uses === 0 && !liveAcrossBlocks && !this.inDryRun && canHaveEffects) {
      return [{ kind: "local", names: ["_"], values: [expression] }];
    }
    return [];
  }

  /** Keep evaluation before statements that cannot become part of its consumer. */
  private crossesStatementBeforeUse(register: number, definition: DecodedInstruction, expression?: Expression): boolean {
    const dependencies = new Set<string>();
    let containsCall = Boolean(definition.call);
    const collect = (value: unknown): void => {
      if (!value || typeof value !== "object") return;
      const node = value as {kind?: string; name?: string};
      if (node.kind === "function-expr") return;
      if (node.kind === "call" || node.kind === "method-call") containsCall = true;
      if (node.kind === "identifier" && node.name) dependencies.add(node.name);
      Object.values(value).forEach(collect);
    };
    collect(expression);
    const home = this.ir.cfg.blockOfPc.get(definition.pc);
    if (home === undefined) {
      return false;
    }
    for (const next of this.ir.cfg.blocks[home]!.instructions) {
      if (next.pc <= definition.pc || this.fallbackCalls.has(next.pc) || isFastCall(next.opcode)) {
        continue;
      }
      if (next.uses.includes(register) ||
          (next.call?.argumentCount === "multret" && register > next.a) ||
          (next.opcode === Opcode.RETURN && next.b === 0 && register >= next.a)) {
        return false;
      }
      if (next.defs.includes(register)) {
        return false;
      }
      // A pure bytecode write can mutate a lexical phi used by this deferred
      // expression. Snapshot the operands before that write, even for LOADN.
      if (next.defs.some(slot => {
        const name = this.env.get(slot)?.name;
        return name !== undefined && dependencies.has(name);
      })) return true;
      // A call can mutate the state observed by a later read. In particular
      // Luau evaluates assignment targets before RHS expressions, so moving
      // table.remove into an RHS would evaluate #table against the old state.
      if (containsCall && ["call", "table-read", "metamethod"].includes(effectOf(next))) return true;
      // An independent call can later be materialized before this deferred
      // value (e.g. an inlined constructor argument). Only a direct consumer
      // may nest it; that case returned above when checking register uses.
      // Discarded/multiple results also force non-call reads to be captured.
      if (effectOf(next) === "mutation" ||
          (next.call && (next.call.resultCount === 0 ||
            (typeof next.call.resultCount === "number" && next.call.resultCount > 1)))) {
        return true;
      }
    }
    return false;
  }

  private usedOutsideBlock(register: number, insn: DecodedInstruction): boolean {
    const home = this.ir.cfg.blockOfPc.get(insn.pc);
    for (const next of this.proto.instructions) {
      if (next.pc <= insn.pc) {
        continue;
      }
      if (next.uses.includes(register) && !isFakeUse(next.opcode) && !this.fallbackCalls.has(next.pc)) {
        if (this.ir.cfg.blockOfPc.get(next.pc) !== home) {
          return true;
        }
      }
      if (next.defs.includes(register)) {
        return false;
      }
    }
    return false;
  }

  /** Real uses of `register` in the pc range `[fromPc, toPc)`. */
  private useCountInRange(register: number, fromPc: number, toPc: number | undefined): number {
    let count = 0;
    for (const insn of this.proto.instructions) {
      if (insn.pc < fromPc || (toPc !== undefined && insn.pc >= toPc)) {
        continue;
      }
      if (insn.uses.includes(register) && !isFakeUse(insn.opcode) && !this.fallbackCalls.has(insn.pc)) {
        count += 1;
      }
    }
    return count;
  }

  private useCount(register: number, fromPc: number): number {
    let count = 0;
    for (const insn of this.proto.instructions) {
      if (insn.pc <= fromPc) {
        continue;
      }
      if (
        !this.fallbackCalls.has(insn.pc) &&
        (
          (insn.uses.includes(register) && !isFakeUse(insn.opcode)) ||
          // Open CALL argument lists use the live registers above A, even
          // though the bytecode decoder cannot enumerate their upper bound
          // statically (B=0). Count the use before discarding or inlining
          // effectful calls: otherwise f() is emitted twice or lost.
          ((insn.opcode === Opcode.CALL || insn.opcode === Opcode.CALLFB) &&
            insn.b === 0 && register >= insn.a + 1)
        )
      ) {
        count += 1;
      }
      if (insn.defs.includes(register)) {
        break;
      }
    }
    return count;
  }

  private phiBinding(register: number, insn: DecodedInstruction): string | undefined {
    const home = this.ir.cfg.blockOfPc.get(insn.pc);

    if (home === undefined) {
      return undefined;
    }
    const existing = this.env.get(register);
    const debug = debugNameAt(this.proto, register, insn.pc + insn.width);
    if (debug && existing?.name === debug && !existing.alias && insn.uses.includes(register) &&
        ![...this.env].some(([slot, binding]) => slot !== register && binding.name === debug)) {
      return debug;
    }
    // Consult the actual SSA definition reaching a phi, including paths
    // through intervening blocks. An entry phi does not own later slot reuse.
    const value = this.ir.ssa.defAt.get(`${home}:${insn.pc}:${register}`);
    const keys = value === undefined ? [] : this.phiInputs.get(value) ?? [];
    const key = keys.find(key => this.phiNames.has(key)) ?? keys[0];
    // A fresh definition feeding an as-yet unbound phi need not belong to
    // the old local in the same physical slot (e.g. a nested table followed
    // by a loop counter). Established phi families still keep their owner.
    if (key) return this.phiNameFor(key, register, insn.pc, insn.uses.includes(register));
    return undefined;
  }

  private redefinedInBlock(blockId: number, afterPc: number, register: number): boolean {
    for (const insn of this.ir.cfg.blocks[blockId]?.instructions ?? []) {
      if (insn.pc > afterPc && insn.defs.includes(register)) {
        return true;
      }
    }
    return false;
  }

  /** Whether a table field read from `register` would capture a mutable local
   * that is reassigned later in the same block (making the literal read the
   * final value instead of the one at the write). */
  private mutableFieldValue(register: number, insn: DecodedInstruction): boolean {
    if (this.readRegister(register, insn).kind !== "identifier") {
      return false;
    }
    const home = this.ir.cfg.blockOfPc.get(insn.pc);
    if (home === undefined) {
      return false;
    }
    for (const other of this.ir.cfg.blocks[home]?.instructions ?? []) {
      if (other.pc > insn.pc && other.defs.includes(register)) {
        // A NEWTABLE/DUPTABLE define is flushed under a fresh name; any other
        // define reassigns the existing local.
        if (other.opcode !== Opcode.NEWTABLE && other.opcode !== Opcode.DUPTABLE) {
          return true;
        }
      }
    }
    return false;
  }

  private bindLocal(register: number, pc: number, role: string): string {
    const debug = debugNameAt(this.proto, register, pc);
    const name = this.allocator.reserve(debug ?? role);
    this.declareInScope(name);
    this.env.set(register, { name, expression: ident(name), pinned: true });
    return name;
  }

  private readRegister(register: number, insn?: DecodedInstruction): Expression {
    const binding = this.env.get(register);
    if (binding) {
      return cloneExpr(binding.expression);
    }
    const debug = insn ? debugNameAt(this.proto, register, insn.pc) : undefined;
    return ident(debug ?? `r${register}`);
  }

  // -------------------------------------------------------------- constants

  private constantExpr(index: number): Expression {
    const constant = this.proto.constants[index];
    if (!constant) {
      return lit(null);
    }
    if (constant.kind === "import") {
      return pathToExpr(constant.path);
    }
    if (constant.kind === "string") {
      return lit(constant.value);
    }
    if (constant.kind === "boolean") {
      return lit(constant.value);
    }
    if (constant.kind === "number") {
      return lit(constant.value);
    }
    if (constant.kind === "integer") {
      return lit(constant.value);
    }
    if (constant.kind === "nil") {
      return lit(null);
    }
    if (constant.kind === "vector") {
      return {
        kind: "call",
        callee: { kind: "property", object: ident("vector"), name: "create" },
        args: [lit(constant.x), lit(constant.y), lit(constant.z)],
        open: false,
      };
    }
    return lit(null);
  }

  private stringConstant(index: number): string | undefined {
    const constant = this.proto.constants[index];
    return constant?.kind === "string" ? constant.value : undefined;
  }

  private importExpr(index: number): Expression {
    const constant = this.proto.constants[index];
    if (constant?.kind === "import") {
      return pathToExpr(constant.path);
    }
    if (constant?.kind === "string") {
      return ident(constant.value);
    }
    return this.constantExpr(index);
  }

  // -------------------------------------------------------------- conditions

  private conditionFrom(insn: DecodedInstruction, invert: boolean): Expression {
    let test: Expression;
    switch (insn.opcode) {
      case Opcode.JUMPIF:
        test = this.readRegister(insn.a, insn);
        break;
      case Opcode.JUMPIFNOT:
        test = this.readRegister(insn.a, insn);
        invert = !invert;
        break;
      case Opcode.JUMPIFEQ:
      case Opcode.JUMPIFNOTEQ:
      case Opcode.JUMPIFLT:
      case Opcode.JUMPIFLE:
      case Opcode.JUMPIFNOTLT:
      case Opcode.JUMPIFNOTLE:
        test = {
          kind: "binary",
          op: compareOp(insn.opcode),
          left: this.readRegister(insn.a, insn),
          right: this.readRegister(insn.aux ?? 0, insn),
        };
        if (
          insn.opcode === Opcode.JUMPIFNOTEQ ||
          insn.opcode === Opcode.JUMPIFNOTLT ||
          insn.opcode === Opcode.JUMPIFNOTLE
        ) {
          invert = !invert;
        }
        break;
      case Opcode.JUMPXEQKNIL:
        test = { kind: "binary", op: "==", left: this.readRegister(insn.a, insn), right: lit(null) };
        if (((insn.aux ?? 0) >>> 31) !== 0) {
          invert = !invert;
        }
        break;
      case Opcode.JUMPXEQKB:
        test = {
          kind: "binary",
          op: "==",
          left: this.readRegister(insn.a, insn),
          right: lit(((insn.aux ?? 0) & 1) !== 0),
        };
        if (((insn.aux ?? 0) >>> 31) !== 0) {
          invert = !invert;
        }
        break;
      case Opcode.JUMPXEQKN:
      case Opcode.JUMPXEQKS:
        test = {
          kind: "binary",
          op: "==",
          left: this.readRegister(insn.a, insn),
          right: this.constantExpr((insn.aux ?? 0) & 0xffffff),
        };
        if (((insn.aux ?? 0) >>> 31) !== 0) {
          invert = !invert;
        }
        break;
      default:
        test = this.readRegister(insn.a, insn);
    }
    if (invert) {
      if (test.kind === "unary" && test.op === "not") {
        return test.argument;
      }
      return { kind: "unary", op: "not", argument: test };
    }
    return test;
  }

  private isTerminalReturn(insn: DecodedInstruction): boolean {
    return insn === this.proto.instructions.at(-1) && insn.b === 1;
  }
}

// --------------------------------------------------------------------- helpers

/** A fixed register result must not expand in the final slot of a Luau list. */
function singleValue(expression: Expression): Expression {
  return expression.kind === "call" || expression.kind === "method-call" || expression.kind === "vararg"
    ? { kind: "paren", expression }
    : expression;
}

function fallbackParam(index: number, total: number): string {
  if (total === 1) {
    return "value";
  }
  return ["value", "index", "count", "options"][index] ?? `arg${index}`;
}

/** `if n == 0 then return true/false` mutual recursion → isEven / isOdd. */
function peekPredicateName(child: Prototype): string | undefined {
  const instructions = child.instructions;
  if (instructions.length < 2 || child.numParams !== 1) {
    return undefined;
  }
  let comparesZero = false;
  let trueOnZero: boolean | undefined;
  for (const insn of instructions) {
    if (
      (insn.opcode === Opcode.JUMPXEQKN || insn.opcode === Opcode.JUMPIFEQ || insn.opcode === Opcode.JUMPXEQKB) &&
      insn.a === 0
    ) {
      comparesZero = true;
    }
    if (insn.opcode === Opcode.LOADB && trueOnZero === undefined) {
      trueOnZero = insn.b !== 0;
    }
  }
  if (!comparesZero || trueOnZero === undefined) {
    return undefined;
  }
  return trueOnZero ? "isEven" : "isOdd";
}

function pathToExpr(path: string[]): Expression {
  if (path.length === 0) {
    return ident("_");
  }
  let expr: Expression = ident(path[0]!);
  for (let i = 1; i < path.length; i++) {
    const part = path[i]!;
    expr = isValidIdentifier(part) ? { kind: "property", object: expr, name: part } : { kind: "index", table: expr, key: lit(part) };
  }
  return expr;
}

function cloneExpr(expression: Expression): Expression {
  return expression;
}

function nameHint(expression: Expression): string | undefined {
  if (expression.kind === "method-call") {
    return nameFromMethod(expression.name, expression.args) ?? nameFromProperty(expression.name);
  }
  if (expression.kind === "call") {
    if (expression.callee.kind === "identifier" && expression.callee.name === "require") {
      return nameFromModulePath(expression.args[0]);
    }
    if (expression.callee.kind === "identifier" && expression.callee.name === "select") {
      return "count";
    }
    if (expression.callee.kind === "property") {
      if (expression.callee.object.kind === "identifier" && expression.callee.object.name === "table" && expression.callee.name === "pack") {
        return "packed";
      }
      return nameFromMethod(expression.callee.name, expression.args);
    }
  }
  if (expression.kind === "property") {
    return nameFromProperty(expression.name) ?? (isValidIdentifier(expression.name) ? lowerIdent(expression.name) : undefined);
  }
  if (expression.kind === "identifier") {
    return expression.name;
  }
  return undefined;
}

function nameFromModulePath(expression: Expression | undefined): string | undefined {
  if (expression?.kind === "property" && isValidIdentifier(expression.name)) {
    return expression.name;
  }
  if (
    expression?.kind === "index" &&
    expression.key.kind === "literal" &&
    typeof expression.key.value === "string" &&
    isValidIdentifier(expression.key.value)
  ) {
    return expression.key.value;
  }
  return undefined;
}

function lowerIdent(name: string): string {
  if (name[0] && name[0] === name[0].toUpperCase()) {
    return name[0].toLowerCase() + name.slice(1);
  }
  return name;
}

function isCompare(opcode: Opcode): boolean {
  switch (opcode) {
    case Opcode.JUMPIF:
    case Opcode.JUMPIFNOT:
    case Opcode.JUMPIFEQ:
    case Opcode.JUMPIFLE:
    case Opcode.JUMPIFLT:
    case Opcode.JUMPIFNOTEQ:
    case Opcode.JUMPIFNOTLE:
    case Opcode.JUMPIFNOTLT:
    case Opcode.JUMPXEQKNIL:
    case Opcode.JUMPXEQKB:
    case Opcode.JUMPXEQKN:
    case Opcode.JUMPXEQKS:
      return true;
    default:
      return false;
  }
}

function isGenericPrep(opcode: Opcode | undefined): boolean {
  return (
    opcode === Opcode.FORGPREP ||
    opcode === Opcode.FORGPREP_INEXT ||
    opcode === Opcode.FORGPREP_NEXT
  );
}

function isControlOnly(opcode: Opcode): boolean {
  switch (opcode) {
    case Opcode.JUMP:
    case Opcode.JUMPBACK:
    case Opcode.JUMPX:
    case Opcode.FORNPREP:
    case Opcode.FORNLOOP:
    case Opcode.FORGPREP:
    case Opcode.FORGLOOP:
    case Opcode.FORGPREP_INEXT:
    case Opcode.FORGPREP_NEXT:
      return true;
    default:
      return false;
  }
}

function isFastCallLike(opcode: Opcode): boolean {
  return isFastCall(opcode);
}

/** Uses that are part of the loop protocol, not real reads of the value. */
function isFakeUse(opcode: Opcode): boolean {
  switch (opcode) {
    case Opcode.FORNPREP:
    case Opcode.FORNLOOP:
    case Opcode.FORGPREP:
    case Opcode.FORGPREP_INEXT:
    case Opcode.FORGPREP_NEXT:
    case Opcode.FORGLOOP:
    case Opcode.JUMP:
    case Opcode.JUMPBACK:
    case Opcode.JUMPX:
    case Opcode.CLOSEUPVALS:
    case Opcode.BREAK:
    case Opcode.PREPVARARGS:
    case Opcode.COVERAGE:
    case Opcode.NOP:
      return true;
    default:
      return false;
  }
}

function isTableWrite(insn: DecodedInstruction, register: number): boolean {
  return (
    ((insn.opcode === Opcode.SETTABLEKS || insn.opcode === Opcode.SETTABLEN || insn.opcode === Opcode.SETTABLE) &&
      insn.b === register) ||
    (insn.opcode === Opcode.SETLIST && insn.a === register)
  );
}

function isLiteralOne(expression: Expression): boolean {
  return expression.kind === "literal" && expression.value === 1;
}

function isNilLiteral(expression: Expression | undefined): boolean {
  return expression?.kind === "literal" && expression.value === null;
}

function isPackish(expression: Expression): boolean {
  return expression.kind === "call" || expression.kind === "method-call" || expression.kind === "vararg";
}

function binop(opcode: Opcode): BinaryOperator {
  switch (opcode) {
    case Opcode.ADD:
    case Opcode.ADDK:
      return "+";
    case Opcode.SUB:
    case Opcode.SUBK:
    case Opcode.SUBRK:
      return "-";
    case Opcode.MUL:
    case Opcode.MULK:
      return "*";
    case Opcode.DIV:
    case Opcode.DIVK:
    case Opcode.DIVRK:
      return "/";
    case Opcode.MOD:
    case Opcode.MODK:
      return "%";
    case Opcode.POW:
    case Opcode.POWK:
      return "^";
    case Opcode.IDIV:
    case Opcode.IDIVK:
      return "//";
    case Opcode.AND:
    case Opcode.ANDK:
      return "and";
    case Opcode.OR:
    case Opcode.ORK:
      return "or";
    default:
      return "+";
  }
}

function unop(opcode: Opcode): "not" | "-" | "#" {
  if (opcode === Opcode.NOT) {
    return "not";
  }
  if (opcode === Opcode.LENGTH) {
    return "#";
  }
  return "-";
}

function compareOp(opcode: Opcode): BinaryOperator {
  switch (opcode) {
    case Opcode.JUMPIFEQ:
    case Opcode.JUMPIFNOTEQ:
      return "==";
    case Opcode.JUMPIFLT:
    case Opcode.JUMPIFNOTLT:
      return "<";
    case Opcode.JUMPIFLE:
    case Opcode.JUMPIFNOTLE:
      return "<=";
    default:
      return "==";
  }
}

function sameFieldKey(left: TableField, right: TableField): boolean {
  if (left.name && right.name) {
    return left.name === right.name;
  }
  if (left.key && right.key) {
    return expressionsEqual(left.key, right.key);
  }
  return false;
}

function expressionsEqual(left: Expression, right: Expression): boolean {
  if (left.kind === "identifier" && right.kind === "identifier") {
    return left.name === right.name;
  }
  if (left.kind === "literal" && right.kind === "literal") {
    // A key reconstructed from a bytecode string constant may be represented
    // by distinct AST nodes even though both point at the same table field.
    return Object.is(left.value, right.value);
  }
  return left === right;
}

function isPureValue(expression: Expression): boolean {
  switch (expression.kind) {
    case "literal":
      return true;
    case "identifier":
      return true;
    case "unary":
      return isPureValue(expression.argument);
    default:
      return false;
  }
}

/** Recover positional slots without letting named fields truncate an open tail.
 * Keyed stores remain single-valued even when a compact array form is possible. */
function normalizeArrayFields(fields: TableField[]): TableField[] {
  let position = 1;
  const hasList = fields.some(field => field.list);
  const plainArray = !hasList && fields.every((field, index) =>
    field.key?.kind === "literal" && field.key.value === index + 1);
  return fields.map(({list, ...field}) => {
    if ((list || plainArray) && field.key?.kind === "literal" && field.key.value === position) {
      position++;
      return { value: list ? field.value : singleValue(field.value) };
    }
    return field;
  });
}

function captureDefine(statements: Statement[], _register: number): Expression | undefined {
  for (const statement of statements) {
    if (statement.kind === "local" && statement.values.length === 1 && statement.names.length === 1) {
      return statement.values[0];
    }
    if (statement.kind === "assign" && statement.values.length === 1 && statement.targets.length === 1) {
      return statement.values[0];
    }
  }
  return undefined;
}

function makeIfExpr(test: Expression, consequent: Expression, alternate: Expression): Expression {
  if (alternate.kind === "if-expr") {
    return {
      kind: "if-expr",
      test,
      consequent,
      branches: [{ test: alternate.test, value: alternate.consequent }, ...alternate.branches],
      alternate: alternate.alternate,
    };
  }
  return { kind: "if-expr", test, consequent, branches: [], alternate };
}

function foldAnd(expressions: Expression[]): Expression {
  let result = expressions[0]!;
  for (let i = 1; i < expressions.length; i++) {
    result = { kind: "binary", op: "and", left: result, right: expressions[i]! };
  }
  return result;
}

function sameExpr(left: Expression | undefined, right: Expression | undefined): boolean {
  if (!left || !right) {
    return false;
  }
  return expressionsEqual(left, right);
}

function fieldAccessOf(object: Expression, field: TableField): Expression {
  if (field.name) {
    return { kind: "property", object, name: field.name };
  }
  if (field.key) {
    return { kind: "index", table: object, key: field.key };
  }
  return object;
}

/** `if a then <if b then X end> end` → `if a and b then X end`. */
function fuseGuardChain(statement: Statement): Statement {
  if (statement.kind !== "if" || statement.alternate || statement.branches.length > 0) {
    return statement;
  }
  const inner = statement.consequent.statements[0];
  if (
    statement.consequent.statements.length !== 1 ||
    !inner ||
    inner.kind !== "if" ||
    inner.branches.length > 0 ||
    inner.alternate
  ) {
    return statement;
  }
  return {
    kind: "if",
    test: { kind: "binary", op: "and", left: statement.test, right: inner.test },
    consequent: inner.consequent,
    branches: [],
  };
}

function firstParamIsReceiver(fn: { params: string[]; body: Block }): boolean {
  const first = fn.params[0];
  if (!first) {
    return false;
  }
  let receiver = false;
  const visit = (expression: Expression): void => {
    if (receiver) {
      return;
    }
    switch (expression.kind) {
      case "property":
        if (expression.object.kind === "identifier" && expression.object.name === first) {
          receiver = true;
        }
        visit(expression.object);
        break;
      case "index":
        if (expression.table.kind === "identifier" && expression.table.name === first) {
          receiver = true;
        }
        visit(expression.table);
        visit(expression.key);
        break;
      case "method-call":
        if (expression.object.kind === "identifier" && expression.object.name === first) {
          receiver = true;
        }
        visit(expression.object);
        expression.args.forEach(visit);
        break;
      case "call":
        visit(expression.callee);
        expression.args.forEach(visit);
        break;
      case "binary":
        visit(expression.left);
        visit(expression.right);
        break;
      case "unary":
        visit(expression.argument);
        break;
      case "table":
        expression.fields.forEach((field) => {
          if (field.key) {
            visit(field.key);
          }
          visit(field.value);
        });
        break;
      case "function-expr":
        break;
      case "if-expr":
        visit(expression.test);
        visit(expression.consequent);
        expression.branches.forEach((branch) => {
          visit(branch.test);
          visit(branch.value);
        });
        visit(expression.alternate);
        break;
      case "interp":
        expression.parts.forEach((part) => {
          if (part.kind === "expr" && typeof part.value !== "string") {
            visit(part.value);
          }
        });
        break;
      case "paren":
        visit(expression.expression);
        break;
      default:
        break;
    }
  };
  const visitStmt = (statement: Statement): void => {
    if (receiver) {
      return;
    }
    switch (statement.kind) {
      case "local":
        statement.values.forEach(visit);
        break;
      case "assign":
        statement.targets.forEach(visit);
        statement.values.forEach(visit);
        break;
      case "expression-stmt":
        visit(statement.expression);
        break;
      case "return":
        statement.values.forEach(visit);
        break;
      case "if":
        visit(statement.test);
        statement.consequent.statements.forEach(visitStmt);
        statement.branches.forEach((branch) => {
          visit(branch.test);
          branch.body.statements.forEach(visitStmt);
        });
        statement.alternate?.statements.forEach(visitStmt);
        break;
      case "while":
        visit(statement.test);
        statement.body.statements.forEach(visitStmt);
        break;
      case "repeat":
        statement.body.statements.forEach(visitStmt);
        visit(statement.test);
        break;
      case "numeric-for":
        visit(statement.start);
        visit(statement.stop);
        if (statement.step) {
          visit(statement.step);
        }
        statement.body.statements.forEach(visitStmt);
        break;
      case "generic-for":
        statement.iterators.forEach(visit);
        statement.body.statements.forEach(visitStmt);
        break;
      case "do":
        statement.body.statements.forEach(visitStmt);
        break;
      case "function-decl":
        statement.body.statements.forEach(visitStmt);
        break;
      default:
        break;
    }
  };
  fn.body.statements.forEach(visitStmt);
  return receiver;
}

function renameIdentifiers(body: Block, rename: Map<string, string>): Block {
  return renameFreeBindings(body, rename);
}


function objectText(expression: Expression): string | undefined {
  if (expression.kind === "identifier") {
    return expression.name;
  }
  if (expression.kind === "property") {
    const object = objectText(expression.object);
    return object ? `${object}.${expression.name}` : undefined;
  }
  return undefined;
}

export function materializeLocals(statements: Statement[]): Statement[] {
  return statements;
}

export type { LuauConstant };
