import type {Expression} from '../ast/Ast.js';
import type {LexicalBinding} from '../analysis/Bindings.js';

const arithmetic = new Set(['+', '-', '*', '/', '//', '%', '^']);

/** A type invariant, not a value/snapshot proof. Every cell starts numeric;
 * every assignment in every closure must preserve that type. Dependencies are
 * invalidated transitively, so a cycle cannot hide an unknown writer. */
export function numericStateBindings(
  bindings: readonly LexicalBinding[], owners: ReadonlyMap<object,LexicalBinding>,
  immutableNumeric: (expression: Expression) => boolean, spend: () => boolean,
): ReadonlySet<LexicalBinding> {
  const candidates=new Set<LexicalBinding>(),invalid=new Set<LexicalBinding>();
  const dependents=new Map<LexicalBinding,Set<LexicalBinding>>();
  for(const binding of bindings) {
    if(!spend())return new Set();
    const d=binding.declaration;
    if(d.kind==='local' && binding.writes.length) {
      const value=d.values[binding.declarationIndex!];
      if(value && immutableNumeric(value))candidates.add(binding);
    }
  }
  function numeric(e:Expression, dependent:LexicalBinding, depth=0):boolean {
    if(!spend() || depth>32)return false;
    if(e.kind==='paren')return numeric(e.expression,dependent,depth+1);
    if(e.kind==='literal')return typeof e.value==='number';
    if(e.kind==='identifier') {
      const owner=owners.get(e);
      if(owner && candidates.has(owner)) {
        let readers=dependents.get(owner);
        if(!readers)dependents.set(owner,readers=new Set());
        readers.add(dependent);return true;
      }
      return immutableNumeric(e);
    }
    if(e.kind==='unary')return e.op==='-' && numeric(e.argument,dependent,depth+1);
    return e.kind==='binary' && arithmetic.has(e.op) && numeric(e.left,dependent,depth+1) && numeric(e.right,dependent,depth+1);
  }
  for(const binding of candidates)for(const ref of binding.writes) {
    if(!spend())return new Set();
    const s=ref.statement;
    const valid=s.kind==='assign' && s.targets.length===1 && s.values.length===1 &&
      s.targets[0]===ref.node && numeric(s.values[0]!,binding) ||
      s.kind==='compound-assign' && s.target===ref.node && arithmetic.has(s.op) && numeric(s.value,binding);
    if(!valid)invalid.add(binding);
  }
  const pending=[...invalid];
  while(pending.length) {
    if(!spend())return new Set();
    for(const reader of dependents.get(pending.pop()!) ?? []) {
      if(!spend())return new Set();
      if(!invalid.has(reader)){invalid.add(reader);pending.push(reader);}
    }
  }
  for(const binding of invalid)candidates.delete(binding);
  return candidates;
}
