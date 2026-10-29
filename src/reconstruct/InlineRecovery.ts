import type {Block, Chunk, Expression, Statement} from '../ast/Ast.js';
import {ident} from '../ast/Ast.js';
import {analyzeBindings, replaceReferences, type LexicalBinding} from '../analysis/Bindings.js';
import {lineAt, type BytecodeModule} from '../decode/Prototype.js';
import {Opcode} from '../decode/Opcode.js';
import {canonicalWrites, tableStore} from './InlineWrites.js';

const arithmetic = new Set(['+', '-', '*', '/', '//', '%', '^']);
const comparisons = new Set(['<', '<=', '>', '>=', '==', '~=']);
const evidenceOpcodes = new Set([Opcode.ADD, Opcode.SUB, Opcode.MUL, Opcode.DIV, Opcode.IDIV, Opcode.MOD, Opcode.POW,
  Opcode.ADDK, Opcode.SUBK, Opcode.MULK, Opcode.DIVK, Opcode.IDIVK, Opcode.MODK, Opcode.POWK, Opcode.SUBRK,
  Opcode.DIVRK, Opcode.MINUS, Opcode.JUMPIFEQ, Opcode.JUMPIFNOTEQ, Opcode.JUMPIFLT, Opcode.JUMPIFLE,
  Opcode.JUMPIFNOTLT, Opcode.JUMPIFNOTLE, Opcode.JUMPXEQKN]);

/** Line overlap admits a candidate; it never proves that a rewrite is safe.
 * Stripped/ambiguous metadata simply leaves the original expression in place. */
export function inlineHelperLines(module: BytecodeModule): Set<number> {
  const owners = new Map<number, Set<number>>(), bodyLines = new Map<number, Set<number>>();
  const definitions = new Map<number, number>();
  for (const proto of module.prototypes) {
    // A chunk starts at line 1 too; it is not a competing local helper.
    if (proto.id !== module.mainProtoId)
      definitions.set(proto.lineDefined, (definitions.get(proto.lineDefined) ?? 0) + 1);
    if (!proto.lineInfo) continue;
    const lines = new Set<number>();
    for (const instruction of proto.instructions) {
      if (!evidenceOpcodes.has(instruction.opcode)) continue;
      const line = lineAt(proto, instruction.pc);
      if (line === undefined) continue;
      lines.add(line);
      let ids = owners.get(line);
      if (!ids) owners.set(line, ids = new Set());
      ids.add(proto.id);
    }
    bodyLines.set(proto.id, lines);
  }
  const result = new Set<number>();
  for (const proto of module.prototypes) {
    if (proto.id === module.mainProtoId || !proto.lineDefined || definitions.get(proto.lineDefined) !== 1) continue;
    if ([...(bodyLines.get(proto.id) ?? [])].some(line => owners.get(line)!.size > 1)) result.add(proto.lineDefined);
  }
  return result;
}

interface CallTarget {
  name: string;
  parameters: Map<LexicalBinding, number>;
  count: number;
}
interface Target extends CallTarget {expression: Expression}
interface WriteTarget extends CallTarget {writes:Statement[];tableParameter:number}
type Available = Map<string, Target | WriteTarget>;
const unparen = (expression: Expression): Expression => {
  while (expression.kind === 'paren') expression = expression.expression;
  return expression;
};

/** Recover existing helpers from exact numeric expressions or private-table
 * write regions. Scalar operations must operate on proven primitive numbers:
 * moving an unknown value into a call could expose a different __add/debug.info
 * frame, eager evaluation, errors or multiple-return behavior. No algebraic
 * reassociation, mutable/unknown captures, calls or guessed argument inversions.
 * Writes additionally require a fresh, unescaped table and static valid keys. */
export function recoverInlineCalls(ast: Chunk, evidence: ReadonlySet<number>): Chunk {
  if (!evidence.size) return ast;
  const {bindings} = analyzeBindings(ast.body);
  const owners = new Map<object, LexicalBinding>(), declarations = new Map<object, LexicalBinding[]>();
  for (const binding of bindings) {
    for (const read of binding.reads) owners.set(read.node, binding);
    const list = declarations.get(binding.declaration) ?? [];
    list.push(binding); declarations.set(binding.declaration, list);
  }
  const numericBindings = new Map<LexicalBinding, boolean>();
  const numericValues = new Map<Expression, boolean>();
  let budget = 100_000;
  let tableEscapes: Set<LexicalBinding> | undefined;
  const privateTables=new Map<LexicalBinding,boolean>();
  function privateTable(e: Expression): boolean {
    if(e.kind!=='identifier' || --budget<0)return false;
    const binding=owners.get(e);
    if(!binding || binding.writes.length || binding.captured)return false;
    if(privateTables.has(binding))return privateTables.get(binding)!;
    const declaration=binding.declaration;
    if(declaration.kind!=='local' || declaration.values[binding.declarationIndex!]?.kind!=='table')return false;
    if(!tableEscapes) {
      tableEscapes=new Set();
      const pending:Array<[unknown,unknown]>=[[ast,undefined]];
      while(pending.length) {
        if(--budget<0)return false;
        const [node,parent]=pending.pop()!;
        if(!node || typeof node!=='object')continue;
        const value=node as Expression,container=parent as Expression | undefined;
        if(value.kind==='identifier') {
          const owner=owners.get(value);
          if(owner && !(container?.kind==='property' && container.object===node) &&
            !(container?.kind==='index' && container.table===node))tableEscapes.add(owner);
        }
        for(const child of Object.values(node))pending.push([child,node]);
      }
    }
    const result=budget>0 && !tableEscapes.has(binding);
    privateTables.set(binding,result);return result;
  }
  function numeric(expression: Expression, seen = new Set<LexicalBinding>()): boolean {
    if (--budget < 0) return false;
    const e = unparen(expression);
    const cached = numericValues.get(e);
    if (cached !== undefined) return cached;
    if (e.kind === 'literal') return typeof e.value === 'number';
    if (e.kind === 'unary' || e.kind === 'binary') {
      const result = e.kind === 'unary' ? e.op === '-' && numeric(e.argument, seen) :
        arithmetic.has(e.op) && numeric(e.left, seen) && numeric(e.right, seen);
      numericValues.set(e, result);
      return result;
    }
    if (e.kind !== 'identifier') return false;
    const binding = owners.get(e);
    if (!binding || binding.writes.length || seen.has(binding)) return false;
    if (numericBindings.has(binding)) return numericBindings.get(binding)!;
    const declaration = binding.declaration;
    seen.add(binding);
    const value = declaration.kind === 'local' ? declaration.values[binding.declarationIndex!] : undefined;
    const result = declaration.kind === 'numeric-for' || !!value && numeric(value, seen);
    seen.delete(binding); numericBindings.set(binding, result);
    return result;
  }
  function scalar(expression: Expression, parameters: Map<LexicalBinding, number>): 'number' | 'boolean' | undefined {
    if (--budget < 0) return;
    const e = unparen(expression);
    if (e.kind === 'identifier') return parameters.has(owners.get(e)!) || numeric(e) ? 'number' : undefined;
    if (e.kind === 'literal') return typeof e.value === 'number' ? 'number' : typeof e.value === 'boolean' ? 'boolean' : undefined;
    if (e.kind === 'unary') {
      const argument = scalar(e.argument, parameters);
      return e.op === '-' && argument === 'number' ? 'number' : e.op === 'not' && argument ? 'boolean' : undefined;
    }
    if (e.kind === 'if-expr') {
      if (!scalar(e.test, parameters)) return;
      const result = scalar(e.consequent, parameters);
      if (!result || scalar(e.alternate, parameters) !== result) return;
      for (const branch of e.branches)
        if (!scalar(branch.test, parameters) || scalar(branch.value, parameters) !== result) return;
      return result;
    }
    if (e.kind !== 'binary') return undefined;
    const left = scalar(e.left, parameters), right = scalar(e.right, parameters);
    if (left === 'number' && right === 'number') {
      if (arithmetic.has(e.op)) return 'number';
      if (comparisons.has(e.op)) return 'boolean';
    }
    return left === 'boolean' && right === 'boolean' && ['and','or','==','~='].includes(e.op) ? 'boolean' : undefined;
  }
  const sizes = new Map<Expression, number>();
  function size(expression: Expression): number {
    const e = unparen(expression), cached = sizes.get(e);
    if (cached !== undefined) return cached;
    const result = 1 + (e.kind === 'binary' ? size(e.left) + size(e.right) : e.kind === 'unary' ? size(e.argument) :
      e.kind === 'if-expr' ? size(e.test) + size(e.consequent) + size(e.alternate) +
        e.branches.reduce((n,b)=>n+size(b.test)+size(b.value),0) : 0);
    sizes.set(e, result); return result;
  }
  /** Build a proof-only return tree; leave the emitted helper body untouched.
   * Only primitive, immutable lets can be substituted, even if their value is
   * unused. Every path must return one value. Loops, stores, calls, closures,
   * fallthrough and value packs deliberately have no template rule. */
  function returnPattern(body: Block, parameters: Map<LexicalBinding,number>): Expression | undefined {
    let nodes = 128;
    type Locals = Map<LexicalBinding,Expression>;
    function value(expression: Expression, locals: Locals, depth: number): Expression | undefined {
      if (--nodes < 0 || --budget < 0 || depth > 32) return;
      const e = unparen(expression);
      if (e.kind === 'identifier') return locals.get(owners.get(e)!) ?? e;
      if (e.kind === 'literal') return e;
      if (e.kind === 'unary') {
        const argument=value(e.argument,locals,depth+1);
        return argument && {...e,argument};
      }
      if (e.kind === 'binary') {
        const left=value(e.left,locals,depth+1),right=value(e.right,locals,depth+1);
        return left && right && {...e,left,right};
      }
      if (e.kind === 'if-expr') {
        const test=value(e.test,locals,depth+1),consequent=value(e.consequent,locals,depth+1),alternate=value(e.alternate,locals,depth+1);
        const branches: typeof e.branches=[];
        for(const b of e.branches) {
          const test=value(b.test,locals,depth+1),result=value(b.value,locals,depth+1);
          if(!test || !result)return;
          branches.push({test,value:result});
        }
        return test && consequent && alternate && {...e,test,consequent,alternate,branches};
      }
    }
    function sequence(statements: Statement[], inherited: Locals, depth: number): Expression | undefined {
      if (--nodes < 0 || --budget < 0 || depth > 16) return;
      const locals=new Map(inherited);
      for(let i=0;i<statements.length;i++) {
        if (--nodes < 0 || --budget < 0) return;
        const s=statements[i]!;
        if(s.kind==='local' && s.names.length===1 && s.values.length===1) {
          const binding=declarations.get(s)?.[0],init=value(s.values[0]!,locals,0);
          if(!binding || binding.writes.length || !init || size(init)>128 || !scalar(init,parameters))return;
          locals.set(binding,init);continue;
        }
        if(s.kind==='return' && s.values.length===1 && i===statements.length-1)return value(s.values[0]!,locals,0);
        if(s.kind!=='if' || s.alternate && i!==statements.length-1)return;
        const test=value(s.test,locals,0),consequent=sequence(s.consequent.statements,locals,depth+1);
        const alternate=sequence(s.alternate?.statements ?? statements.slice(i+1),locals,depth+1);
        const branches: Extract<Expression,{kind:'if-expr'}>['branches']=[];
        for(const b of s.branches) {
          const test=value(b.test,locals,0),result=sequence(b.body.statements,locals,depth+1);
          if(!test || !result)return;
          branches.push({test,value:result});
        }
        return test && consequent && alternate ? {kind:'if-expr',test,consequent,branches,alternate} : undefined;
      }
    }
    return sequence(body.statements,new Map(),0);
  }
  function target(statement: Extract<Statement,{kind:'function-decl'}>): Target | WriteTarget | undefined {
    if (!statement.local || !statement.line || !evidence.has(statement.line) || statement.isVararg ||
        !statement.params.length || statement.params.length > 8) return;
    const declared = declarations.get(statement) ?? [];
    const binding = declared.find(b => b.scope !== statement.body);
    if (!binding || binding.writes.length) return;
    const parameters = new Map(declared.filter(b=>b.scope === statement.body && b.declarationIndex !== undefined)
      .map(b=>[b,b.declarationIndex!]));
    if (parameters.size !== statement.params.length || [...parameters.keys()].some(b=>b.writes.length)) return;
    const expression = returnPattern(statement.body,parameters);
    const base={name:statement.name,parameters,count:statement.params.length};
    if (expression && size(expression)<=128 && size(expression)>=5 && scalar(expression,parameters))return {...base,expression};
    const writes=canonicalWrites(statement.body.statements,true,()=>--budget>=0);
    if(!writes)return;
    let tableParameter:number|undefined,stores=0;
    const values:Expression[]=[];
    function inspect(statements:Statement[]):boolean {
      for(const s of statements) {
        if(--budget<0)return false;
        if(s.kind==='assign') {
          const location=tableStore(s.targets[0]!);
          const index=location?.object.kind==='identifier' ? parameters.get(owners.get(location.object)!) : undefined;
          if(index===undefined || tableParameter!==undefined && index!==tableParameter)return false;
          tableParameter=index;stores++;values.push(s.values[0]!);
        } else if(s.kind==='if') {
          values.push(s.test,...s.branches.map(b=>b.test));
          if(!inspect(s.consequent.statements) || !s.branches.every(b=>inspect(b.body.statements)) || !inspect(s.alternate!.statements))return false;
        } else return false;
      }
      return true;
    }
    if(!inspect(writes) || stores<2 || tableParameter===undefined)return;
    const numericParameters=new Map([...parameters].filter(([,index])=>index!==tableParameter));
    if(!values.every(e=>scalar(e,numericParameters)))return;
    return {...base,writes,tableParameter};
  }
  // Bound candidate/unification work independently of attacker-controlled
  // names and line metadata. Exhaustion preserves all remaining expressions.
  function same(a: Expression, b: Expression): boolean {
    if (--budget < 0) return false;
    a = unparen(a); b = unparen(b);
    if (a.kind === 'identifier' && b.kind === 'identifier') return owners.get(a) === owners.get(b);
    if (a.kind === 'literal' && b.kind === 'literal') return Object.is(a.value, b.value);
    if (a.kind === 'unary' && b.kind === 'unary') return a.op === b.op && same(a.argument,b.argument);
    return a.kind === 'binary' && b.kind === 'binary' && a.op === b.op && same(a.left,b.left) && same(a.right,b.right);
  }
  function match(pattern: Expression, value: Expression, candidate: CallTarget, args: Map<number,Expression>): boolean {
    if (--budget < 0) return false;
    const p = unparen(pattern), v = unparen(value);
    if (p.kind === 'identifier') {
      const index = candidate.parameters.get(owners.get(p)!);
      if (index === undefined) return v.kind==='identifier' && owners.get(p)===owners.get(v) && numeric(v);
      if (!numeric(v)) return false;
      const prior = args.get(index);
      if (prior) return same(prior,v);
      args.set(index,v); return true;
    }
    // A reconstructed SSA let may keep a repeated arithmetic dependency in a
    // register. Follow only immutable primitive initializers, not textual names.
    if(v.kind==='identifier' && numeric(v)) {
      const binding=owners.get(v),declaration=binding?.declaration;
      if(declaration?.kind==='local') {
        const init=declaration.values[binding!.declarationIndex!];
        if(init)return match(p,init,candidate,args);
      }
    }
    if (p.kind === 'literal' && v.kind === 'literal') return Object.is(p.value,v.value);
    if (p.kind === 'unary' && v.kind === 'unary') return p.op === v.op && match(p.argument,v.argument,candidate,args);
    if(p.kind==='if-expr' && v.kind==='if-expr') return p.branches.length===v.branches.length &&
      match(p.test,v.test,candidate,args) && match(p.consequent,v.consequent,candidate,args) &&
      p.branches.every((b,i)=>match(b.test,v.branches[i]!.test,candidate,args) && match(b.value,v.branches[i]!.value,candidate,args)) &&
      match(p.alternate,v.alternate,candidate,args);
    return p.kind === 'binary' && v.kind === 'binary' && p.op === v.op &&
      match(p.left,v.left,candidate,args) && match(p.right,v.right,candidate,args);
  }
  const replacements = new Map<object,object>();
  function continues(body: Block): boolean {
    return body.statements.some(s=>s.kind==='continue' || (s.kind==='do' && continues(s.body)) ||
      (s.kind==='if' && (continues(s.consequent) || s.branches.some(b=>continues(b.body)) || !!s.alternate && continues(s.alternate))));
  }
  type Visible = Map<string,LexicalBinding>;
  // Initializer expansion can extract an old reference into a new scope. Its
  // spelling is usable only if the destination still resolves it to that owner.
  function visibleArguments(e: Expression, visible: Visible): boolean {
    if (--budget < 0) return false;
    e=unparen(e);
    if(e.kind==='identifier')return !!owners.get(e) && visible.get(e.name)===owners.get(e);
    if(e.kind==='literal')return true;
    if(e.kind==='unary')return visibleArguments(e.argument,visible);
    return e.kind==='binary' && visibleArguments(e.left,visible) && visibleArguments(e.right,visible);
  }
  function functionScope(node: Expression | Statement, visible: Visible, body: Block): Visible {
    const scope=new Map(visible);
    for(const binding of declarations.get(node) ?? [])
      if(binding.scope===body)scope.set(binding.name,binding);
    return scope;
  }
  function expression(e: Expression, available: Available, visible: Visible): void {
    if (budget <= 0) return;
    let selected: Expression | undefined, ambiguous=false;
    for (const candidate of available.values()) {
      if(!('expression' in candidate))continue;
      if (--budget < 0) return;
      const args = new Map<number,Expression>();
      if (match(candidate.expression,e,candidate,args) && args.size === candidate.count) {
        const ordered = Array.from({length:candidate.count},(_,i)=>args.get(i)!);
        if (size(e) >= 2 + ordered.reduce((n,arg)=>n+size(arg),0) + 2 && ordered.every(arg=>visibleArguments(arg,visible))) {
          if(selected){ambiguous=true;break;}
          selected={kind:'call',callee:ident(candidate.name),args:ordered,open:false};
        }
      }
    }
    // Do not commit a first match if the remaining ambiguity scan ran out of fuel.
    if(budget<=0)return;
    if(selected && !ambiguous){replacements.set(e,selected);return;}
    const visit = (value: Expression) => expression(value,available,visible);
    switch(e.kind) {
      case 'binary': visit(e.left);visit(e.right);break;
      case 'unary': visit(e.argument);break;
      case 'paren': visit(e.expression);break;
      case 'call': visit(e.callee);e.args.forEach(visit);break;
      case 'method-call': visit(e.object);e.args.forEach(visit);break;
      case 'property': visit(e.object);break;
      case 'index': visit(e.table);visit(e.key);break;
      case 'table': e.fields.forEach(f=>{if(f.key)visit(f.key);visit(f.value);});break;
      case 'if-expr': visit(e.test);visit(e.consequent);e.branches.forEach(b=>{visit(b.test);visit(b.value);});visit(e.alternate);break;
      case 'interp': e.parts.forEach(p=>{if(typeof p.value!=='string')visit(p.value);});break;
      case 'function-expr': walk(e.body,new Map(),functionScope(e,visible,e.body));break;
    }
  }
  function matchWrites(pattern:Statement[], actual:Statement[], candidate:WriteTarget,args:Map<number,Expression>):boolean {
    if(pattern.length!==actual.length || --budget<0)return false;
    return pattern.every((p,i)=>{
      const v=actual[i]!;
      if(--budget<0)return false;
      if(p.kind==='assign' && v.kind==='assign') {
        const left=tableStore(p.targets[0]!),right=tableStore(v.targets[0]!);
        if(!left || !right || !Object.is(left.key,right.key) || !privateTable(right.object))return false;
        const prior=args.get(candidate.tableParameter);
        if(prior && !same(prior,right.object))return false;
        args.set(candidate.tableParameter,right.object);
        return match(p.values[0]!,v.values[0]!,candidate,args);
      }
      return p.kind==='if' && v.kind==='if' && p.branches.length===v.branches.length &&
        match(p.test,v.test,candidate,args) && matchWrites(p.consequent.statements,v.consequent.statements,candidate,args) &&
        p.branches.every((b,j)=>match(b.test,v.branches[j]!.test,candidate,args) && matchWrites(b.body.statements,v.branches[j]!.body.statements,candidate,args)) &&
        matchWrites(p.alternate!.statements,v.alternate!.statements,candidate,args);
    });
  }
  function region(statements:Statement[],start:number,available:Available,visible:Visible):{count:number;call:Statement}|undefined {
    const targets=[...available.values()].filter((t):t is WriteTarget=>'writes' in t);
    if(!targets.length || budget<=0)return;
    let selected:{count:number;call:Statement}|undefined;
    for(let count=1;count<=8 && start+count<=statements.length;count++) {
      const pattern=canonicalWrites(statements.slice(start,start+count),false,()=>--budget>=0);
      if(!pattern)break;
      for(const candidate of targets) {
        if(--budget<0)return;
        const args=new Map<number,Expression>();
        if(!matchWrites(candidate.writes,pattern,candidate,args) || args.size!==candidate.count)continue;
        const ordered=Array.from({length:candidate.count},(_,i)=>args.get(i)!);
        if(!ordered.every(arg=>visibleArguments(arg,visible)))continue;
        if(selected)return; // Refuse ambiguous helper or region boundaries.
        // Arguments expanded from earlier initializers have already passed the
        // destination binding proof. Detach them from replacements scheduled at
        // their old site: those calls can name helpers shadowed in this scope.
        selected={count,call:{kind:'expression-stmt',expression:{kind:'call',callee:ident(candidate.name),args:structuredClone(ordered),open:false}}};
      }
    }
    return budget>0 ? selected : undefined;
  }
  function walk(body: Block, inherited: Available, inheritedVisible: Visible): {available:Available;visible:Visible} {
    const available = new Map(inherited),visible=new Map(inheritedVisible);
    const visit = (e: Expression) => expression(e,available,visible);
    const nested = (b: Block, bindings: LexicalBinding[] = []) => {
      const scope = new Map(available),names=new Map(visible);
      for(const binding of bindings){scope.delete(binding.name);names.set(binding.name,binding);}
      return walk(b,scope,names);
    };
    const statements:Statement[]=[];
    let changed=false;
    for (let i=0;i<body.statements.length;i++) {
      const s=body.statements[i]!;
      const recovered=region(body.statements,i,available,visible);
      if(recovered){statements.push(recovered.call);i+=recovered.count-1;changed=true;continue;}
      statements.push(s);
      switch(s.kind) {
        case 'function-decl': {
          for(const binding of declarations.get(s) ?? [])
            if(binding.scope!==s.body)visible.set(binding.name,binding);
          walk(s.body,new Map(),functionScope(s,visible,s.body));
          if (s.local) available.delete(s.name);
          const candidate = target(s);
          if (candidate) available.set(candidate.name,candidate);
          break;
        }
        case 'local':
          s.values.forEach(visit);s.names.forEach(name=>available.delete(name));
          for(const binding of declarations.get(s) ?? [])visible.set(binding.name,binding);
          break;
        case 'assign': s.targets.forEach(visit);s.values.forEach(visit);break;
        case 'compound-assign': visit(s.target);visit(s.value);break;
        case 'expression-stmt': visit(s.expression);break;
        case 'return': s.values.forEach(visit);break;
        case 'if': visit(s.test);nested(s.consequent);s.branches.forEach(b=>{visit(b.test);nested(b.body);});if(s.alternate)nested(s.alternate);break;
        case 'while': visit(s.test);nested(s.body);break;
        case 'repeat': {
          const tail = nested(s.body);
          // A continue reaches until without necessarily executing declarations
          // in this body. Nested-loop continues do not skip these declarations.
          if (continues(s.body)) for (const [name,candidate] of tail.available)
            if (available.get(name)!==candidate) tail.available.delete(name);
          expression(s.test,tail.available,tail.visible);break;
        }
        case 'numeric-for': visit(s.start);visit(s.stop);if(s.step)visit(s.step);nested(s.body,declarations.get(s));break;
        case 'generic-for': s.iterators.forEach(visit);nested(s.body,declarations.get(s));break;
        case 'do': nested(s.body);break;
      }
    }
    // Descendant expression/block rewrites are already known at this point.
    if(changed)replacements.set(body,replaceReferences({...body,statements},replacements));
    return {available,visible};
  }
  walk(ast.body,new Map(),new Map());
  return replacements.size ? replaceReferences(ast,replacements) : ast;
}
