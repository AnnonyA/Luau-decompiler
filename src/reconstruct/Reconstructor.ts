import type { BinaryOperator, Block, Expression, Statement, TableField } from "../ast/Ast.js";
import { block, ident, lit } from "../ast/Ast.js";
import { buildControlFlowGraph, type BasicBlock, type ControlFlowGraph } from "../cfg/ControlFlowGraph.js";
import { computeDominators, type DominatorTree } from "../cfg/Dominators.js";
import { findNaturalLoops, type NaturalLoop } from "../cfg/NaturalLoops.js";
import { constantAsLuauLiteral, type LuauConstant } from "../decode/Constant.js";
import type { DecodedInstruction } from "../decode/DecodedInstruction.js";
import { CaptureType, Opcode } from "../decode/Opcode.js";
import type { BytecodeModule, Prototype } from "../decode/Prototype.js";
import { buildSsa, type SsaFunction } from "../ssa/SsaBuilder.js";
import { NameAllocator, debugNameAt, isValidIdentifier } from "./Naming.js";
import { nameFromMethod, nameFromProperty } from "./RobloxSemantics.js";

export interface FunctionIr {
  cfg: ControlFlowGraph;
  dominators: DominatorTree;
  ssa: SsaFunction;
  loops: NaturalLoop[];
}

export function analyzePrototype(prototype: Prototype): FunctionIr {
  const cfg = buildControlFlowGraph(prototype);
  const dominators = computeDominators(cfg);
  const ssa = buildSsa(cfg, dominators);
  const loops = findNaturalLoops(cfg, dominators);
  return { cfg, dominators, ssa, loops };
}

export interface ReconstructedFunction {
  name?: string;
  params: string[];
  isVararg: boolean;
  body: Block;
  ir: FunctionIr;
}

export function reconstructFunction(
  module: BytecodeModule,
  proto: Prototype,
  parentAllocator?: NameAllocator,
): ReconstructedFunction {
  const ir = analyzePrototype(proto);
  const allocator = parentAllocator ?? new NameAllocator();
  const builder = new SourceBuilder(module, proto, ir, allocator);
  return {
    name: proto.debugName,
    params: builder.params,
    isVararg: proto.isVararg,
    body: block(builder.build()),
    ir,
  };
}

class SourceBuilder {
  readonly params: string[] = [];
  private readonly env = new Map<number, Binding>();
  private readonly emitted = new Set<number>();
  private readonly loopByHeader: Map<number, NaturalLoop>;
  private readonly consumed = new Set<number>();
  private readonly phiNames = new Map<string, string>();
  private readonly declaredPhis = new Set<string>();

  constructor(
    private readonly module: BytecodeModule,
    private readonly proto: Prototype,
    private readonly ir: FunctionIr,
    private readonly allocator: NameAllocator,
  ) {
    this.loopByHeader = new Map(ir.loops.map((loop) => [loop.header, loop]));
    for (let i = 0; i < proto.numParams; i++) {
      const debug = debugNameAt(proto, i, 0) ?? fallbackParam(i, proto.numParams);
      const name = this.allocator.reserve(debug);
      this.params.push(name);
      this.env.set(i, { name, expression: ident(name), pinned: true });
    }
  }

  build(): Statement[] {
    return this.emitRange(0, undefined, new Set());
  }

  private emitRange(start: number, stop: number | undefined, visited: Set<number>): Statement[] {
    const statements: Statement[] = [];
    let current: number | undefined = start;
    while (current !== undefined && current !== stop) {
      if (visited.has(current)) {
        break;
      }
      const block = this.ir.cfg.blocks[current];
      if (!block || block.unreachable) {
        break;
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
        current = block.successors[0];
        continue;
      }
      break;
    }
    return statements;
  }

  private emitLoop(loop: NaturalLoop, visited: Set<number>): Statement[] {
    const header = this.ir.cfg.blocks[loop.header]!;
    if (loop.kind === "numeric-for") {
      return [this.emitNumericFor(loop, header, visited)];
    }
    if (loop.kind === "generic-for") {
      return [this.emitGenericFor(loop, header, visited)];
    }
    if (loop.kind === "repeat") {
      const latch = this.ir.cfg.blocks[loop.latch]!;
      const last = latch.instructions.at(-1);
      if (last) {
        this.consumed.add(last.pc);
      }
      const marked = new Set(visited);
      marked.add(loop.header);
      const body =
        loop.header === loop.latch
          ? this.emitStraight(header)
          : this.emitLoopBody(loop, marked, loop.header, loop.header);
      return [
        {
          kind: "repeat",
          body: block(body),
          test: last ? this.conditionFrom(last, false) : ident("false"),
        },
      ];
    }
    const last = header.instructions.at(-1);
    let test: Expression = { kind: "literal", value: true };
    let bodyStart = loop.header;
    if (last && isCompare(last.opcode)) {
      test = this.conditionFrom(last, loop.kind !== "while");
      this.consumed.add(last.pc);
      const bodyCandidate = header.successors.find((id) => loop.blocks.includes(id) && id !== loop.header);
      if (bodyCandidate !== undefined) {
        bodyStart = bodyCandidate;
      }
    }
    if (loop.kind === "infinite") {
      test = lit(true);
    }
    const body = this.emitLoopBody(loop, visited, bodyStart === loop.header ? loop.header : bodyStart, loop.header);
    return [{ kind: "while", test, body: block(body) }];
  }

  private emitLoopBody(loop: NaturalLoop, visited: Set<number>, start: number, skipHeader?: number): Statement[] {
    const inner = new Set(visited);
    if (skipHeader !== undefined) {
      inner.add(skipHeader);
    }
    const follow = this.loopFollow(loop);
    return this.emitRange(start, follow, inner);
  }

  private emitNumericFor(loop: NaturalLoop, header: BasicBlock, visited: Set<number>): Statement {
    const prep = findOpcode(this.ir.cfg, Opcode.FORNPREP, loop.blocks) ?? header.instructions[0];
    const base = prep?.a ?? 0;
    const name = this.bindLocal(base + 3, prep?.pc ?? header.startPc, "index");
    const start = this.readRegister(base + 2, prep);
    const stop = this.readRegister(base, prep);
    const stepExpr = this.readRegister(base + 1, prep);
    const step = isLiteralOne(stepExpr) ? undefined : stepExpr;
    const follow = this.loopFollow(loop);
    const bodyStart = header.successors.find((id) => loop.blocks.includes(id)) ?? loop.header;
    const body = this.emitRange(bodyStart, follow, new Set([...visited, loop.header]));
    return { kind: "numeric-for", name, start, stop, step, body: block(body) };
  }

  private emitGenericFor(loop: NaturalLoop, header: BasicBlock, visited: Set<number>): Statement {
    const loopInsn = header.instructions.find((insn) => insn.opcode === Opcode.FORGLOOP) ?? header.instructions.at(-1);
    const base = loopInsn?.a ?? 0;
    const count = loopInsn?.aux !== undefined ? loopInsn.aux & 0xff : 2;
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      names.push(this.bindLocal(base + 3 + i, loopInsn?.pc ?? header.startPc, i === 0 ? "key" : "value"));
    }
    const iterators = [this.readRegister(base, loopInsn), this.readRegister(base + 1, loopInsn)];
    const follow = this.loopFollow(loop);
    const bodyStart = header.successors.find((id) => id !== follow && loop.blocks.includes(id)) ?? loop.header;
    const body = this.emitRange(bodyStart, follow, new Set([...visited, loop.header]));
    return { kind: "generic-for", names, iterators, body: block(body) };
  }

  private loopFollow(loop: NaturalLoop): number | undefined {
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

  private tryIf(
    basic: BasicBlock,
    stop: number | undefined,
    visited: Set<number>,
  ): { statements: Statement[]; follow: number | undefined } | undefined {
    const last = basic.instructions.at(-1);
    if (!last || !isCompare(last.opcode) || basic.successors.length !== 2) {
      return undefined;
    }
    const thenId = basic.fallthrough;
    const elseId = basic.branch;
    if (thenId === undefined || elseId === undefined) {
      return undefined;
    }
    const join = this.commonJoin(thenId, elseId, stop);
    if (join === undefined && stop === undefined && this.ir.dominators.dominates(basic.id, thenId) === false) {
      return undefined;
    }
    this.consumed.add(last.pc);
    const statements = this.emitStraight(basic);
    if (join !== undefined) {
      for (const phi of this.ir.ssa.phis.get(join) ?? []) {
        const key = `phi:${join}:${phi.register}`;
        if (!this.phiNames.has(key)) {
          const debug = debugNameAt(this.proto, phi.register, this.ir.cfg.blocks[join]!.startPc);
          this.phiNames.set(key, this.allocator.reserve(debug ?? "result"));
        }
        const name = this.phiNames.get(key)!;
        if (!this.declaredPhis.has(key)) {
          this.declaredPhis.add(key);
          statements.push({ kind: "local", names: [name], values: [] });
          this.env.set(phi.register, { name, expression: ident(name), pinned: true });
        }
      }
    }
    const test = this.conditionFrom(last, false);
    const consequent = block(this.emitRange(thenId, join ?? stop, new Set(visited)));
    const alternateStmts = this.emitRange(elseId, join ?? stop, new Set(visited));
    const ifStmt: Statement = {
      kind: "if",
      test,
      consequent,
      branches: [],
      alternate: alternateStmts.length > 0 ? block(alternateStmts) : undefined,
    };
    return { statements: [...statements, ifStmt], follow: join };
  }

  private commonJoin(a: number, b: number, stop: number | undefined): number | undefined {
    const seenA = new Set<number>();
    const walk = (start: number, into: Set<number>): void => {
      const stack = [start];
      while (stack.length > 0) {
        const id = stack.pop()!;
        if (into.has(id) || id === stop) {
          continue;
        }
        into.add(id);
        for (const succ of this.ir.cfg.blocks[id]?.successors ?? []) {
          stack.push(succ);
        }
      }
    };
    walk(a, seenA);
    const seenB = new Set<number>();
    walk(b, seenB);
    const joins = [...seenA].filter((id) => seenB.has(id) && id !== a && id !== b);
    joins.sort((x, y) => x - y);
    return joins[0];
  }

  private emitStraight(basic: BasicBlock): Statement[] {
    const statements: Statement[] = [];
    let pendingTable: { register: number; fields: TableField[] } | undefined;

    const flushTable = (): void => {
      if (!pendingTable) {
        return;
      }
      const name = this.bindLocal(pendingTable.register, basic.startPc, "config");
      statements.push({ kind: "local", names: [name], values: [{ kind: "table", fields: pendingTable.fields }] });
      pendingTable = undefined;
    };

    for (const insn of basic.instructions) {
      if (this.consumed.has(insn.pc) || isControlOnly(insn.opcode)) {
        continue;
      }
      if (pendingTable && !isTableWrite(insn, pendingTable.register)) {
        flushTable();
      }
      const produced = this.interpret(insn, pendingTable);
      if (produced.pendingTable) {
        pendingTable = produced.pendingTable;
      }
      statements.push(...produced.statements);
    }
    flushTable();
    this.emitted.add(basic.id);
    return statements;
  }

  private interpret(
    insn: DecodedInstruction,
    pendingTable?: { register: number; fields: TableField[] },
  ): { statements: Statement[]; pendingTable?: { register: number; fields: TableField[] } } {
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
        statements.push(...this.define(insn.a, this.readRegister(insn.b, insn), insn));
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
        statements.push(...this.define(insn.a, ident(this.proto.upvalueNames[insn.b] ?? `up${insn.b}`), insn));
        break;
      case Opcode.SETUPVAL:
        statements.push({
          kind: "assign",
          targets: [ident(this.proto.upvalueNames[insn.b] ?? `up${insn.b}`)],
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
          pendingTable.fields.push({ name, value: this.readRegister(insn.a, insn) });
          return { statements, pendingTable };
        }
        statements.push({
          kind: "assign",
          targets: [
            name && isValidIdentifier(name)
              ? { kind: "property", object, name }
              : { kind: "index", table: object, key: this.constantExpr(insn.constantIndex ?? 0) },
          ],
          values: [this.readRegister(insn.a, insn)],
        });
        break;
      }
      case Opcode.SETTABLEN:
        if (pendingTable && pendingTable.register === insn.b) {
          pendingTable.fields.push({ value: this.readRegister(insn.a, insn) });
          return { statements, pendingTable };
        }
        statements.push({
          kind: "assign",
          targets: [{ kind: "index", table: this.readRegister(insn.b, insn), key: lit(insn.c + 1) }],
          values: [this.readRegister(insn.a, insn)],
        });
        break;
      case Opcode.NEWTABLE:
        return { statements, pendingTable: { register: insn.a, fields: [] } };
      case Opcode.DUPTABLE: {
        const keys = this.tableKeys(insn.d);
        return { statements, pendingTable: { register: insn.a, fields: keys.map((name) => ({ name, value: lit(nilish()) })) } };
      }
      case Opcode.SETLIST: {
        const count = insn.c === 0 ? 0 : insn.c - 1;
        const fields: TableField[] = [];
        for (let i = 0; i < count; i++) {
          fields.push({ value: this.readRegister(insn.b + i, insn) });
        }
        if (pendingTable && pendingTable.register === insn.a) {
          pendingTable.fields.push(...fields);
          statements.push(...this.define(insn.a, { kind: "table", fields: pendingTable.fields }, insn, true));
          return { statements };
        }
        statements.push(...this.define(insn.a, { kind: "table", fields }, insn, true));
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
        this.define(insn.a + 1, this.readRegister(insn.b, insn), insn);
        break;
      case Opcode.CALL:
      case Opcode.CALLFB: {
        const resultCount = insn.call?.resultCount ?? 0;
        const argCount = insn.call?.argumentCount ?? 0;
        const calleeBinding = this.env.get(insn.a);
        let expression: Expression;
        if (calleeBinding?.expression.kind === "method-call") {
          const args: Expression[] = [];
          const n = argCount === "multret" ? 1 : Math.max(argCount - 1, 0);
          for (let i = 0; i < n; i++) {
            args.push(this.readRegister(insn.a + 2 + i, insn));
          }
          expression = { ...calleeBinding.expression, args, open: argCount === "multret" };
        } else {
          const args: Expression[] = [];
          const n = argCount === "multret" ? 0 : argCount;
          for (let i = 0; i < n; i++) {
            args.push(this.readRegister(insn.a + 1 + i, insn));
          }
          if (argCount === "multret") {
            args.push(this.readRegister(insn.a + 1, insn));
          }
          expression = { kind: "call", callee: this.readRegister(insn.a, insn), args, open: argCount === "multret" };
        }
        if (resultCount === 0) {
          statements.push({ kind: "expression-stmt", expression });
        } else if (resultCount === "multret") {
          statements.push(...this.define(insn.a, expression, insn, !this.isOpenPackForwarded(insn.a, insn.pc)));
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
          statements.push(
            ...this.define(insn.a, { kind: "vararg" }, insn, !this.isOpenPackForwarded(insn.a, insn.pc)),
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
      case Opcode.NEWCLOSURE: {
        const childId = this.proto.childProtoIds[insn.d];
        const child = childId !== undefined ? this.module.prototypes[childId] : undefined;
        const captures = this.capturesAfter(insn.pc);
        const reconstructed = child
          ? reconstructFunction(this.module, child, new NameAllocator(this.allocatorReserved()))
          : undefined;
        const fn: Expression = {
          kind: "function-expr",
          params: reconstructed?.params ?? [],
          isVararg: child?.isVararg ?? false,
          body: reconstructed?.body ?? block([]),
        };
        const debug = child?.debugName ?? debugNameAt(this.proto, insn.a, insn.pc + insn.width);
        const mutable = captures.some((capture) => capture.capture?.type === CaptureType.REF);
        if (debug && !mutable) {
          const name = this.allocator.reserve(debug);
          this.env.set(insn.a, { name, expression: ident(name), pinned: true });
          statements.push({
            kind: "function-decl",
            local: true,
            name,
            params: reconstructed?.params ?? [],
            isVararg: child?.isVararg ?? false,
            body: reconstructed?.body ?? block([]),
          });
        } else if (debug && mutable) {
          const name = this.allocator.reserve(debug);
          statements.push({ kind: "local", names: [name], values: [] });
          statements.push({ kind: "assign", targets: [ident(name)], values: [fn] });
          this.env.set(insn.a, { name, expression: ident(name), pinned: true });
        } else {
          statements.push(...this.define(insn.a, fn, insn));
        }
        break;
      }
      case Opcode.DUPCLOSURE: {
        const constant = this.proto.constants[insn.d];
        if (constant?.kind === "closure") {
          const child = this.module.prototypes[constant.protoId];
          const reconstructed = child
            ? reconstructFunction(this.module, child, new NameAllocator(this.allocatorReserved()))
            : undefined;
          statements.push(
            ...this.define(
              insn.a,
              {
                kind: "function-expr",
                params: reconstructed?.params ?? [],
                isVararg: child?.isVararg ?? false,
                body: reconstructed?.body ?? block([]),
              },
              insn,
            ),
          );
        }
        break;
      }
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

  private define(register: number, expression: Expression, insn: DecodedInstruction, forceLocal = false): Statement[] {
    const debug = debugNameAt(this.proto, register, insn.pc + insn.width);
    const uses = this.useCount(register, insn.pc);
    const liveAcrossBlocks = this.usedOutsideBlock(register, insn);
    const pin = forceLocal || Boolean(debug) || uses > 1 || liveAcrossBlocks || this.isEscaping(expression);
    if (pin) {
      const preferred = debug ?? nameHint(expression) ?? "value";
      if (expression.kind === "identifier" && expression.name === preferred && !forceLocal && !debug) {
        this.env.set(register, { name: preferred, expression, pinned: true });
        return [];
      }
      const existing = this.phiBinding(register, insn);
      if (existing) {
        this.env.set(register, { name: existing, expression: ident(existing), pinned: true });
        return [{ kind: "assign", targets: [ident(existing)], values: [expression] }];
      }
      const name = this.allocator.reserve(preferred);
      this.env.set(register, { name, expression: ident(name), pinned: true });
      return [{ kind: "local", names: [name], values: [expression] }];
    }
    this.env.set(register, { name: undefined, expression, pinned: false });
    return [];
  }

  private usedOutsideBlock(register: number, insn: DecodedInstruction): boolean {
    const home = this.ir.cfg.blockOfPc.get(insn.pc);
    for (const next of this.proto.instructions) {
      if (next.pc <= insn.pc) {
        continue;
      }
      if (next.uses.includes(register) && this.ir.cfg.blockOfPc.get(next.pc) !== home) {
        return true;
      }
      if (next.defs.includes(register)) {
        return false;
      }
    }
    return false;
  }

  private phiBinding(register: number, insn: DecodedInstruction): string | undefined {
    const home = this.ir.cfg.blockOfPc.get(insn.pc);
    if (home === undefined) {
      return undefined;
    }
    for (const succ of this.ir.cfg.blocks[home]?.successors ?? []) {
      const phi = this.ir.ssa.phis.get(succ)?.find((node) => node.register === register);
      if (!phi) {
        continue;
      }
      const key = `phi:${succ}:${register}`;
      const existing = this.env.get(register);
      if (existing?.name && existing.pinned) {
        return existing.name;
      }
      const named = this.phiNames.get(key);
      if (named) {
        return named;
      }
      const debug = debugNameAt(this.proto, register, this.ir.cfg.blocks[succ]!.startPc);
      const name = this.allocator.reserve(debug ?? "result");
      this.phiNames.set(key, name);
      return name;
    }
    return undefined;
  }

  private bindLocal(register: number, pc: number, role: string): string {
    const debug = debugNameAt(this.proto, register, pc);
    const name = this.allocator.reserve(debug ?? role);
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
    const text = constantAsLuauLiteral(constant);
    return text ? ident(text) : lit(null);
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

  private tableKeys(index: number): string[] {
    const constant = this.proto.constants[index];
    if (constant?.kind !== "table") {
      return [];
    }
    return constant.keys.flatMap((key) => {
      const entry = this.proto.constants[key];
      return entry?.kind === "string" ? [entry.value] : [];
    });
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

  private conditionFrom(insn: DecodedInstruction, invert: boolean): Expression {
    let test: Expression;
    switch (insn.opcode) {
      case Opcode.JUMPIF:
        test = this.readRegister(insn.a, insn);
        invert = !invert;
        break;
      case Opcode.JUMPIFNOT:
        test = this.readRegister(insn.a, insn);
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

  private useCount(register: number, fromPc: number): number {
    let count = 0;
    for (const insn of this.proto.instructions) {
      if (insn.pc <= fromPc) {
        continue;
      }
      if (insn.uses.includes(register)) {
        count += 1;
      }
      if (insn.defs.includes(register)) {
        break;
      }
    }
    return count;
  }

  private isEscaping(expression: Expression): boolean {
    return expression.kind === "function-expr" || expression.kind === "table";
  }

  private isTerminalReturn(insn: DecodedInstruction): boolean {
    return insn === this.proto.instructions.at(-1) && insn.b === 1;
  }

  private isOpenPackForwarded(register: number, fromPc: number): boolean {
    for (const insn of this.proto.instructions) {
      if (insn.pc <= fromPc) {
        continue;
      }
      if (
        (insn.opcode === Opcode.RETURN && insn.b === 0 && insn.a === register) ||
        (insn.opcode === Opcode.CALL && insn.b === 0 && insn.a + 1 === register) ||
        (insn.opcode === Opcode.SETLIST && insn.c === 0 && insn.b === register)
      ) {
        return true;
      }
      return false;
    }
    return false;
  }

  private allocatorReserved(): Iterable<string> {
    return this.params;
  }
}

interface Binding {
  name?: string;
  expression: Expression;
  pinned: boolean;
  methodSelf?: number;
}

function fallbackParam(index: number, total: number): string {
  if (total === 1) {
    return "value";
  }
  return ["self", "index", "count", "options"][index] ?? `arg${index}`;
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
  if (expression.kind === "call" && expression.callee.kind === "property") {
    return nameFromMethod(expression.callee.name, expression.args);
  }
  if (expression.kind === "property") {
    return nameFromProperty(expression.name) ?? (isValidIdentifier(expression.name) ? lowerIdent(expression.name) : undefined);
  }
  if (expression.kind === "identifier") {
    return expression.name;
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

function isTableWrite(insn: DecodedInstruction, register: number): boolean {
  return (
    ((insn.opcode === Opcode.SETTABLEKS || insn.opcode === Opcode.SETTABLEN || insn.opcode === Opcode.SETTABLE) &&
      insn.b === register) ||
    (insn.opcode === Opcode.SETLIST && insn.a === register)
  );
}

function findOpcode(cfg: ControlFlowGraph, opcode: Opcode, blocks: number[]): DecodedInstruction | undefined {
  for (const id of blocks) {
    const found = cfg.blocks[id]?.instructions.find((insn) => insn.opcode === opcode);
    if (found) {
      return found;
    }
  }
  return undefined;
}

function isLiteralOne(expression: Expression): boolean {
  return expression.kind === "literal" && expression.value === 1;
}

function nilish(): null {
  return null;
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

export function materializeLocals(statements: Statement[]): Statement[] {
  return statements;
}

export type { LuauConstant };
