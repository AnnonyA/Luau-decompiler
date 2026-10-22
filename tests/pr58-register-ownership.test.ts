import {readFileSync} from 'node:fs';
import {it,expect} from 'vitest';
import {decompile} from '../src/decompile.ts';
import {analyzeBindings} from '../src/analysis/Bindings.ts';
it('does not turn a borrowed global/copy into a writable register binding',()=>{
 const result=decompile(readFileSync(new URL('./fixtures/pr58/codec-O0.luauc',import.meta.url)),{opcodeEncoding:'official'});
 if(!result.ok)throw new Error(result.error);
 const analysis=analyzeBindings(result.ast.body);
 expect(analysis.globals.has('print')).toBe(true);
 expect(analysis.bindings.some(b=>b.name==='print')).toBe(false);
 // Both operands of the string equality must still refer to string locals,
 // not an assignment that replaces one of them with the length of the other.
 expect(result.source).not.toMatch(/\nvalue = #/);
});
