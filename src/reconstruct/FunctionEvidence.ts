import type {Block, Chunk, Expression, Statement} from '../ast/Ast.js';
import {analyzeBindings, replaceReferences, type LexicalBinding} from '../analysis/Bindings.js';
import {NameAllocator} from './Naming.js';
import {lookupRobloxService, lookupRobloxProperty, lookupRobloxMethodResult, lookupRobloxEventParameters} from './roblox-api-facts.js';

type FunctionNode = Extract<Expression | Statement, {kind:'function-expr' | 'function-decl'}>;
type Call = Extract<Expression, {kind:'call'}>;
type MethodCall = Extract<Expression, {kind:'method-call'}>;
interface FunctionInfo { node: FunctionNode; calls: Call[]; events: (readonly string[])[]; closed: boolean; returns?: string[] }
const automatic = /^(?:arg|param|value|result|tmp|item|data)\d*$/;
function union(types: Array<string | undefined>): string | undefined {
  if (!types.length || !types.every(t => t !== undefined)) return undefined;
  const distinct = [...new Set(types.flatMap(t => t.split(' | ')))];
  // Preserve primitive unions. A mixed call set cannot justify a Roblox class.
  if (distinct.length > 1 && distinct.some(type => !['number','string','boolean','nil'].includes(type))) return undefined;
  return distinct.sort().join(' | ');
}

/** Evidence from lexical identities and complete direct-call sets. This pass
 * changes names/types only: it never moves effects or substitutes expressions.
 * Escaped/reassigned functions, mutable parameters and unknown packs stay broad. */
export function recoverFunctionEvidence(ast: Chunk, options: {typeAnnotations?: 'off'|'functions'|'useful'} = {}): Chunk {
  const result = replaceReferences(ast, new Map());
  const {bindings, globals} = analyzeBindings(result.body);
  const owners = new Map<object, LexicalBinding>();
  const localRoots = new Set<Statement>();
  for (const b of bindings) for (const r of [...b.reads, ...b.writes]) {
    owners.set(r.node, b);
    if (r.declarationRoot) localRoots.add(r.statement);
  }
  const parents = new Map<object, Record<string, unknown>>();
  const typeNames = new Set<string>();
  const connects: MethodCall[] = [];
  let cleanEnvironment = !['getfenv','setfenv','_G'].some(name => globals.has(name));
  const globalGame = (e: Expression) => e.kind === 'identifier' && e.name === 'game' && !owners.has(e);
  function visit(node: unknown, parent?: Record<string, unknown>): void {
    if (!node || typeof node !== 'object') return;
    if (parent) parents.set(node, parent);
    const astNode = node as Expression | Statement;
    if (astNode.kind === 'method-call' && (astNode.name === 'Connect' || astNode.name === 'Once') &&
        astNode.args.length === 1 && !astNode.open)
      connects.push(astNode);
    if ((astNode.kind === 'assign' && astNode.targets.some(globalGame)) ||
        (astNode.kind === 'compound-assign' && globalGame(astNode.target)) ||
        (astNode.kind === 'function-decl' && !astNode.local && astNode.name === 'game' && !localRoots.has(astNode)))
      cleanEnvironment = false;
    for (const [key,value] of Object.entries(node)) {
      if (['types','paramTypes','returnType'].includes(key)) {
        for (const type of Array.isArray(value) ? value : [value])
          if (typeof type === 'string') for (const name of type.match(/[A-Za-z_]\w*/g) ?? []) typeNames.add(name);
      } else if (Array.isArray(value)) value.forEach(child => visit(child, node as Record<string,unknown>));
      else visit(value, node as Record<string,unknown>);
    }
  }
  visit(result);

  // Resolve only immutable lexical aliases. An initializer in a later slot of
  // an open result pack has no corresponding expression and stays unknown.
  function source(e: Expression): Expression | undefined {
    const seen = new Set<LexicalBinding>();
    let current: Expression | undefined = e;
    while (current) {
      if (current.kind === 'paren') { current = current.expression; continue; }
      if (current.kind !== 'identifier') return current;
      const binding = owners.get(current);
      if (!binding) return current;
      if (binding.writes.length || binding.declaration.kind !== 'local' || seen.has(binding)) return undefined;
      seen.add(binding);
      current = binding.declaration.values[binding.declarationIndex!];
    }
    return undefined;
  }
  function service(e: Expression): string | undefined {
    const call = source(e);
    if (!cleanEnvironment || call?.kind !== 'method-call' || call.name !== 'GetService' ||
        call.open || call.args.length !== 1) return undefined;
    const root = source(call.object);
    const name = call.args[0]!;
    return root && globalGame(root) && name.kind === 'literal' && typeof name.value === 'string'
      ? lookupRobloxService(name.value) : undefined;
  }
  const registrations = new Map<Expression, readonly string[]>();
  const functions: FunctionInfo[] = [];
  if (options.typeAnnotations !== 'off') for (const connect of connects) {
    const signal = source(connect.object);
    if (signal?.kind !== 'property') continue;
    const receiver = service(signal.object);
    const signature = receiver && lookupRobloxEventParameters(receiver,signal.name);
    if (!signature) continue;
    const callback = connect.args[0]!;
    registrations.set(callback,signature);
    if (callback.kind === 'function-expr') {
      functions.push({node:callback,calls:[],events:[signature],closed:true});
    }
  }
  const localFunctions = new Map<LexicalBinding, FunctionInfo>();
  for (const binding of bindings) {
    const d = binding.declaration;
    const value = d.kind === 'local' ? d.values[binding.declarationIndex!] : undefined;
    const node = d.kind === 'function-decl' && d.local && binding.scope !== d.body ? d :
      value?.kind === 'function-expr' ? value : undefined;
    if (!node || binding.writes.length) continue;
    const calls: Call[] = [];
    const events: (readonly string[])[] = [];
    let closed = binding.reads.length > 0;
    for (const reference of binding.reads) {
      const parent = parents.get(reference.node);
      const signature = registrations.get(reference.node);
      if (parent?.kind === 'call' && parent.callee === reference.node) calls.push(parent as unknown as Call);
      else if (signature) events.push(signature);
      else closed = false;
    }
    // A last unparenthesized call/vararg may supply more than one argument.
    closed &&= calls.every(c => !c.open && c.args.length === node.params.length &&
      !['call','method-call','vararg'].includes(c.args.at(-1)?.kind ?? ''));
    const fn = {node,calls,events,closed};
    localFunctions.set(binding,fn);
    functions.push(fn);
  }
  const facts = new Map<LexicalBinding,string>();
  const parameterBindings = new Map<FunctionNode, LexicalBinding[]>();
  for (const binding of bindings) {
    const fn = binding.declaration;
    if (binding.declarationIndex === undefined || (fn.kind !== 'function-decl' && fn.kind !== 'function-expr')) continue;
    const group = parameterBindings.get(fn);
    if (group) group.push(binding);
    else parameterBindings.set(fn,[binding]);
  }
  function infer(e: Expression, seen = new Set<LexicalBinding>()): string | undefined {
    switch (e.kind) {
      case 'literal': return e.value === null ? 'nil' : ['number','string','boolean'].includes(typeof e.value) ? typeof e.value : undefined;
      case 'paren': return infer(e.expression,seen);
      case 'identifier': {
        const b = owners.get(e);
        if (!b || b.writes.length || seen.has(b)) return undefined;
        if (facts.has(b)) return facts.get(b);
        if (b.declaration.kind !== 'local') return undefined;
        const value = b.declaration.values[b.declarationIndex!];
        return value ? infer(value,new Set([...seen,b])) : undefined;
      }
      case 'if-expr': return union([infer(e.consequent,seen),...e.branches.map(b=>infer(b.value,seen)),infer(e.alternate,seen)]);
      case 'call': {
        const b = owners.get(e.callee);
        return b ? localFunctions.get(b)?.returns?.[0] : undefined;
      }
      case 'property': {
        const receiver = infer(e.object,seen);
        return receiver && lookupRobloxProperty(receiver,e.name);
      }
      case 'method-call': return service(e) ?? singleMethodResult(e,seen);
      // Operators may invoke overloaded metamethods: do not guess primitive types.
      default: return undefined;
    }
  }
  function singleMethodResult(e: MethodCall, seen = new Set<LexicalBinding>()): string | undefined {
    if (e.open || e.args.length) return undefined;
    const receiver = infer(e.object,seen);
    return receiver && lookupRobloxMethodResult(receiver,e.name);
  }
  const returnStatements = (body: Block): Array<Extract<Statement,{kind:'return'}>> => {
    const found: Array<Extract<Statement,{kind:'return'}>> = [];
    for (const s of body.statements) {
      if (s.kind === 'return') found.push(s);
      else if (s.kind === 'if') {
        found.push(...returnStatements(s.consequent),...s.branches.flatMap(b=>returnStatements(b.body)));
        if (s.alternate) found.push(...returnStatements(s.alternate));
      } else if (s.kind === 'do' || s.kind === 'while' || s.kind === 'repeat' || s.kind === 'numeric-for' || s.kind === 'generic-for') found.push(...returnStatements(s.body));
    }
    return found;
  };
  function terminal(body: Block): boolean {
    const tail=body.statements.at(-1);
    return tail?.kind === 'return' || (tail?.kind === 'do' && terminal(tail.body)) ||
      (tail?.kind === 'if' && !!tail.alternate && terminal(tail.consequent) && tail.branches.every(b=>terminal(b.body)) && terminal(tail.alternate));
  }
  // A bounded fixed point propagates facts through direct local call chains.
  // Unknown cycles stay unknown rather than borrowing an arbitrary first input.
  for (let round=0; round<Math.min(functions.length+1,16); round++) {
    let changed=false;
    for (const fn of functions) {
      if (fn.closed && !fn.node.isVararg) for (const b of parameterBindings.get(fn.node) ?? []) {
        if (b.writes.length) continue;
        const index = b.declarationIndex!;
        const type = union([...fn.events.map(signature => signature[index]), ...fn.calls.map(c=>infer(c.args[index]!))]);
        const annotation = fn.node.paramTypes?.[index];
        if (annotation && annotation !== type && annotation !== 'any' && annotation !== 'unknown') continue;
        if (type && facts.get(b)!==type) { facts.set(b,type); changed=true; }
      }
      const returns=returnStatements(fn.node.body);
      if (!terminal(fn.node.body) || !returns.length || returns.some(r=>{
        const last = r.values.at(-1);
        return r.values.length !== returns[0]!.values.length || last?.kind === 'call' || last?.kind === 'vararg' ||
          (last?.kind === 'method-call' && !singleMethodResult(last));
      })) continue;
      const types=returns[0]!.values.map((_,i)=>union(returns.map(r=>infer(r.values[i]!))));
      if (types.every(t=>t!==undefined) && JSON.stringify(types)!==JSON.stringify(fn.returns)) {
        fn.returns=types as string[]; changed=true;
      }
    }
    if (!changed) break;
  }
  const allocator = new NameAllocator([...globals,...typeNames,...bindings.map(b=>b.name)]);
  for (const fn of functions) {
    for (const binding of parameterBindings.get(fn.node) ?? []) {
      const index=binding.declarationIndex!;
      if (options.typeAnnotations !== 'off' && facts.has(binding) && !fn.node.paramTypes?.[index]) {
        fn.node.paramTypes ??= [];
        fn.node.paramTypes[index]=facts.get(binding);
      }
      if ((fn.node.kind === 'function-expr' && registrations.has(fn.node)) ||
          !automatic.test(binding.name) || typeNames.has(binding.name)) continue;
      const hints = new Set<string>();
      if (fn.closed && !fn.events.length) {
        const args=fn.calls.map(c=>c.args[index]);
        if (args.every(a=>a?.kind==='identifier' && !automatic.test(a.name)) && new Set(args.map(a=>(a as {name:string}).name)).size===1)
          hints.add((args[0] as {name:string}).name);
      }
      for (const r of binding.reads) {
        const p=parents.get(r.node);
        if (p?.kind==='method-call' && p.object===r.node) {
          const hint=({Disconnect:'connection',GetChildren:'instance',FindFirstChild:'instance',WaitForChild:'instance'} as Record<string,string>)[String(p.name)];
          if (hint) hints.add(hint);
        }
        if (p?.kind==='numeric-for' && p.stop===r.node) hints.add('limit');
      }
      if (hints.size!==1) continue;
      const name=allocator.take([...hints][0]!);
      fn.node.params[index]=name;
      for (const r of [...binding.reads,...binding.writes]) {
        if (r.declarationRoot && r.statement.kind==='function-decl') r.statement.name=name+r.statement.name.slice(binding.name.length);
        else r.node.name=name;
      }
    }
    if (options.typeAnnotations !== 'off' && fn.returns && !fn.node.returnType)
      fn.node.returnType=fn.returns.length===1 ? fn.returns[0] : `(${fn.returns.join(', ')})`;
  }
  return result;
}
