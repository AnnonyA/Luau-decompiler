import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { chunk, lit } from "../src/ast/Ast.ts";
import { decompile } from "../src/decompile.ts";
import { hasArtificialComments, printLuau } from "../src/print/LuauPrinter.ts";

function printLiteral(value: string): string {
  return printLuau(chunk([{ kind: "return", values: [lit(value)] }]));
}

describe("printer literal fidelity", () => {
  it("prints a NUL followed by decimal digits without combining escape digits", () => {
    const source = printLiteral("\0" + "12");
    // Luau decimal escapes consume up to three digits. \0 followed by 12
    // could be parsed as the different byte \012; \00012 is unambiguous.
    expect(source).toContain(String.raw`"\00012"`);
    expect(source).not.toContain(String.raw`"\012"`);
  });

  it("does not confuse '--' inside a quoted literal with a comment", () => {
    const source = printLiteral('a"--not a comment--"b');
    expect(source).toContain(String.raw`"a\"--not a comment--\"b"`);
    expect(hasArtificialComments(source)).toBe(false);
  });

  it("handles escaped quotes and interpolation backticks in comment detection", () => {
    expect(hasArtificialComments(String.raw`print("a\"--text")`)).toBe(false);
    expect(hasArtificialComments('return `literal -- text`')).toBe(false);
    expect(hasArtificialComments('return `hello { "--" }`')).toBe(false);
  });

  it("still detects actual comment markers outside strings", () => {
    expect(hasArtificialComments('print("--") -- actual comment')).toBe(true);
    expect(hasArtificialComments("-- leading comment\nreturn 1")).toBe(true);
    expect(hasArtificialComments("return 1\n-- trailing comment")).toBe(true);
  });

  it("tracks nested interpolation expressions and literal brace escapes", () => {
    expect(hasArtificialComments('return `outer {`inner -- text`} end`')).toBe(false);
    expect(hasArtificialComments('return `outer {({["}"] = `--`})["}"]}`')).toBe(false);
    expect(hasArtificialComments('return `outer {`inner -- text`} end` -- actual')).toBe(true);
    expect(hasArtificialComments('return `\\u{7b} -- text`')).toBe(false);
    expect(hasArtificialComments('return `outer {value -- actual\n}`')).toBe(true);
    expect(hasArtificialComments('return `outer {`inner {value -- actual\n}`} end`')).toBe(true);
  });

  it("ignores long string contents while detecting comments after them", () => {
    expect(hasArtificialComments('return [==[-- text ` { " } ]==]')).toBe(false);
    expect(hasArtificialComments('return [==[-- text ]==] -- actual')).toBe(true);
    expect(hasArtificialComments('return `outer {[=[-- text]=]}`')).toBe(false);
  });

  it.each([0, 1, 2].flatMap(opt => [1, 2].map(debug => `O${opt}g${debug}`)))(
    'accepts valid nested byte-string interpolation at %s', profile => {
      const input = readFileSync(new URL(`fixtures/rosetta-printer/nested-interpolation-${profile}.luauc`, import.meta.url));
      const result = decompile(input);
      expect(result.ok).toBe(true);
      expect(result.diagnostics.filter(item => item.severity === 'error')).toEqual([]);
    },
  );
});
