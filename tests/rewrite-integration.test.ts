import {readFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {decompile,parseQueryOptions} from '../src/decompile.ts';
const bytes=(name:string,level=2)=>readFileSync(new URL(`fixtures/rewrites/${name}-O${level}.luauc`,import.meta.url));
const defaults={interpolatedStrings:true,mathConstants:false,ifExpressions:true,earlyContinue:true,
 earlyReturn:true,recoverInlinedFunctions:true,rerollUnrolledLoops:false,foldSingleUseTemps:true,
 unfoldModuleTables:true,keepDeadFunctions:true,preferConst:false,unicodeStrings:true,upvalueComments:false,functionLineComments:false};
it('parses all rewrite switches with documented defaults and explicit inverses',()=>{
 expect(parseQueryOptions(new URLSearchParams())).toMatchObject(defaults);
 const query=new URLSearchParams(Object.entries(defaults).map(([key,value])=>[key.replace(/[A-Z]/g,c=>'_'+c.toLowerCase()),String(!value)]));
 expect(parseQueryOptions(query)).toMatchObject(Object.fromEntries(Object.entries(defaults).map(([k,v])=>[k,!v])));
});
it('recovers the complete O2 tuple while keeping a three-result helper and outer result cell',()=>{
 const input=bytes('inlined-fixed-tuple');
 const enabled=decompile(input,{opcodeEncoding:'official'}),disabled=decompile(input,{opcodeEncoding:'official',recoverInlinedFunctions:false});
 expect(enabled.ok && disabled.ok).toBe(true);if(!enabled.ok || !disabled.ok)throw Error('decode failed');
 expect(enabled.source).toMatch(/local \w+, \w+, \w+ = measure\(index\)/);
 expect(disabled.source).not.toMatch(/= measure\(index\)/);
 expect(enabled.source).toMatch(/return \w+, seed \* seed - 5, \w+ > 10/);
 expect(enabled.validation).toEqual([]);
});
it.each([0,1,2])('threads printable options through the complete O%i pipeline',level=>{
 const result=decompile(bytes('options-effects',level),{opcodeEncoding:'official',preferConst:true,
  unicodeStrings:false,upvalueComments:true,functionLineComments:true});
 expect(result.ok).toBe(true);if(!result.ok)throw Error(result.error);
 expect(result.source).toMatch(/\bconst /);
 expect(result.source).toContain('\\195\\161');expect(result.source).not.toContain('á');
 expect(result.source).toContain('-- Upvalues:');expect(result.source).toContain('-- Line:');
 expect(result.validation).toEqual([]);
 expect(result.diagnostics.filter(d=>d.severity==='error')).toEqual([]);
});
