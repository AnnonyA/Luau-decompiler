import { describe, expect, it } from "vitest";
import { abc, ad, Opcode, proto, sourceOf, compile } from "./helpers.ts";
import { decompile } from "../src/decompile.ts";
import { cleanupAst } from "../src/ast/AstCleanup.ts";
import { chunk, lit } from "../src/ast/Ast.ts";
import { printLuau } from "../src/print/LuauPrinter.ts";

describe("defects exposed by the three-engine original-source comparison", () => {
  it("captures a selection guard before its branches reuse both comparison registers", () => {
    const source = sourceOf(proto({ numParams: 1, constants: [{kind:"number",value:1}], instructions: [
      ad(Opcode.LOADN,3,2), abc(Opcode.MOD,2,0,3), ad(Opcode.LOADN,3,0),
      ad(Opcode.JUMPIFNOTEQ,2,5), 3,
      abc(Opcode.MINUS,2,0,0), ad(Opcode.LOADN,3,3), abc(Opcode.MUL,1,2,3),
      ad(Opcode.JUMP,0,1), abc(Opcode.ADDK,1,0,0), abc(Opcode.RETURN,1,2,0),
    ]}));
    expect(source).toMatch(/if \w+ % 2 == 0 then/);
    expect(source).not.toMatch(/if -\w+ == 3/);
  });

  it("reevaluates effectful loop-header statements on every backedge", () => {
    const bytes = compile(proto({ instructions:[
      ad(Opcode.LOADN,0,10), ad(Opcode.LOADN,1,4),
      ad(Opcode.LOADN,2,2), abc(Opcode.SUB,0,0,2),
      ad(Opcode.LOADN,2,1), abc(Opcode.SUB,1,1,2), ad(Opcode.LOADN,2,0),
      ad(Opcode.JUMPIFLE,1,5),2, ad(Opcode.LOADN,2,0),
      ad(Opcode.JUMPIFLT,0,2),2, ad(Opcode.JUMPBACK,0,-11), abc(Opcode.RETURN,0,3,0),
    ]}));
    const result = decompile(bytes);
    if(!result.ok) throw new Error(result.error);
    // This simple repeat may retain repeat syntax. In either shape the write
    // must be inside the loop, never hoisted before its test.
    const loop = result.ast.body.statements.find(s=>s.kind==='while'||s.kind==='repeat');
    expect(loop).toBeDefined();
    expect(loop && 'body' in loop && loop.body.statements.some(s=>s.kind==='assign'||s.kind==='compound-assign')).toBe(true);
  });

  it.each([Math.PI, Math.PI - 4e-13])("retains numeric constant %s without inventing a math lookup", value => {
    const ast=cleanupAst(chunk([{kind:'return',values:[lit(value)]}]),{
      typeAnnotations:'off',ifExpressions:false,earlyReturn:false,interpolatedStrings:false,mathConstants:true,
    });
    expect(printLuau(ast)).toBe(`return ${value}\n`);
  });
});
