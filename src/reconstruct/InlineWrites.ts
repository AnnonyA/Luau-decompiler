import {block, type Expression, type Statement} from '../ast/Ast.js';

/** A static, non-nil key cannot run code or raise an invalid-key error. */
export function tableStore(expression: Expression): {object: Expression; key: string | number} | undefined {
  if(expression.kind==='property')return {object:expression.object,key:expression.name};
  if(expression.kind==='index' && expression.key.kind==='literal') {
    const key=expression.key.value;
    if(typeof key==='string' || typeof key==='number' && Number.isFinite(key))return {object:expression.table,key};
  }
}

/** Proof-only continuation expansion. Helper returns exit the copied region;
 * caller returns must never be consumed. Only stores and branches participate.
 * The expanded size, including duplicated continuations, is bounded. */
export function canonicalWrites(statements: Statement[], helper: boolean, spend: () => boolean,
  unusedSnapshot: (statement: Statement) => boolean = () => false): Statement[] | undefined {
  interface Region {statements:Statement[];cost:number}
  function sequence(input: Statement[], tail: Region, depth: number): Region | undefined {
    if(depth>12 || !spend())return;
    let result=tail;
    for(let i=input.length-1;i>=0;i--) {
      if(!spend())return;
      let s=input[i]!;
      if(!helper && unusedSnapshot(s))continue;
      // Only local/captured cells: duplicating a table receiver or dynamic key
      // here could duplicate effects. Binding/type checks happen in the caller.
      if(s.kind==='compound-assign' && s.target.kind==='identifier')
        s={kind:'assign',targets:[s.target],values:[{kind:'binary',op:s.op,left:s.target,right:s.value}]};
      if(s.kind==='return' && helper && !s.values.length) {
        // Refuse dead tails too: no effectful statement is silently dropped.
        if(i!==input.length-1)return;
        result={statements:[],cost:0};continue;
      }
      if(s.kind==='assign' && s.targets.length===1 && s.values.length===1 &&
        (s.targets[0]!.kind==='identifier' || tableStore(s.targets[0]!))) {
        result={statements:[s,...result.statements],cost:result.cost+1};
      } else if(s.kind==='if') {
        const yes=sequence(s.consequent.statements,result,depth+1);
        const no=sequence(s.alternate?.statements ?? [],result,depth+1);
        if(!yes || !no)return;
        let cost=1+yes.cost+no.cost;
        const branches:typeof s.branches=[];
        for(const branch of s.branches) {
          const arm=sequence(branch.body.statements,result,depth+1);
          if(!arm)return;
          cost+=arm.cost;
          branches.push({test:branch.test,body:block(arm.statements)});
        }
        result={statements:[{...s,consequent:block(yes.statements),branches,alternate:block(no.statements)}],cost};
      } else return;
      if(result.cost>64)return;
    }
    return result;
  }
  return sequence(statements,{statements:[],cost:0},0)?.statements;
}
