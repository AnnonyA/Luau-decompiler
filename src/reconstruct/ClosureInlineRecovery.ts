import {analyzeBindings, renameFreeBindings, replaceReferences, type LexicalBinding} from '../analysis/Bindings.js';
import {block, ident, type Block, type Chunk, type Expression, type FunctionExpression, type Statement} from '../ast/Ast.js';
import {cloneAst} from '../ast/AstClone.js';
import {CaptureType, Opcode} from '../decode/Opcode.js';
import type {BytecodeModule} from '../decode/Prototype.js';
import type {Diagnostic} from '../diagnostics.js';
import {NameAllocator} from './Naming.js';
import {rewriteRegisterCount} from './RegisterBudget.js';

export interface ClosureFactoryRecovery {
  ast: Chunk;
  requiresOptimization2: boolean;
  diagnostics: Diagnostic[];
}

type FunctionNode = FunctionExpression | Extract<Statement, {kind: 'function-decl'}>;
interface Scope { body: Block; depth: number; params: number }
interface Site { fn: FunctionExpression; captures: LexicalBinding[] }

/**
 * Recover only the tiny closure-producing factory evidenced by retained
 * NEWCLOSURE/CAPTURE/RETURN bytecode. Recompilation must use pinned Luau O2.
 *
 * This does not implement a Lua cache: the two reconstructed call sites inline
 * into their original owner and load the same native K. Its preload, raw
 * capture comparisons, environment guard and lifetime remain VM operations.
 *
 * The compiler has two independent gates. The helper must inline, and each
 * captured argument must propagate an unwritten function literal initializer
 * into shouldShareClosure. Merely equal SSA values or local aliases do not
 * establish the second condition. Reject the whole owner/K group on doubt.
 *
 * See official Compiler.cpp 941-1033, 1220-1265 and 1659-1768 at
 * 9d7748a4f324213a18cb8283fa2a77c330225fa0. Independently implemented.
 */
export function recoverClosureFactories(input: Chunk, module: BytecodeModule): ClosureFactoryRecovery {
  const ast = cloneAst(input);
  const diagnostics: Diagnostic[] = [];
  const analysis = analyzeBindings(ast.body);
  // Direct uses of these globals disable inlining throughout the module.
  // An aliased _G field is deliberately not treated as the direct builtin.
  if (analysis.globals.has('getfenv') || analysis.globals.has('setfenv'))
    return {ast, requiresOptimization2: false, diagnostics};
  // Forcing O2 must not turn an original capture-free NEW into DUP. Ordinary
  // official optimized input does not mix this with the lineage accepted here;
  // hand-written bytecode and constant-pool overflow can, so refuse it.
  if (module.prototypes.some(p => p.instructions.some(i => i.opcode === Opcode.NEWCLOSURE &&
    module.prototypes[p.childProtoIds[i.d] ?? -1]?.numUpvalues === 0)))
    return {ast, requiresOptimization2: false, diagnostics};

  const byRead = new Map<object, LexicalBinding>();
  for (const binding of analysis.bindings)
    for (const read of binding.reads) byRead.set(read.node, binding);
  const names = new NameAllocator([...analysis.globals, ...analysis.bindings.map(b => b.name)]);
  const scopes: Scope[] = [{body: ast.body, depth: 0, params: 0}];
  function collectScopes(node: unknown, depth: number): void {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {for (const child of node) collectScopes(child, depth); return;}
    const value = node as FunctionNode;
    if (value.kind === 'function-expr' || value.kind === 'function-decl') {
      scopes.push({body: value.body, depth: depth + 1, params: value.params.length});
      collectScopes(value.body, depth + 1);
      return;
    }
    for (const child of Object.values(node)) collectScopes(child, depth);
  }
  collectScopes(ast.body, 0);

  let requiresOptimization2 = false;
  for (const scope of scopes.reverse()) {
    const groups = new Map<string, FunctionExpression[]>();
    walkOwn(scope.body, fn => {
      const evidence = fn.closureIdentity;
      if (!evidence || evidence.captureCount === 0) return;
      const key = `${evidence.ownerProtoId}:${evidence.constantIndex}`;
      const group = groups.get(key) ?? [];
      group.push(fn); groups.set(key, group);
    });
    const repeated = [...groups.values()].filter(group => group.length > 1);
    if (!repeated.length) continue;
    // Count all locals and all nested packs, including locals in mutually
    // exclusive branches. This overestimate leaves room below regTop=128 for
    // original parameters, helper bindings and inlined arguments/results.
    const bound = rewriteRegisterCount(analyzeBindings(scope.body).bindings, scope.body) + scope.params;
    if (bound + repeated.length * 10 > 96) {
      note(repeated[0]![0]!, 'The owner exceeds the conservative native-inline register bound.');
      continue;
    }

    const replacements = new Map<object, object>();
    const helpers: Statement[] = [];
    for (const group of repeated) {
      const first = group[0]!;
      const evidence = first.closureIdentity!;
      const count = evidence.captureCount;
      if (loadCount(module, evidence.ownerProtoId, evidence.constantIndex) !== group.length) {
        note(first, 'Not every original load of this owner/K is present in the recovered group.');
        continue;
      }
      const closed = closedChain(group, module, byRead, scope.depth);
      if (closed) {
        const name = names.reserve('closureFactory');
        const capturedName = names.reserve('capturedFunction');
        const captured: FunctionExpression = {...closed[0]!.init};
        delete captured.closureIdentity;
        const inner: FunctionExpression = {...first, body: renameFreeBindings(first.body,
          new Map([[closed[0]!.binding.name, capturedName]]))};
        delete inner.closureIdentity;
        helpers.push({kind: 'function-decl', local: true, name, params: [], isVararg: false,
          body: block([{kind: 'local', names: [capturedName], values: [captured]},
            {kind: 'return', values: [inner]}])});
        for (const site of closed) {
          replacements.set(site.declaration, {kind: 'do', body: block([])} satisfies Statement);
          replacements.set(site.fn, {kind: 'call', callee: ident(name), args: [], open: false,
            inlineForIdentity: true} satisfies Expression);
        }
        diagnostics.push({severity: 'info', code: 'closure-identity-native-inline',
          prototypeId: evidence.ownerProtoId, pc: evidence.pc,
          message: `K${evidence.constantIndex} and its captured closure keep their native owner/K pools through ` +
            'a bounded recovered closed factory. The source requires official Luau O2/default inline limits.'});
        requiresOptimization2 = true;
        continue;
      }
      if (count > 8 || !retainedFactory(module, evidence.childProtoId, count)) {
        note(first, 'No small retained closure-producing factory proves this native-inline lineage.');
        continue;
      }
      const sites: Site[] = [];
      for (const fn of group) {
        const captureNames = fn.closureIdentity!.captureNames;
        if (!captureNames || captureNames.length !== count || new Set(captureNames).size !== count ||
            containsFunction(fn.body)) break;
        const refs = new Map<string, Set<LexicalBinding>>();
        walkObjects(fn.body, node => {
          const binding = byRead.get(node);
          if (binding && binding.depth === scope.depth && captureNames.includes(binding.name)) {
            const candidates = refs.get(binding.name) ?? new Set<LexicalBinding>();
            candidates.add(binding); refs.set(binding.name, candidates);
          }
        });
        const captures: LexicalBinding[] = [];
        for (const name of captureNames) {
          const candidates = refs.get(name);
          if (candidates?.size !== 1) break;
          const binding = [...candidates][0]!;
          // Passing a parameter, upvalue, MOVEd alias, mutable cell or opaque
          // carrier result would lose the literal initializer in the compiler.
          const init = functionInitializer(binding);
          if (binding.writes.length || !init || init.closureIdentity?.captureCount !== 0) break;
          const proto = module.prototypes[init.closureIdentity.childProtoId];
          if (!proto || proto.numUpvalues !== 0) break;
          // A later capture-free dispatcher would replace these initializers
          // with register values. Such a pair must be recovered together by
          // closedChain, not by passing the values as helper arguments.
          if (loadCount(module, init.closureIdentity.ownerProtoId, init.closureIdentity.constantIndex) !== 1) break;
          captures.push(binding);
        }
        if (captures.length !== count) break;
        sites.push({fn, captures});
      }
      if (sites.length !== group.length) {
        note(first, 'Captured arguments are not direct immutable function literals in the same owner.');
        continue;
      }
      const params = Array.from({length: count}, () => names.reserve('capturedFunction'));
      const normalize = (site: Site): Block => renameFreeBindings(site.fn.body,
        new Map(site.captures.map((capture, index) => [capture.name, params[index]!] as const)));
      const template = normalize(sites[0]!);
      if (sites.some(site => site.fn.isVararg !== first.isVararg ||
          JSON.stringify(site.fn.params) !== JSON.stringify(first.params) ||
          comparable(normalize(site)) !== comparable(template))) {
        note(first, 'The complete captured closure bodies do not match after lexical substitution.');
        continue;
      }
      const name = names.reserve('closureFactory');
      const inner: FunctionExpression = {...first, body: template};
      // This is the sole physical child expression. Its actual provenance is
      // recovered by inlining, not by another source-level sharing pass.
      delete inner.closureIdentity;
      helpers.push({kind: 'function-decl', local: true, name, params, isVararg: false,
        body: block([{kind: 'return', values: [inner]}])});
      for (const site of sites) replacements.set(site.fn, {
        kind: 'call', callee: ident(name), args: site.captures.map(capture => ident(capture.name)),
        open: false, inlineForIdentity: true,
      } satisfies Expression);
      for (const site of sites) for (const capture of site.captures)
        functionInitializer(capture)!.closureIdentity!.inlineCaptureInitializer = true;
      diagnostics.push({severity: 'info', code: 'closure-identity-native-inline',
        prototypeId: evidence.ownerProtoId, pc: evidence.pc,
        message: `K${evidence.constantIndex} retains native first-capture caching through a bounded recovered factory. ` +
          'The source requires official Luau O2/default inline limits; an optimize 2 directive is emitted.'});
      requiresOptimization2 = true;
    }
    if (helpers.length) scope.body.statements = [...helpers,
      ...replaceReferences(scope.body.statements, replacements)];
  }
  return {ast, requiresOptimization2, diagnostics};

  function note(fn: FunctionExpression, reason: string): void {
    const evidence = fn.closureIdentity!;
    diagnostics.push({severity: 'warning', code: 'closure-identity-inline-unproved',
      prototypeId: evidence.ownerProtoId, pc: evidence.pc, message: reason});
  }
}

interface ClosedSite {
  fn: FunctionExpression;
  init: FunctionExpression;
  binding: LexicalBinding;
  declaration: Extract<Statement, {kind: 'local'}>;
}

/** Recover H = <closed function>; W = <function capturing H> atomically.
 * Passing separately reconstructed H values through a helper would discard
 * shouldShareClosure's literal-initializer evidence. Both native pools have to
 * come from the one physical H/W pair, as in the retained factory. */
function closedChain(group: FunctionExpression[], module: BytecodeModule,
  byRead: ReadonlyMap<object, LexicalBinding>, depth: number): ClosedSite[] | undefined {
  const first = group[0]!, identity = first.closureIdentity!;
  if (identity.captureCount !== 1) return;
  const sites: ClosedSite[] = [];
  for (const fn of group) {
    const captureNames = fn.closureIdentity?.captureNames;
    if (captureNames?.length !== 1) return;
    const nodes = new Set<object>();
    walkObjects(fn.body, node => nodes.add(node));
    const candidates = new Set([...nodes].map(node => byRead.get(node)).filter((binding): binding is LexicalBinding =>
      binding !== undefined && binding.depth === depth && binding.name === captureNames[0]));
    if (candidates.size !== 1) return;
    const binding = [...candidates][0]!, declaration = binding.declaration;
    const init = functionInitializer(binding);
    if (binding.writes.length || declaration.kind !== 'local' || declaration.names.length !== 1 ||
        declaration.values.length !== 1 || init?.kind !== 'function-expr' || init.closureIdentity?.captureCount !== 0 ||
        init.closureIdentity.ownerProtoId !== identity.ownerProtoId ||
        binding.reads.some(read => !nodes.has(read.node))) return;
    const index = binding.scope.statements.indexOf(declaration);
    const next = binding.scope.statements[index + 1];
    // This adjacency also proves that moving H into the recovered RHS cannot
    // cross a table-key lookup, argument effect or environment mutation.
    if (index < 0 || next?.kind !== 'local' || next.names.length !== 1 || next.values.length !== 1 || next.values[0] !== fn) return;
    sites.push({fn, init, binding, declaration});
  }
  const captured = sites[0]!.init.closureIdentity!;
  if (new Set(sites.map(site => site.declaration)).size !== group.length ||
      loadCount(module, identity.ownerProtoId, identity.constantIndex) !== group.length ||
      loadCount(module, captured.ownerProtoId, captured.constantIndex) !== group.length ||
      sites.some(site => site.init.closureIdentity!.constantIndex !== captured.constantIndex ||
        site.init.closureIdentity!.childProtoId !== captured.childProtoId)) return;
  if (!retainedClosedFactory(module, captured.childProtoId, identity.childProtoId)) return;
  const normalize = (site: ClosedSite): Block => renameFreeBindings(site.fn.body, new Map([[site.binding.name, '__capture']]));
  if (sites.some(site => comparable(site.init) !== comparable(sites[0]!.init) ||
      JSON.stringify(site.fn.params) !== JSON.stringify(first.params) || site.fn.isVararg !== first.isVararg ||
      comparable(normalize(site)) !== comparable(normalize(sites[0]!)))) return;
  return sites;
}

function loadCount(module: BytecodeModule, owner: number, constant: number): number {
  return module.prototypes[owner]?.instructions.filter(i => i.opcode === Opcode.DUPCLOSURE && i.d === constant).length ?? 0;
}

function retainedClosedFactory(module: BytecodeModule, capturedId: number, childId: number): boolean {
  const closureId = (proto: BytecodeModule['prototypes'][number], insn: typeof proto.instructions[number]): number | undefined => {
    if (insn.opcode === Opcode.NEWCLOSURE) return proto.childProtoIds[insn.d];
    const constant = insn.opcode === Opcode.DUPCLOSURE ? proto.constants[insn.d] : undefined;
    return constant?.kind === 'closure' ? constant.protoId : undefined;
  };
  return module.prototypes.some(proto => {
    if (proto.isVararg || proto.numParams || proto.numUpvalues) return false;
    const code = proto.instructions.filter(i => i.opcode !== Opcode.NOP && i.opcode !== Opcode.COVERAGE);
    const [captured, child, capture, result] = code;
    return code.length === 4 && !!captured && !!child && closureId(proto, captured) === capturedId &&
      closureId(proto, child) === childId && capture?.opcode === Opcode.CAPTURE &&
      capture.a === CaptureType.VAL && capture.b === captured.a && result?.opcode === Opcode.RETURN &&
      result.a === child.a && result.b === 2;
  });
}

/** A retained one-result factory records the child's original lexical origin.
 * Names, debug lines and fixture paths are not evidence. */
function retainedFactory(module: BytecodeModule, childId: number, captures: number): boolean {
  return module.prototypes.some(proto => {
    if (proto.isVararg || proto.numUpvalues !== 0 || proto.numParams !== captures) return false;
    const code = proto.instructions.filter(i => i.opcode !== Opcode.NOP && i.opcode !== Opcode.COVERAGE);
    const creation = code[0], result = code.at(-1);
    if (code.length !== captures + 2 || creation?.opcode !== Opcode.NEWCLOSURE ||
        proto.childProtoIds[creation.d] !== childId || result?.opcode !== Opcode.RETURN ||
        result.a !== creation.a || result.b !== 2) return false;
    const argumentsSeen = new Set<number>();
    for (const capture of code.slice(1, -1)) {
      if (capture.opcode !== Opcode.CAPTURE || capture.a !== CaptureType.VAL ||
          capture.b >= captures || argumentsSeen.has(capture.b)) return false;
      argumentsSeen.add(capture.b);
    }
    return argumentsSeen.size === captures;
  });
}

function functionInitializer(binding: LexicalBinding): FunctionNode | undefined {
  const declaration = binding.declaration;
  if (declaration.kind === 'function-decl' && declaration.local && binding.scope !== declaration.body) return declaration;
  const value = declaration.kind === 'local' ? declaration.values[binding.declarationIndex ?? 0] : undefined;
  return value?.kind === 'function-expr' ? value : undefined;
}

function walkOwn(node: unknown, visit: (fn: FunctionExpression) => void): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {node.forEach(child => walkOwn(child, visit)); return;}
  const value = node as FunctionNode;
  if (value.kind === 'function-expr') {visit(value); return;}
  if (value.kind === 'function-decl') return;
  for (const [key, child] of Object.entries(node)) if (key !== 'closureIdentity') walkOwn(child, visit);
}

function walkObjects(node: unknown, visit: (node: object) => void): void {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const [key, child] of Object.entries(node)) if (key !== 'closureIdentity') walkObjects(child, visit);
}

function containsFunction(body: Block): boolean {
  let found = false;
  walkObjects(body, node => {
    const kind = (node as {kind?: string}).kind;
    if (kind === 'function-expr' || kind === 'function-decl') found = true;
  });
  return found;
}

function comparable(value: unknown): string {
  return JSON.stringify(value, (key, child: unknown) =>
    ['closureIdentity', 'creationSite', 'evaluation', 'debugName', 'line', 'paramTypes', 'returnType'].includes(key) ? undefined : child);
}
