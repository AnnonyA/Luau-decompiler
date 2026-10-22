import type { Block, Expression, Statement } from '../ast/Ast.js';

type Identifier = Extract<Expression, {kind:'identifier'}>;
export interface Reference {
  node: Identifier;
  scope: Block;
  statement: Statement;
}
export interface LexicalBinding {
  name: string;
  declaration: Statement | Expression;
  scope: Block;
  depth: number;
  reads: Reference[];
  writes: Reference[];
  captured: boolean;
}

/** Resolve identifier nodes, not spellings. Local initializers see the preceding
 * scope; repeat tests see body locals; loop bounds do not see loop variables. */
export function analyzeBindings(root: Block): { bindings: LexicalBinding[]; globals: Set<string> } {
  const bindings: LexicalBinding[] = [], globals = new Set<string>();
  const scopes: Map<string, LexicalBinding>[] = [new Map()];
  let depth = 0;
  const declare = (name: string, declaration: Statement | Expression, scope: Block) => {
    const binding: LexicalBinding = {name,declaration,scope,depth,reads:[],writes:[],captured:false};
    bindings.push(binding); scopes.at(-1)!.set(name,binding);
  };
  const reference = (node: Identifier, scope: Block, statement: Statement, write=false) => {
    const binding = [...scopes].reverse().map(s=>s.get(node.name)).find(Boolean);
    if (!binding) { globals.add(node.name); return; }
    (write ? binding.writes : binding.reads).push({node,scope,statement});
    if(depth > binding.depth) binding.captured=true;
  };
  const nested = (body: Block, setup?:()=>void, tail?:()=>void) => {
    scopes.push(new Map()); setup?.(); walk(body); tail?.(); scopes.pop();
  };
  const expr = (value: Expression, scope: Block, statement: Statement): void => {
    const visit=(e:Expression)=>expr(e,scope,statement);
    switch(value.kind){
      case 'identifier': reference(value,scope,statement); break;
      case 'unary': visit(value.argument); break;
      case 'binary': visit(value.left);visit(value.right);break;
      case 'call':visit(value.callee);value.args.forEach(visit);break;
      case 'method-call':visit(value.object);value.args.forEach(visit);break;
      case 'property':visit(value.object);break;
      case 'index':visit(value.table);visit(value.key);break;
      case 'table':value.fields.forEach(f=>{if(f.key)visit(f.key);visit(f.value);});break;
      case 'paren':visit(value.expression);break;
      case 'if-expr':visit(value.test);visit(value.consequent);value.branches.forEach(b=>{visit(b.test);visit(b.value);});visit(value.alternate);break;
      case 'interp':value.parts.forEach(p=>{if(p.kind==='expr' && typeof p.value !== 'string')visit(p.value);});break;
      case 'function-expr':
        depth++;nested(value.body,()=>value.params.forEach(p=>declare(p,value,value.body)));depth--;break;
    }
  };
  const walk = (body: Block): void => {
    for(const s of body.statements){
      const visit=(e:Expression)=>expr(e,body,s);
      const target=(e:Expression)=>e.kind==='identifier'?reference(e,body,s,true):visit(e);
      switch(s.kind){
        case 'local':s.values.forEach(visit);s.names.forEach(n=>declare(n,s,body));break;
        case 'assign':s.values.forEach(visit);s.targets.forEach(target);break;
        case 'compound-assign':visit(s.target);target(s.target);visit(s.value);break;
        case 'expression-stmt':visit(s.expression);break;
        case 'return':s.values.forEach(visit);break;
        case 'function-decl':
          if(s.local)declare(s.name,s,body);
          else reference({kind:'identifier',name:s.name.split(/[.:]/)[0]!},body,s,!/[.:]/.test(s.name));
          depth++;nested(s.body,()=>{
            if(s.name.includes(':'))declare('self',s,s.body);
            s.params.forEach(n=>declare(n,s,s.body));
          });depth--;break;
        case 'if':visit(s.test);nested(s.consequent);s.branches.forEach(b=>{visit(b.test);nested(b.body);});if(s.alternate)nested(s.alternate);break;
        case 'while':visit(s.test);nested(s.body);break;
        case 'repeat':nested(s.body,undefined,()=>expr(s.test,s.body,s));break;
        case 'numeric-for':visit(s.start);visit(s.stop);if(s.step)visit(s.step);nested(s.body,()=>declare(s.name,s,s.body));break;
        case 'generic-for':s.iterators.forEach(visit);nested(s.body,()=>s.names.forEach(n=>declare(n,s,s.body)));break;
        case 'do':nested(s.body);break;
      }
    }
  };
  walk(root);
  return {bindings,globals};
}

/** Substitution uses resolved node identity; it cannot capture a same-named
 * parameter or miss a newly added statement/expression container. */
export function replaceReferences<T>(tree: T, replacements: ReadonlyMap<object, object>): T {
  if(!tree || typeof tree!=='object')return tree;
  if(replacements.has(tree as object))return replacements.get(tree as object) as T;
  if(Array.isArray(tree))return tree.map(value=>replaceReferences(value,replacements)) as T;
  return Object.fromEntries(Object.entries(tree).map(([key,value])=>[key,replaceReferences(value,replacements)])) as T;
}

/** Rename only references resolved to parameters outside this body. Seed their
 * declarations before walking so nested local/parameter shadows stay distinct. */
export function renameFreeBindings(body: Block, rename: ReadonlyMap<string, string>): Block {
  const declarations: Statement[] = [...rename.keys()].map(name => ({kind: "local", names: [name], values: []}));
  const root: Block = {kind: "block", statements: [...declarations, ...body.statements]};
  const { bindings } = analyzeBindings(root);
  const replacements = new Map<object, object>();
  for (const binding of bindings) {
    if (!declarations.includes(binding.declaration as Statement)) continue;
    const name = rename.get(binding.name)!;
    for (const reference of [...binding.reads, ...binding.writes]) {
      replacements.set(reference.node, {...reference.node, name});
      const statement = reference.statement;
      if (statement.kind === "function-decl" && !statement.local &&
          statement.name.split(/[.:]/)[0] === binding.name) {
        replacements.set(statement, {...statement, name: name + statement.name.slice(binding.name.length),
          body: renameFreeBindings(statement.body, new Map([...rename].filter(([old]) => !statement.params.includes(old))))});
      }
    }
  }
  return replaceReferences(body, replacements);
}
