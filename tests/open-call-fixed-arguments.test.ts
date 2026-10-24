import { describe, expect, it } from "vitest";
import { decompile } from "../src/decompile.ts";
import type { Expression } from "../src/ast/Ast.ts";
import { abc, ad, Opcode, proto, ret, sourceOf, strings, compile } from "./helpers.ts";

describe("fixed call arguments before an open multret argument", () => {
  it("does not truncate print(f(), g(), h()) at the first one-result call", () => {
    const result = decompile(compile(proto({
      constants: strings("print", "compute", "calls"),
      instructions: [
        abc(Opcode.GETGLOBAL, 0, 0, 0), 0,
        ad(Opcode.LOADK, 1, 2),
        abc(Opcode.GETGLOBAL, 2, 0, 0), 1,
        ad(Opcode.LOADN, 3, -3),
        abc(Opcode.CALL, 2, 2, 2),
        abc(Opcode.GETGLOBAL, 3, 0, 0), 1,
        ad(Opcode.LOADN, 4, 0),
        abc(Opcode.CALL, 3, 2, 2),
        abc(Opcode.GETGLOBAL, 4, 0, 0), 1,
        ad(Opcode.LOADN, 5, 7),
        abc(Opcode.CALL, 4, 2, 0),
        abc(Opcode.CALL, 0, 0, 1),
        ret(),
      ],
    })));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    const source = result.source;
    // Resolve materialized arguments, checking the same values/arity without
    // requiring independent effectful calls to stay nested in the printer.
    const bindings = new Map<string, Expression>();
    for (const statement of result.ast.body.statements) {
      if (statement.kind === "local") statement.names.forEach((name, i) => {
        if (statement.values[i]) bindings.set(name, statement.values[i]!);
      });
    }
    const resolve = (value: Expression): Expression => value.kind === "identifier" && bindings.has(value.name)
      ? resolve(bindings.get(value.name)!) : value;
    const statement = result.ast.body.statements.find(s => s.kind === "expression-stmt");
    expect(statement?.kind).toBe("expression-stmt");
    if (statement?.kind !== "expression-stmt" || statement.expression.kind !== "call") throw new Error("missing print call");
    const print = statement.expression;
    expect(print.callee).toMatchObject({kind:"identifier",name:"print"});
    expect(print.args).toHaveLength(4);
    expect(print.args[0]).toEqual({kind:"literal",value:"calls"});
    for (const [i, expected] of [-3, 0, 7].entries()) {
      const argument = resolve(print.args[i + 1]!);
      expect(argument.kind).toBe("call");
      if (argument.kind !== "call") throw new Error("lost compute result");
      expect(argument.callee).toMatchObject({kind:"identifier",name:"compute"});
      expect(argument.args.map(resolve)).toEqual([{kind:"literal",value:expected}]);
    }
    expect(print.args.at(-1)?.kind).toBe("call"); // trailing results remain open
    expect(source.indexOf("compute(-3)")).toBeLessThan(source.indexOf("compute(0)"));
    expect(source.match(/compute\(/g)).toHaveLength(3);
    expect(source).not.toMatch(/local _\d* = compute\(/);
  });

  it("retains a fixed value before the open trailing call", () => {
    const source = sourceOf(proto({
      constants: strings("print", "get", "event"),
      instructions: [
        abc(Opcode.GETGLOBAL, 0, 0, 0), 0,
        ad(Opcode.LOADK, 1, 2),
        ad(Opcode.LOADN, 2, 19),
        abc(Opcode.GETGLOBAL, 3, 0, 0), 1,
        abc(Opcode.CALL, 3, 1, 0),
        abc(Opcode.CALL, 0, 0, 1),
        ret(),
      ],
    }));
    expect(source).toContain('print("event", 19, get())');
  });

  it("does not change a fixed-argument call that ends with a single-result callee", () => {
    const source = sourceOf(proto({
      constants: strings("print", "get"),
      instructions: [
        abc(Opcode.GETGLOBAL, 0, 0, 0), 0,
        abc(Opcode.GETGLOBAL, 1, 0, 0), 1,
        abc(Opcode.CALL, 1, 1, 2),
        abc(Opcode.CALL, 0, 2, 1),
        ret(),
      ],
    }));
    expect(source).toContain("print((get()))");
    expect(source.match(/get\(/g)).toHaveLength(1);
  });
});
