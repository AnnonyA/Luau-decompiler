import {it,expect} from 'vitest';
import {abc,ad,Opcode,proto,compile,decode,sourceOf} from './helpers.ts';
import {reconstructFunction} from '../src/reconstruct/Reconstructor.ts';
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
 const conditional=ast.body.statements.find(s=>s.kind==='if');
 expect(conditional?.kind==='if'&&conditional.alternate?.statements.some(s=>s.kind==='return')).toBe(true);
});
