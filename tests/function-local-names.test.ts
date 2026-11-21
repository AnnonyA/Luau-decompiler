import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {analyzeBindings} from '../src/analysis/Bindings.ts';
import {block,chunk,ident,type Block,type Expression,type Statement} from '../src/ast/Ast.ts';
import {decodeBytecode} from '../src/decode/Decoder.ts';
import {decompile} from '../src/decompile.ts';
import {NameAllocator} from '../src/reconstruct/Naming.ts';
import {reconstructFunction} from '../src/reconstruct/Reconstructor.ts';
import {abc,ad,CaptureType,compile,Opcode,proto,ret} from './helpers.ts';

const bytes=(level:number)=>readFileSync(new URL(`./fixtures/rewrites/sibling-function-names-O${level}.luauc`,import.meta.url));

/** Read actual declaration/assignment destinations, not debug-name metadata. */
function closureBindings(body:Block,debugName:string):string[] {
  const names:string[]=[];
  const visit=(value:unknown):void=>{
    if(!value||typeof value!=='object')return;
    const statement=value as Statement;
    if(statement.kind==='local')statement.values.forEach((expression,index)=>{
      if(expression.kind==='function-expr'&&expression.debugName===debugName)names.push(statement.names[index]!);
    });
    if(statement.kind==='assign')statement.values.forEach((expression,index)=>{
      const target=statement.targets[index];
      if(expression.kind==='function-expr'&&expression.debugName===debugName&&target?.kind==='identifier')names.push(target.name);
    });
    Object.values(value).forEach(child=>Array.isArray(child)?child.forEach(visit):visit(child));
  };
  visit(body);
  return names;
}

describe('function-local name allocation',()=>{
  it('forwards the parent slot spelling for an unresolved transitive UPVAL', () => {
    const reader = proto({numUpvalues: 1, upvalueNames: ['nestedHint'],
      instructions: [abc(Opcode.GETUPVAL, 0, 0), abc(Opcode.RETURN, 0, 2)]});
    const {module} = decodeBytecode(compile(proto({numParams: 1, numUpvalues: 1, upvalueNames: ['outer'],
      locals: [{name: 'nestedHint', register: 0, startPc: 0, endPc: 3}], children: [reader],
      instructions: [ad(Opcode.NEWCLOSURE, 1, 0), abc(Opcode.CAPTURE, CaptureType.UPVAL, 0),
        abc(Opcode.RETURN, 0, 3)]})), {opcodeEncoding: 'official'});
    const fn = reconstructFunction(module, module.prototypes[module.mainProtoId]!);
    const ast = block([{kind: 'return', values: [{kind: 'function-expr', params: fn.params, isVararg: false, body: fn.body}]}]);
    expect(analyzeBindings(ast).globals).toEqual(new Set(['outer']));
  });

  it('keeps a nested VAL binding immutable when an unrelated outer REF uses its spelling', () => {
    const reader = () => proto({numUpvalues: 1, instructions: [abc(Opcode.GETUPVAL, 0, 0), abc(Opcode.RETURN, 0, 2)]});
    const factory = proto({children: [reader()], constants: [{kind: 'closure', protoId: 0}],
      locals: [{name: 'cell', register: 0, startPc: 1, endPc: 4}],
      instructions: [ad(Opcode.LOADN, 0, 7), ad(Opcode.DUPCLOSURE, 1, 0),
        abc(Opcode.CAPTURE, CaptureType.VAL, 0), abc(Opcode.RETURN, 1, 2)]});
    const {module} = decodeBytecode(compile(proto({children: [factory, reader()],
      locals: [{name: 'cell', register: 0, startPc: 1, endPc: 6}],
      instructions: [ad(Opcode.LOADN, 0, 3), ad(Opcode.NEWCLOSURE, 1, 1),
        abc(Opcode.CAPTURE, CaptureType.REF, 0), abc(Opcode.CLOSEUPVALS, 0),
        ad(Opcode.NEWCLOSURE, 2, 0), abc(Opcode.RETURN, 1, 3)]})), {opcodeEncoding: 'official'});
    const fn = reconstructFunction(module, module.prototypes[module.mainProtoId]!);
    const cells = analyzeBindings(fn.body).bindings.filter(binding => binding.name === 'cell' && binding.captured);
    expect(cells.map(binding => [binding.depth, binding.writes.length])).toEqual([[0, 1], [1, 0]]);
  });

  it.each([false, true])('retains only unambiguous suffix hints across functions (reverse=%s)', reverse => {
    const children = [['value', 'value', 'item', 'item'], ['value2']].map(names => proto({
      numParams: names.length, instructions: [ret()],
      locals: names.map((name, register) => ({name, register, startPc: 0, endPc: 1})),
    }));
    if (reverse) children.reverse();
    const {module} = decodeBytecode(compile(proto({children, instructions: [
      ad(Opcode.NEWCLOSURE, 0, 0), ad(Opcode.NEWCLOSURE, 1, 1), abc(Opcode.RETURN, 0, 3),
    ]})), {opcodeEncoding: 'official'});
    const fn = reconstructFunction(module, module.prototypes[module.mainProtoId]!);
    expect(fn.nameStems.get('item2')).toBe('item');
    expect(fn.nameStems.has('value2')).toBe(false);
  });

  it.each([0,1,2])('keeps independent decode bindings in the reconstructed AST at O%s',level=>{
    const {module}=decodeBytecode(bytes(level),{opcodeEncoding:'official'});
    expect(module.prototypes.filter(prototype=>prototype.debugName==='decode')).toHaveLength(2);
    const reconstructed=reconstructFunction(module,module.prototypes[module.mainProtoId]!);
    expect(closureBindings(reconstructed.body,'decode')).toEqual(['decode','decode']);
  });

  for(const options of [{},{generatedNames:'compact'},{nameCasing:'camelCase'},{nameCasing:'snake_case'},{nameCasing:'PascalCase'}] as const){
    it.each([0,1,2])(`preserves both observable function names with ${JSON.stringify(options)} at O%s`,level=>{
      const result=decompile(bytes(level),{opcodeEncoding:'official',...options});
      expect(result.ok).toBe(true);
      if(!result.ok)throw Error(result.error);
      expect(result.source.match(/\bfunction decode\(/g)??[]).toHaveLength(2);
      expect(result.source).not.toMatch(/\bfunction decode\d+\(/);
      const {bindings,globals}=analyzeBindings(result.ast.body);
      const decoders=bindings.filter(binding=>binding.name==='decode');
      expect(decoders).toHaveLength(2);
      expect(decoders[0]!.scope).not.toBe(decoders[1]!.scope);
      expect(globals).not.toContain('decode');
    });
  }

  it('keeps free identifiers in compound value captures separate from child parameters',()=>{
    const {module}=decodeBytecode(compile(proto({numParams:1,numUpvalues:1,upvalueNames:['captured'],
      instructions:[abc(Opcode.GETUPVAL,1,0,0),abc(Opcode.ADD,2,0,1),abc(Opcode.RETURN,2,2,0)],
      locals:[{name:'offset',startPc:0,endPc:3,register:0}],
    })),{opcodeEncoding:'official'});
    const expression:Expression={kind:'binary',op:'+',left:ident('offset'),right:ident('increment')};
    const reconstructed=reconstructFunction(module,module.prototypes[module.mainProtoId]!,{
      allocator:new NameAllocator(),
      captures:new Map([[0,{expression,mutable:false}]]),
    });
    expect(reconstructed.params).not.toContain('offset');
    const body=chunk([{kind:'local',names:['callback'],values:[{kind:'function-expr',
      params:reconstructed.params,isVararg:false,body:reconstructed.body}]}]);
    expect([...analyzeBindings(body.body).globals].sort()).toEqual(['increment','offset']);
  });

  it('retains a mutable capture cell when a child parameter requests its name',()=>{
    const {module}=decodeBytecode(compile(proto({numParams:1,numUpvalues:1,upvalueNames:['value'],
      instructions:[abc(Opcode.GETUPVAL,1,0,0),abc(Opcode.ADD,1,1,0),abc(Opcode.SETUPVAL,1,0,0),abc(Opcode.RETURN,1,2,0)],
      locals:[{name:'value',startPc:0,endPc:4,register:0}],
    })),{opcodeEncoding:'official'});
    const reconstructed=reconstructFunction(module,module.prototypes[module.mainProtoId]!,{
      allocator:new NameAllocator(),
      captures:new Map([[0,{name:'value',expression:ident('value'),mutable:true}]]),
    });
    expect(reconstructed.params).not.toContain('value');
    const body=block([{kind:'local',names:['value'],values:[]},
      {kind:'local',names:['callback'],values:[{kind:'function-expr',params:reconstructed.params,
        isVararg:false,body:reconstructed.body}]}]);
    const {bindings,globals}=analyzeBindings(body);
    const cell=bindings.find(binding=>binding.name==='value')!;
    expect(cell.captured).toBe(true);
    expect(cell.reads.length).toBeGreaterThan(0);
    expect(cell.writes.length).toBeGreaterThan(0);
    expect(globals.size).toBe(0);
  });
});
