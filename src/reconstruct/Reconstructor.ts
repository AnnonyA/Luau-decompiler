import type {
  BinaryOperator,
  Block,
  Expression,
  IfExpressionBranch,
  Statement,
  TableField,
} from "../ast/Ast.js";
import { block, ident, lit } from "../ast/Ast.js";
import { buildControlFlowGraph, type BasicBlock, type ControlFlowGraph } from "../cfg/ControlFlowGraph.js";
import { computeDominators, computePostDominators, type DominatorTree, type PostDominatorTree } from "../cfg/Dominators.js";
import { findNaturalLoops, type NaturalLoop } from "../cfg/NaturalLoops.js";
import type { LuauConstant } from "../decode/Constant.js";
import type { DecodedInstruction } from "../decode/DecodedInstruction.js";
import { CaptureType, Opcode } from "../decode/Opcode.js";
import type { BytecodeModule, Prototype } from "../decode/Prototype.js";
import { buildSsa, type SsaFunction } from "../ssa/SsaBuilder.js";
import { NameAllocator, debugNameAt, isValidIdentifier } from "./Naming.js";
import { nameFromMethod, nameFromProperty } from "./RobloxSemantics.js";

export interface FunctionIr {
  cfg: ControlFlowGraph;
  dominators: DominatorTree;
  postDominators: PostDominatorTree;
  ssa: SsaFunction;
  loops: NaturalLoop[];
}

export function analyzePrototype(prototype: Prototype): FunctionIr {
  const cfg = buildControlFlowGraph(prototype);
  const dominators = computeDominators(cfg);
  const postDominators = computePostDominators(cfg);
  const ssa = buildSsa(cfg, dominators);
  const loops = findNaturalLoops(cfg, dominators);
  return { cfg, dominators, postDominators, ssa, loops };
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
  const allocator = parentContext?.allocator ?? new NameAllocator();
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
  methodSelf?: number;
  /** The binding was created from a literal nil (LOADNIL). */
  nilLiteral?: boolean;
}

interface PendingTable {
  register: number;
  fields: TableField[];
  nested: Array<{ field: { name?: string; key?: Expression }; child: PendingTable }>;
  selfRefs: Array<{ name?: string; key?: Expression }>;
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
  selfRefs: PendingTable["selfRefs"];
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
  private readonly loopByHeader: Map<number, NaturalLoop>;
  /** Blocks that are the exit (follow) of some natural loop. */
  private readonly loopFollows = new Set<number>();
  private readonly consumed = new Set<number>();
  private readonly phiNames = new Map<string, string>();
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

  constructor(
    private readonly module: BytecodeModule,
    private readonly proto: Prototype,
    private readonly ir: FunctionIr,
    private readonly allocator: NameAllocator,
    private readonly captures: Map<number, CaptureBinding> = new Map(),
  ) {
    this.loopByHeader = new Map(ir.loops.map((loop) => [loop.header, loop]));
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
          }
        }
      }
    }
    this.mainProto = module.prototypes[module.mainProtoId];
    for (let i = 0; i < proto.numParams; i++) {
      const debug = debugNameAt(proto, i, 0) ?? fallbackParam(i, proto.numParams);
      const name = this.allocator.reserve(debug);
      this.params.push(name);
      this.declareInScope(name);
      this.env.set(i, { name, expression: ident(name), pinned: true });
    }
    this.fallbackCalls = this.collectFallbackCalls();
  }

  /** CALL/CALLFB instructions that are the slow-path fallbacks of a preceding
   * FASTCALL* jump. Their uses must not count as real uses (double counting). */
  private collectFallbackCalls(): Set<number> {
    const fallbacks = new Set<number>();
    for (const insn of this.proto.instructions) {
      if (!isFastCallLike(insn.opcode) || insn.jumpTarget === undefined) {
        continue;
      }
      const target = insn.jumpTarget;
      for (const other of this.proto.instructions) {
        if (other.pc > insn.pc && other.pc < target && (other.opcode === Opcode.CALL || other.opcode === Opcode.CALLFB)) {
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
      const block = this.ir.cfg.blocks[current];
      if (!block || block.unreachable) {
        break;
      }
      const preparedLoop = this.preparedLoop(block);
      if (preparedLoop && !visited.has(-preparedLoop.header - 1)) {
        statements.push(...this.emitStraight(block));
        visited.add(-preparedLoop.header - 1);
        statements.push(...this.emitLoop(preparedLoop, visited));
        current = this.loopFollow(preparedLoop);
        continue;
      }
      const loop = this.loopByHeader.get(current);
      if (loop && !visited.has(-loop.header - 1)) {
        visited.add(-loop.header - 1);
        statements.push(...this.emitLoop(loop, visited));
        current = this.loopFollow(loop);
        continue;
      }
      const branch = this.tryIf(block, stop, visited);
      if (branch) {
        statements.push(...branch.statements);
        current = branch.follow;
        continue;
      }
      statements.push(...this.emitStraight(block));
      if (block.successors.length === 0) {
        break;
      }
      if (block.successors.length === 1) {
        const successor = block.successors[0]!;
        const loop = this.innermostLoopContaining(block.id);
        const last = block.instructions.at(-1);
        if (loop && last?.opcode === Opcode.JUMP) {
          if (successor === loop.header || successor === loop.latch) {
            statements.push({ kind: "continue" });
            current = successor;
            continue;
          }
          if (!loop.blocks.includes(successor)) {
            statements.push({ kind: "break" });
            current = undefined;
            continue;
          }
        }
        // A pure control stub that jumps to the enclosing loop's exit is a
        // `break`, even when it is not part of the natural loop (blocks that
        // never reach the latch are excluded from the loop body).
        if (
          last?.opcode === Opcode.JUMP &&
          successor === stop &&
          stop !== undefined &&
          this.loopFollows.has(stop) &&
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
    const header = this.ir.cfg.blocks[loop.header]!;
    const declarations = this.hoistLoopPhis(loop);
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
    if (loop.kind !== "infinite" && last && isCompare(last.opcode) && header.successors.length === 2) {
      // while: the header test jumps to the exit when true, so the loop test is its negation
      this.consumed.add(last.pc);
      const bodyCandidate = header.successors.find((id) => loop.blocks.includes(id) && id !== loop.header);
      if (bodyCandidate !== undefined) {
        bodyStart = bodyCandidate;
      }
      headerSetup.push(...this.emitStraight(header));
      test = this.conditionFrom(last, true);
    }
    const body =
      loop.kind === "infinite"
        ? this.emitRange(loop.header, this.loopFollow(loop), new Set(visited))
        : this.emitLoopBody(loop, visited, bodyStart, bodyStart === loop.header ? undefined : loop.header);
    return [...declarations, ...headerSetup, { kind: "while", test, body: block(body) }];
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
        ? this.conditionFrom(last, testBlockId === loop.latch && last.jumpTarget === loop.header)
        : lit(false);
    return { kind: "repeat", body: block(body), test };
  }

  private hoistLoopPhis(loop: NaturalLoop): Statement[] {
    const statements: Statement[] = [];
    const namesByRegister = new Map<number, string>();
    for (const blockId of [loop.header, loop.latch]) {
      for (const phi of this.ir.ssa.phis.get(blockId) ?? []) {
        const key = `phi:${blockId}:${phi.register}`;
        if (this.deadLoopPhis.has(key)) {
          continue;
        }
        const name =
          namesByRegister.get(phi.register) ??
          this.loopPhiNames.get(`${blockId}:${phi.register}`) ??
          this.phiNameFor(key, phi.register, this.ir.cfg.blocks[blockId]!.startPc);
        namesByRegister.set(phi.register, name);
        this.loopPhiNames.set(`${blockId}:${phi.register}`, name);
        if (this.declaredPhis.has(key) || this.isDeclaredInScope(name)) {
          this.env.set(phi.register, { name, expression: ident(name), pinned: true });
          continue;
        }
        this.declaredPhis.add(key);
        statements.push({ kind: "local", names: [name], values: [] });
        this.declareInScope(name);
        this.env.set(phi.register, { name, expression: ident(name), pinned: true });
      }
    }
    return statements;
  }

  /** Whether the loop redefines `register` before anything reads its incoming
   * value, making the phi's entry value dead. */
  private isDeadLoopPhi(loop: NaturalLoop, register: number): boolean {
    let firstUse: number | undefined;
    let firstDef: number | undefined;
    for (const blockId of loop.blocks) {
      for (const insn of this.ir.cfg.blocks[blockId]?.instructions ?? []) {
        if (firstDef === undefined && insn.defs.includes(register)) {
          firstDef = insn.pc;
        }
        if (firstUse === undefined && insn.uses.includes(register) && !isFakeUse(insn.opcode)) {
          firstUse = insn.pc;
        }
        if (firstUse !== undefined && firstDef !== undefined) {
          break;
        }
      }
      if (firstUse !== undefined && firstDef !== undefined) {
        break;
      }
    }
    return firstDef !== undefined && (firstUse === undefined || firstUse > firstDef);
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
    const loop = this.loopByHeader.get(block.fallthrough);
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
      if ((insn.opcode === Opcode.NAMECALL || insn.opcode === Opcode.CALL) && insn.a === base && insn.defs.includes(register)) {
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
    const header = this.ir.cfg.blocks[loop.header];
    if (header) {
      const ipdom = this.ir.postDominators.ipdom[loop.header];
      if (ipdom !== undefined && ipdom < this.ir.cfg.blocks.length && !loop.blocks.includes(ipdom) && ipdom !== loop.header) {
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
    const activeLoop = this.innermostLoopContaining(basic.id);

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
        const jumpExits = thenLatch;
        this.consumed.add(last.pc);
        const statements = this.emitStraight(basic);
        statements.push({
          kind: "if",
          test: this.conditionFrom(last, false),
          consequent: block([{ kind: jumpExits ? "break" : "continue" }]),
          branches: [],
        });
        return { statements, follow: jumpExits ? elseId : thenId };
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
        // The branch leaving the loop must be a pure control stub (loop exit or
        // an enclosing latch); a branch with real content is a plain if/else.
        const outsideId = thenInside ? elseId : thenId;
        const outsideBlock = this.ir.cfg.blocks[outsideId];
        const pureStub =
          outsideBlock !== undefined &&
          outsideBlock.successors.length > 0 &&
          outsideBlock.instructions.every((insn) => isControlOnly(insn.opcode));
        if (pureStub) {
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
      const consequent = block(this.emitRange(thenId, stop, new Set(visited)));
      const alternateStmts = this.emitRange(elseId, stop, new Set(visited));
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
    this.pushScope();
    const consequent = block(this.emitRange(thenId, join, new Set(visited)));
    this.popScope();
    this.pushScope();
    const alternateStmts = this.emitRange(elseId, join, new Set(visited));
    this.popScope();
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
    const ipdom = this.ir.postDominators.ipdom[basic.id];
    const loop = this.innermostLoopContaining(basic.id);
    if (ipdom !== undefined && ipdom < this.ir.cfg.blocks.length && ipdom !== basic.id) {
      if (!loop || loop.blocks.includes(ipdom)) {
        return ipdom;
      }
      // The immediate post-dominator leaves the loop (e.g. a break in one
      // branch); the structural join is where the non-exiting flows merge.
      return this.commonJoin(basic.fallthrough, basic.branch, undefined) ?? ipdom;
    }
    return this.commonJoin(basic.fallthrough, basic.branch, undefined);
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

  private declareJoinPhis(join: number, statements: Statement[]): void {
    for (const phi of this.ir.ssa.phis.get(join) ?? []) {
      const key = `phi:${join}:${phi.register}`;
      const name = this.phiNameFor(key, phi.register, this.ir.cfg.blocks[join]!.startPc);
      if (!this.declaredPhis.has(key) && !this.isDeclaredInScope(name)) {
        this.declaredPhis.add(key);
        statements.push({ kind: "local", names: [name], values: [] });
        this.declareInScope(name);
      }
      // The phi name is bound by the branch defines themselves (phiBinding
      // consults the join's phi); pre-setting it here would make a temporary
      // define inside a branch (e.g. GETIMPORT before CALL) reuse the name.
    }
  }

  private phiNameFor(key: string, register: number, pc: number): string {
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
    const debug = debugNameAt(this.proto, register, pc);
    const name = this.allocator.reserve(debug ?? "result");
    this.phiNames.set(key, name);
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
    const walk = this.walkGuardBlock(basic, thenInsn.a);
    if (!walk) {
      return undefined;
    }
    const thenValue = thenInsn.b !== 0;
    const jumpCond = this.conditionFrom(last, false);
    const expr: Expression = thenValue ? { kind: "unary", op: "not", argument: jumpCond } : jumpCond;
    this.consumed.add(last.pc);
    const usedAfterJoin = this.usedAfterPc(this.ir.cfg.blocks[join]!.startPc, thenInsn.a);
    const statements = [...walk.statements, ...this.define(thenInsn.a, expr, last, usedAfterJoin)];
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
    const savedEnv = new Map(this.env);
    const savedOpen = new Set(this.openPacks);
    const savedConsumed = new Set(this.consumed);
    const savedPending = [...this.pendingStack];
    const savedPendingState = this.snapshotPendings();
    const savedNames = this.allocator.snapshot();
    const savedScopes = this.scopeStack.map((scope) => new Set(scope));
    // The value the guard tests before any define inside the block runs.
    const condReg = this.readRegister(last.a, last);

    // Walk the guard block itself: it may hold the value (e.g. `t = x or y`)
    // while its other statements are ordinary prelude statements.
    const basicWalk = this.walkGuardBlock(basic, t);
    if (!basicWalk) {
      this.restoreValueIf(savedEnv, savedOpen, savedConsumed, savedPending, savedPendingState, savedNames, savedScopes);
      return undefined;
    }
    const basicValue = basicWalk.value;
    // The value `t` carries when the jump is taken: the guard block's define,
    // or the pre-existing binding when the block only tests the register.
    const guardValue = basicValue ?? condReg;

    const thenPath = this.walkValuePath(thenId, join, t, elseId);
    if (!thenPath || (thenPath.value === undefined && basicValue === undefined)) {
      this.restoreValueIf(savedEnv, savedOpen, savedConsumed, savedPending, savedPendingState, savedNames, savedScopes);
      return undefined;
    }
    const elseValue =
      elseId === join
        ? // The taken branch lands directly on the join: it carries the value
          // `t` had at the guard (`t = <cond> or <fallback>`).
          guardValue
        : this.buildElseValue(elseId, join, t);
    if (elseValue === undefined) {
      this.restoreValueIf(savedEnv, savedOpen, savedConsumed, savedPending, savedPendingState, savedNames, savedScopes);
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
      expr = { kind: "binary", op: "or", left: guardValue, right: thenValue };
    } else if (orForm) {
      expr = { kind: "binary", op: "or", left: thenValue, right: elseValue };
    } else if (andForm) {
      expr = { kind: "binary", op: "and", left: condReg, right: thenValue };
    } else if (thenPath.guards.length > 0) {
      const test = foldAnd([this.conditionFrom(last, true), ...thenPath.guards]);
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
      expr = makeIfExpr(this.conditionFrom(last, true), thenValue, elseValue);
    }

    this.consumed.add(last.pc);
    // Restore the scope mutated by the dry runs; the final define declares the
    // value local (or assigns to an already-declared phi) in the true scope.
    this.scopeStack.length = 0;
    for (const scope of savedScopes) {
      this.scopeStack.push(new Set(scope));
    }
    const usedAfterJoin = this.usedAfterPc(this.ir.cfg.blocks[join]!.startPc, t);
    const statements = [...basicWalk.statements, ...this.define(t, expr, last, usedAfterJoin)];
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
        if (value !== undefined && produced.statements.length > 0) {
          return fail();
        }
        const captured = captureDefine(produced.statements, t) ?? this.capturedEnvDiff(before, t);
        if (captured === undefined) {
          return fail();
        }
        value = captured;
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
      // Nested elseif chain.
      const path = this.walkValuePath(block.fallthrough!, join, t, block.branch!);
      if (!path || path.value === undefined) {
        return undefined;
      }
      const elseValue = this.buildElseValue(block.branch!, join, t);
      if (elseValue === undefined) {
        return undefined;
      }
      const test =
        path.guards.length > 0
          ? foldAnd([this.conditionFrom(last, true), ...path.guards])
          : this.conditionFrom(last, true);
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
        const value = captureDefine(produced.statements, t) ?? this.capturedEnvDiff(before, insn.a);
        if (value === undefined) {
          return fail();
        }
        capture(value);
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
      selfRefs: [...pending.selfRefs],
      flushed: pending.flushed,
      name: pending.name,
    }));
  }

  private restorePendings(snapshot: PendingSnapshot[]): void {
    for (const snap of snapshot) {
      snap.pending.fields = snap.fields;
      snap.pending.nested = snap.nested;
      snap.pending.selfRefs = snap.selfRefs;
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
  ): void {
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
  private flushObserved(insn: DecodedInstruction): Statement[] {
    const statements: Statement[] = [];
    const observed: PendingTable[] = [];
    for (const pending of this.pendingStack) {
      if (insn.defs.includes(pending.register) || insn.uses.includes(pending.register)) {
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
    const fields: TableField[] = [...pending.fields];
    for (const nested of pending.nested) {
      const child = nested.child;
      if (!child.flushed && child.selfRefs.length === 0) {
        fields.push({ ...nested.field, value: this.nestedLiteral(child) });
      } else if (!child.flushed) {
        // The child has self references and cannot be inlined; materialize it.
        this.flushPending(child);
        fields.push({ ...nested.field, value: ident(child.name ?? `r${child.register}`) });
      } else {
        fields.push({ ...nested.field, value: ident(child.name ?? `r${child.register}`) });
      }
    }
    const name = pending.name ?? this.bindLocal(pending.register, pending.startPc, pending.role);
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
    const statements: Statement[] = [{ kind: "local", names: [name], values: [{ kind: "table", fields: normalizeArrayFields(literalFields) }] }];
    for (const selfRef of pending.selfRefs) {
      const target: Expression = selfRef.name
        ? { kind: "property", object: ident(name), name: selfRef.name }
        : { kind: "index", table: ident(name), key: selfRef.key ?? lit(null) };
      statements.push({ kind: "assign", targets: [target], values: [ident(name)] });
    }
    statements.push(...liftedStatements);
    this.pendingStack = this.pendingStack.filter((p) => p !== pending);
    return statements;
  }

  private nestedLiteral(pending: PendingTable): Expression {
    pending.flushed = true;
    const fields: TableField[] = [...pending.fields];
    for (const nested of pending.nested) {
      const child = nested.child;
      if (!child.flushed && child.selfRefs.length === 0) {
        fields.push({ ...nested.field, value: this.nestedLiteral(child) });
      } else if (!child.flushed) {
        this.flushPending(child);
        fields.push({ ...nested.field, value: ident(child.name ?? `r${child.register}`) });
      } else {
        fields.push({ ...nested.field, value: ident(child.name ?? `r${child.register}`) });
      }
    }
    return { kind: "table", fields: normalizeArrayFields(fields) };
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
    const record = this.closureFields.get(this.env.get(insn.a)?.name ?? "");
    if (!record || record.fieldName !== fieldName) {
      return undefined;
    }
    const fn = record.fn;
    if (fn.kind !== "function-expr" || fn.params.length === 0) {
      return undefined;
    }
    const receiver = firstParamIsReceiver(fn);
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
    if (!field.name || field.value.kind !== "identifier") {
      return undefined;
    }
    const record = this.closureFields.get(field.value.name);
    if (!record || record.fieldName !== field.name) {
      return undefined;
    }
    const fn = record.fn;
    if (fn.kind !== "function-expr" || fn.params.length === 0) {
      return undefined;
    }
    const receiver = firstParamIsReceiver(fn);
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
        statements.push(...this.define(insn.a, this.upvalueExpr(insn.b), insn));
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
          if (insn.a === pendingTable.register) {
            pendingTable.selfRefs.push({ key: this.readRegister(insn.c, insn) });
            return { statements };
          }
          const nested = this.nestedChildOf(insn.a, pendingTable);
          if (nested) {
            this.removePureField(pendingTable, { key: this.readRegister(insn.c, insn), value: lit(null) });
            pendingTable.nested.push({ field: { key: this.readRegister(insn.c, insn) }, child: nested });
          } else if (this.mutableFieldValue(insn.a, insn)) {
            // The value is a mutable local that gets reassigned later in the
            // block; capture the write as a statement so the table literal
            // does not read the final value.
            if (this.inDryRun) {
              if (pendingTable.name === undefined) {
                pendingTable.name = this.bindLocal(pendingTable.register, pendingTable.startPc, pendingTable.role);
              }
              statements.push({
                kind: "assign",
                targets: [{ kind: "index", table: ident(pendingTable.name), key: this.readRegister(insn.c, insn) }],
                values: [this.readRegister(insn.a, insn)],
              });
              return { statements };
            }
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
        if (pendingTable && pendingTable.register === insn.b && name) {
          if (insn.a === pendingTable.register) {
            this.removePureField(pendingTable, { name, value: lit(null) });
            pendingTable.selfRefs.push({ name });
            return { statements };
          }
          const nested = this.nestedChildOf(insn.a, pendingTable);
          if (nested) {
            this.removePureField(pendingTable, { name, value: lit(null) });
            pendingTable.nested.push({ field: { name }, child: nested });
          } else if (this.mutableFieldValue(insn.a, insn)) {
            // The value is a mutable local that gets reassigned later in the
            // block; capture the write as a statement so the table literal
            // does not read the final value.
            if (this.inDryRun) {
              // A dry run must not flush (a failed walk would lose the local
              // declaration); name the table and emit the plain write.
              if (pendingTable.name === undefined) {
                pendingTable.name = this.bindLocal(pendingTable.register, pendingTable.startPc, pendingTable.role);
              }
              statements.push({
                kind: "assign",
                targets: [{ kind: "property", object: ident(pendingTable.name), name }],
                values: [this.readRegister(insn.a, insn)],
              });
              return { statements };
            }
            statements.push(...this.flushPending(pendingTable));
            statements.push({
              kind: "assign",
              targets: [{ kind: "property", object: this.readRegister(insn.b, insn), name }],
              values: [this.readRegister(insn.a, insn)],
            });
            return { statements };
          } else {
            this.addField(pendingTable, { name, value: this.readRegister(insn.a, insn) });
          }
          return { statements };
        }
        const lifted = this.tryLiftMethodAssignment(insn, name, object);
        if (lifted) {
          statements.push(lifted);
        } else {
          statements.push({
            kind: "assign",
            targets: [
              name && isValidIdentifier(name)
                ? { kind: "property", object, name }
                : { kind: "index", table: object, key: this.constantExpr(insn.constantIndex ?? 0) },
            ],
            values: [this.readRegister(insn.a, insn)],
          });
        }
        break;
      }
      case Opcode.SETTABLEN:
        if (pendingTable && pendingTable.register === insn.b) {
          if (insn.a === pendingTable.register) {
            pendingTable.selfRefs.push({ key: lit(insn.c + 1) });
            return { statements };
          }
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
        return { statements, pendingTable: { register: insn.a, fields: [], nested: [], selfRefs: [], startPc: insn.pc, role: this.tableRole(insn), flushed: false } };
      case Opcode.DUPTABLE: {
        const fields = this.dupTableFields(insn.d);
        return { statements, pendingTable: { register: insn.a, fields, nested: [], selfRefs: [], startPc: insn.pc, role: this.tableRole(insn), flushed: false } };
      }
      case Opcode.SETLIST: {
        const startIndex = insn.aux ?? 1;
        const fields: TableField[] = [];
        if (insn.c !== 0) {
          const count = insn.c - 1;
          for (let i = 0; i < count; i++) {
            fields.push({ key: lit(startIndex + i), value: this.readRegister(insn.b + i, insn) });
          }
        } else {
          // MULTRET: fixed elements followed by one open pack register.
          const fixed = this.openPackFixed(insn.b);
          for (let i = 0; i < fixed; i++) {
            fields.push({ key: lit(startIndex + i), value: this.readRegister(insn.b + i, insn) });
          }
          fields.push({ key: lit(startIndex + fixed), value: this.readRegister(insn.b + fixed, insn) });
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
        let expr: Expression = this.readRegister(insn.b, insn);
        for (let register = insn.b + 1; register <= insn.c; register++) {
          expr = { kind: "binary", op: "..", left: expr, right: this.readRegister(register, insn) };
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
            args.push(...this.openArgs(insn.a + 1, insn));
          } else {
            const n = Math.max(argCount - 1, 0);
            for (let i = 0; i < n; i++) {
              args.push(this.readRegister(insn.a + 2 + i, insn));
            }
          }
          expression = { ...calleeBinding.expression, args, open: argCount === "multret" };
        } else {
          const args: Expression[] = [];
          if (argCount === "multret") {
            args.push(...this.openArgs(insn.a + 1, insn));
          } else {
            for (let i = 0; i < argCount; i++) {
              args.push(this.readRegister(insn.a + 1 + i, insn));
            }
          }
          expression = { kind: "call", callee: this.readRegister(insn.a, insn), args, open: argCount === "multret" };
        }
        if (resultCount === 0) {
          statements.push({ kind: "expression-stmt", expression });
        } else if (resultCount === "multret") {
          this.openPacks.add(insn.a);
          const forwarded = this.isPackForwarded(insn.a, insn.pc);
          statements.push(...this.define(insn.a, expression, insn, !forwarded));
        } else if (resultCount === 1 || this.isGenericPrepTarget(insn.a, insn.pc)) {
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
          values.push(this.readRegister(insn.a, insn));
        } else {
          for (let i = 0; i < count; i++) {
            values.push(this.readRegister(insn.a + i, insn));
          }
        }
        if (!(count === 0 && this.isTerminalReturn(insn))) {
          statements.push({ kind: "return", values });
        }
        break;
      }
      case Opcode.GETVARARGS:
        if (insn.b === 0) {
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
      case Opcode.PREPVARARGS:
      case Opcode.CLOSEUPVALS:
      case Opcode.FASTCALL:
      case Opcode.FASTCALL1:
      case Opcode.FASTCALL2:
      case Opcode.FASTCALL2K:
      case Opcode.FASTCALL3:
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
    const captures = this.capturesAfter(insn.pc);
    // Captured pending tables must be materialized before their names are read.
    const statements: Statement[] = [];
    for (const cap of captures) {
      const pending = this.pendingOf(cap.capture?.source ?? -1);
      if (pending && !pending.flushed) {
        statements.push(...this.flushPending(pending));
      }
    }
    const debug = child.debugName ?? debugNameAt(this.proto, insn.a, insn.pc + insn.width);
    const fieldName = this.nextFieldName(insn);
    const mutable = captures.some((capture) => capture.capture?.type === CaptureType.REF);
    const selfCaptured = captures.some((capture) => capture.capture?.source === insn.a);
    const preferred = debug ?? fieldName ?? "function";
    const name = this.allocator.reserve(preferred);

    // Build the capture bindings for the child.
    const captureMap = new Map<number, CaptureBinding>();
    captures.forEach((cap, index) => {
      const source = cap.capture!.source;
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
          refName = this.allocator.reserve(child.upvalueNames[index] ?? "value");
          this.env.set(source, { name: refName, expression: ident(refName), pinned: true });
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
    };

    if (selfCaptured || mutable) {
      this.env.set(insn.a, { name, expression: ident(name), pinned: true });
      this.declareInScope(name);
      return [
        ...statements,
        { kind: "local", names: [name], values: [] },
        { kind: "assign", targets: [ident(name)], values: [fn] },
      ];
    }
    this.env.set(insn.a, { name, expression: ident(name), pinned: true });
    if (fieldName) {
      this.closureFields.set(name, { fieldName, tableRegister: this.nextFieldTable(insn), fn, params: reconstructed.params, isVararg: child.isVararg });
    }
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

  private capturesAfter(pc: number): DecodedInstruction[] {
    const captures: DecodedInstruction[] = [];
    for (const insn of this.proto.instructions) {
      if (insn.pc > pc && insn.opcode === Opcode.CAPTURE) {
        captures.push(insn);
      } else if (insn.pc > pc && insn.opcode !== Opcode.CAPTURE) {
        break;
      }
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
      if (this.openPacks.has(register) || (binding && isPackish(binding.expression))) {
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
        (insn.opcode === Opcode.CALL && insn.b === 0 && register >= insn.a + 1) ||
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
          this.env.set(moves[i]!.src, { name: names[i], expression: ident(names[i]!), pinned: true });
        }
        return [{ kind: "local", names, values: [source.expression] }];
      }
    }
    return this.define(insn.a, this.readRegister(insn.b, insn), insn);
  }

  // -------------------------------------------------------- tables details

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
    if (previous >= 0 && isPureValue(pending.fields[previous]!.value)) {
      pending.fields.splice(previous, 1);
    }
  }

  private dupTableFields(index: number): TableField[] {
    const constant = this.proto.constants[index];
    if (!constant) {
      return [];
    }
    if (constant.kind === "table") {
      return constant.keys.flatMap((key) => {
        const entry = this.proto.constants[key];
        if (entry?.kind === "string") {
          return [{ name: entry.value, value: lit(null) }];
        }
        return [];
      });
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

  private define(register: number, expression: Expression, insn: DecodedInstruction, forceLocal = false): Statement[] {
    const debug = debugNameAt(this.proto, register, insn.pc + insn.width);
    const uses = this.useCount(register, insn.pc);
    const liveAcrossBlocks = this.usedOutsideBlock(register, insn);
    const phi = this.phiBinding(register, insn);
    // A literal nil has no identity worth keeping in a local: only a debug
    // name or a phi (real variable slot) pins it.
    const nilLiteral = isNilLiteral(expression);
    const pin =
      forceLocal ||
      Boolean(debug) ||
      (!nilLiteral && (uses > 1 || liveAcrossBlocks)) ||
      this.isEscaping(expression) ||
      phi !== undefined;
    if (pin) {
      const preferred = debug ?? nameHint(expression) ?? "value";
      if (expression.kind === "identifier" && expression.name === preferred && !forceLocal && !debug && phi === undefined) {
        this.env.set(register, { name: preferred, expression, pinned: true });
        return [];
      }
      const existing = phi;
      const nilLiteral = isNilLiteral(expression);
      if (existing) {
        if (!this.isDeclaredInScope(existing)) {
          this.declareInScope(existing);
          this.env.set(register, { name: existing, expression: ident(existing), pinned: true, nilLiteral });
          return [{ kind: "local", names: [existing], values: [expression] }];
        }
        this.env.set(register, { name: existing, expression: ident(existing), pinned: true, nilLiteral });
        return [{ kind: "assign", targets: [ident(existing)], values: [expression] }];
      }
      const name = this.allocator.reserve(preferred);
      this.declareInScope(name);
      this.env.set(register, { name, expression: ident(name), pinned: true, nilLiteral });
      return [{ kind: "local", names: [name], values: [expression] }];
    }
    this.env.set(register, { name: undefined, expression, pinned: false, nilLiteral: isNilLiteral(expression) });
    return [];
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
      if (insn.uses.includes(register) && !isFakeUse(insn.opcode) && !this.fallbackCalls.has(insn.pc)) {
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
    if (existing?.name && existing.pinned && !this.redefinedInBlock(home, insn.pc, register)) {
      return existing.name;
    }
    for (const succ of this.ir.cfg.blocks[home]?.successors ?? []) {
      const phi = this.ir.ssa.phis.get(succ)?.find((node) => node.register === register);
      if (!phi) {
        continue;
      }
      // The definition only flows into the phi when the register is not
      // redefined later in the same block; otherwise it is a temporary (e.g.
      // `GETIMPORT f` followed by `CALL f` reuses the register for the result).
      if (this.redefinedInBlock(home, insn.pc, register)) {
        continue;
      }
      const key = `phi:${succ}:${register}`;
      if (this.deadLoopPhis.has(key)) {
        continue;
      }
      return this.phiNameFor(key, register, this.ir.cfg.blocks[succ]!.startPc);
    }
    const homePhi = this.ir.ssa.phis.get(home)?.find((node) => node.register === register);
    if (homePhi) {
      const key = `phi:${home}:${register}`;
      if (this.deadLoopPhis.has(key)) {
        return undefined;
      }
      return this.phiNameFor(key, register, this.ir.cfg.blocks[home]!.startPc);
    }
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

function fallbackParam(index: number, total: number): string {
  if (total === 1) {
    return "value";
  }
  return ["value", "index", "count", "options"][index] ?? `arg${index}`;
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
  switch (opcode) {
    case Opcode.FASTCALL:
    case Opcode.FASTCALL1:
    case Opcode.FASTCALL2:
    case Opcode.FASTCALL2K:
    case Opcode.FASTCALL3:
      return true;
    default:
      return false;
  }
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

/** Converts `[1] = a, [2] = b, ...` keyed fields back to positional fields. */
function normalizeArrayFields(fields: TableField[]): TableField[] {
  let position = 1;
  let allPositional = true;
  for (const field of fields) {
    if (field.key?.kind === "literal" && typeof field.key.value === "number" && field.key.value === position) {
      position += 1;
      continue;
    }
    allPositional = false;
    break;
  }
  if (!allPositional || fields.length === 0) {
    return fields;
  }
  return fields.map((field) => ({ value: field.value }));
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
  const walkExpr = (expression: Expression): Expression => {
    if (expression.kind === "identifier") {
      const next = rename.get(expression.name);
      return next ? { ...expression, name: next } : expression;
    }
    if (expression.kind === "unary") {
      return { ...expression, argument: walkExpr(expression.argument) };
    }
    if (expression.kind === "binary") {
      return { ...expression, left: walkExpr(expression.left), right: walkExpr(expression.right) };
    }
    if (expression.kind === "call") {
      return { ...expression, callee: walkExpr(expression.callee), args: expression.args.map(walkExpr) };
    }
    if (expression.kind === "method-call") {
      return { ...expression, object: walkExpr(expression.object), args: expression.args.map(walkExpr) };
    }
    if (expression.kind === "index") {
      return { ...expression, table: walkExpr(expression.table), key: walkExpr(expression.key) };
    }
    if (expression.kind === "property") {
      return { ...expression, object: walkExpr(expression.object) };
    }
    if (expression.kind === "function-expr") {
      return { ...expression, body: renameIdentifiers(expression.body, rename) };
    }
    if (expression.kind === "paren") {
      return { ...expression, expression: walkExpr(expression.expression) };
    }
    if (expression.kind === "table") {
      return {
        ...expression,
        fields: expression.fields.map((field) => ({
          ...field,
          key: field.key ? walkExpr(field.key) : undefined,
          value: walkExpr(field.value),
        })),
      };
    }
    if (expression.kind === "if-expr") {
      return {
        ...expression,
        test: walkExpr(expression.test),
        consequent: walkExpr(expression.consequent),
        branches: expression.branches.map((branch) => ({
          test: walkExpr(branch.test),
          value: walkExpr(branch.value),
        })),
        alternate: walkExpr(expression.alternate),
      };
    }
    if (expression.kind === "interp") {
      return {
        ...expression,
        parts: expression.parts.map((part) =>
          part.kind === "expr" && typeof part.value !== "string"
            ? { kind: "expr" as const, value: walkExpr(part.value) }
            : part,
        ),
      };
    }
    return expression;
  };
  const walkStmt = (statement: Statement): Statement => {
    switch (statement.kind) {
      case "local":
        return { ...statement, values: statement.values.map(walkExpr) };
      case "assign":
        return { ...statement, targets: statement.targets.map(walkExpr), values: statement.values.map(walkExpr) };
      case "expression-stmt":
        return { ...statement, expression: walkExpr(statement.expression) };
      case "return":
        return { ...statement, values: statement.values.map(walkExpr) };
      case "if":
        return {
          ...statement,
          test: walkExpr(statement.test),
          consequent: renameIdentifiers(statement.consequent, rename),
          branches: statement.branches.map((branch) => ({
            test: walkExpr(branch.test),
            body: renameIdentifiers(branch.body, rename),
          })),
          alternate: statement.alternate ? renameIdentifiers(statement.alternate, rename) : undefined,
        };
      case "while":
        return { ...statement, test: walkExpr(statement.test), body: renameIdentifiers(statement.body, rename) };
      case "repeat":
        return { ...statement, test: walkExpr(statement.test), body: renameIdentifiers(statement.body, rename) };
      case "numeric-for":
        return {
          ...statement,
          start: walkExpr(statement.start),
          stop: walkExpr(statement.stop),
          step: statement.step ? walkExpr(statement.step) : undefined,
          body: renameIdentifiers(statement.body, rename),
        };
      case "generic-for":
        return { ...statement, iterators: statement.iterators.map(walkExpr), body: renameIdentifiers(statement.body, rename) };
      case "do":
        return { ...statement, body: renameIdentifiers(statement.body, rename) };
      case "function-decl":
        return { ...statement, body: renameIdentifiers(statement.body, rename) };
      default:
        return statement;
    }
  };
  return { kind: "block", statements: body.statements.map(walkStmt) };
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
