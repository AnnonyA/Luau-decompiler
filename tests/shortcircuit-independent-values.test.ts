import { describe, expect, it } from "vitest";
import { decompile } from "../src/decompile.ts";
import { abc, ad, compile, Opcode, proto, ret, strings } from "./helpers.ts";

// A synthetic Luau register sequence: each guarded result remains live until
// the final call, so a phi-name rollback must not alias the distinct values.
describe("independent short-circuit values", () => {
  it("does not alias values across sequential short-circuit joins", () => {
    const instructions: number[] = [];
    const call = (register: number, label: number, value: boolean) => {
      instructions.push(abc(Opcode.GETGLOBAL, register, 0, 0), 0);
      instructions.push(ad(Opcode.LOADK, register + 1, label));
      instructions.push(abc(Opcode.LOADB, register + 2, value ? 1 : 0, 0));
      instructions.push(abc(Opcode.CALL, register, 3, 2));
    };
    call(2, 1, false);
    instructions.push(ad(Opcode.JUMPIFNOT, 2, 5));
    call(2, 2, true);
    call(3, 3, true);
    instructions.push(ad(Opcode.JUMPIF, 3, 5));
    call(3, 4, false);
    call(4, 5, true);
    instructions.push(ad(Opcode.JUMPIFNOT, 4, 5));
    call(4, 6, false);
    call(5, 7, false);
    instructions.push(ad(Opcode.JUMPIF, 5, 5));
    call(5, 8, true);
    instructions.push(abc(Opcode.GETGLOBAL, 6, 0, 0), 9);
    for (let register = 2; register <= 5; register++) {
      instructions.push(abc(Opcode.MOVE, register + 5, register, 0));
    }
    instructions.push(abc(Opcode.CALL, 6, 5, 1), ret());

    const result = decompile(compile(proto({
      maxStackSize: 12,
      constants: strings("test", "a", "skipped-and", "b", "skipped-or", "c", "d", "e", "f", "print"),
      instructions,
    })));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const print = result.ast.body.statements.find((statement) =>
      statement.kind === "expression-stmt" &&
      statement.expression.kind === "call" &&
      statement.expression.callee.kind === "identifier" &&
      statement.expression.callee.name === "print",
    );
    expect(print).toBeDefined();
    if (!print || print.kind !== "expression-stmt" || print.expression.kind !== "call") return;
    expect(print.expression.args).toHaveLength(4);
    expect(print.expression.args.every((arg) => arg.kind === "identifier")).toBe(true);
    const names = print.expression.args.map((arg) => arg.kind === "identifier" ? arg.name : "");
    expect(new Set(names).size).toBe(4);
  });
});
