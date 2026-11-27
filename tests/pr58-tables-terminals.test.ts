import {it,expect} from 'vitest';
import {abc,ad,Opcode,proto,compile,decode,sourceOf} from './helpers.ts';
import {reconstructFunction} from '../src/reconstruct/Reconstructor.ts';
import type {Block,Expression} from '../src/ast/Ast.ts';
it('materializes table-valued SETLIST inputs before reading their registers',()=>{
 const p=proto({instructions:[abc(Opcode.NEWTABLE,0,0,0),2,abc(Opcode.NEWTABLE,1,0,0),1,
  ad(Opcode.LOADN,2,41),abc(Opcode.SETLIST,1,2,2),1,
  abc(Opcode.NEWTABLE,2,0,0),0,abc(Opcode.SETLIST,0,1,3),1,abc(Opcode.RETURN,0,2,0)]});
 const source=sourceOf(p);
 expect(source).not.toMatch(/\br\d+\b/);
 expect(source).toMatch(/\{\s*\{\s*41\s*\},\s*\{\s*\}\s*\}/);
});
it('retains a terminal block shared by two alternatives',()=>{
 const {module}=decode(proto({numParams:2,instructions:[ad(Opcode.JUMPIF,0,1),ad(Opcode.JUMPIFNOT,1,2),
  ad(Opcode.LOADN,2,0),abc(Opcode.RETURN,2,2,0),ad(Opcode.LOADN,2,1),abc(Opcode.RETURN,2,2,0)]}));
 const ast=reconstructFunction(module,module.prototypes[module.mainProtoId]!);
 // The common return can be emitted once after a terminal guard. Test the
 // preserved branch behavior, not a requirement to duplicate that return
 // inside the old alternate arm. Keep the original bytecode above intact.
 const truthy=(value:unknown)=>value!==false&&value!==null;
 for(const left of [false,null,true,0,'',{}]) for(const right of [false,null,true,0,'',{}]) {
  const values=new Map([[ast.params[0]!,left],[ast.params[1]!,right]]);
  const evaluate=(expression:Expression):unknown=>{
   if(expression.kind==='literal') return expression.value;
   if(expression.kind==='identifier') return values.get(expression.name);
   if(expression.kind==='unary'&&expression.op==='not') return !truthy(evaluate(expression.argument));
   if(expression.kind==='binary'&&(expression.op==='and'||expression.op==='or')) {
    const value=evaluate(expression.left);
    return expression.op==='and' ? (truthy(value)?evaluate(expression.right):value)
      : (truthy(value)?value:evaluate(expression.right));
   }
   throw new Error(`Unexpected condition ${expression.kind}`);
  };
  const execute=(body:Block):unknown[]|undefined=>{
   for(const statement of body.statements) {
    if(statement.kind==='return') return statement.values.map(evaluate);
    if(statement.kind!=='if') throw new Error(`Unexpected statement ${statement.kind}`);
    const arm=truthy(evaluate(statement.test)) ? statement.consequent
      : statement.branches.find(branch=>truthy(evaluate(branch.test)))?.body ?? statement.alternate;
    const result=arm&&execute(arm);
    if(result) return result;
   }
   return undefined;
  };
  expect(execute(ast.body)).toEqual([truthy(left)||truthy(right)?0:1]);
 }
});
