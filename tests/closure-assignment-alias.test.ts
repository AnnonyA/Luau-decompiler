import {expect,it} from 'vitest';
import {decompile} from '../src/decompile.ts';
import {analyzeBindings} from '../src/analysis/Bindings.ts';
import {abc,ad,compile,proto} from './helpers.ts';
import {Opcode,CaptureType} from '../src/decode/Opcode.ts';

it('snapshots an old function value before assigning a new closure into its REF cell',()=>{
  const reader=proto({numUpvalues:1,instructions:[abc(Opcode.GETUPVAL,0,0),abc(Opcode.RETURN,0,2)]});
  const first=proto({instructions:[ad(Opcode.LOADN,0,1),abc(Opcode.RETURN,0,2)]});
  const second=proto({instructions:[ad(Opcode.LOADN,0,2),abc(Opcode.RETURN,0,2)]});
  const result=decompile(compile(proto({maxStackSize:3,children:[reader,first,second],instructions:[
    abc(Opcode.LOADNIL,0),ad(Opcode.NEWCLOSURE,1,0),abc(Opcode.CAPTURE,CaptureType.REF,0),
    ad(Opcode.NEWCLOSURE,0,1),abc(Opcode.MOVE,2,0),ad(Opcode.NEWCLOSURE,0,2),abc(Opcode.RETURN,0,4),
  ]})),{opcodeEncoding:'official'});
  expect(result.ok).toBe(true);if(!result.ok)throw Error(result.error);
  expect(result.validation).toEqual([]);
  const returned=result.ast.body.statements.at(-1);
  expect(returned?.kind).toBe('return');if(returned?.kind!=='return')throw Error('missing return');
  const bindings=analyzeBindings(result.ast.body).bindings;
  const owner=(node:object)=>bindings.find(binding=>binding.reads.some(ref=>ref.node===node));
  const current=owner(returned.values[0]!),saved=owner(returned.values[2]!);
  expect(current).toBeDefined();expect(saved).toBeDefined();
  expect(saved).not.toBe(current);
  expect(current!.captured).toBe(true);
  expect(saved!.writes).toHaveLength(0);
});
