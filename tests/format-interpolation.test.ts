import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {expect, it} from "vitest";
import {chunk, ident, lit, type Expression} from "../src/ast/Ast.ts";
import {printLuau} from "../src/print/LuauPrinter.ts";
import {decompile} from "../src/decompile.ts";

const method = (format: string, args: Expression[]): Expression =>
  ({kind: "method-call", object: lit(format), name: "format", args, open: false});
const local = (value: Expression, names = ["value"]) => chunk([{kind: "local", names, values: [value]}]);

it("recovers a literal format's scalar protocol and exact percent/brace escapes", () => {
  expect(printLuau(local(method("100%% {%*} `%*", [lit(3), {kind: "unary", op: "not", argument: ident("flag")}]))))
    .toBe("local value = `100% \\{{3}} \\`{not flag}`\n");
});

it.each(["%s", "%d", "%q", "%", "%* %*", "%%*"])("retains the original method for unsupported protocol %s", format => {
  expect(printLuau(local(method(format, [lit(2)])))).toContain(":format(2)");
});

it("declines arguments that may be compiler-propagated string constants", () => {
  const candidates: Expression[] = [lit("value"), ident("value"), {kind: "call", callee: ident("value"), args: [], open: false},
    {kind: "binary", op: "..", left: lit("one"), right: lit("two")},
    {kind: "binary", op: "or", left: ident("value"), right: lit(1)},
    {kind: "if-expr", test: ident("flag"), consequent: lit(1), alternate: lit("value"), branches: []}];
  for (const value of candidates) expect(printLuau(local(method("%*", [value])))).toContain(":format(");
});

it("retains open, fixed-wide, unused and table-tail results", () => {
  const format = method("%*", [lit(2)]);
  expect(printLuau(chunk([{kind: "return", values: [format]}]))).toContain(":format(2)");
  expect(printLuau(local(format, ["first", "second"]))).toContain(":format(2)");
  expect(printLuau(chunk([{kind: "expression-stmt", expression: format}]))).toContain(":format(2)");
  expect(printLuau(local({kind: "table", fields: [{value: format}]}))).toContain(":format(2)");
  expect(printLuau(local(method("%*", [{kind: "vararg"}])))).toContain(":format(...)");
});

it("accepts an already adjusted call without discarding a necessary primary group", () => {
  const scalar: Expression = {kind: "paren", expression: method("%*", [lit(2)])};
  expect(printLuau(chunk([{kind: "return", values: [scalar]}]))).toBe("return (`{2}`)\n");
  expect(printLuau(local({kind: "index", table: scalar, key: lit(1)}))).toBe("local value = (`{2}`)[1]\n");
});

it("respects the interpolation option", () => {
  expect(printLuau(local(method("%*", [lit(2)])), {interpolatedStrings: false})).toBe('local value = ("%*"):format(2)\n');
});

it("groups an interpolated table instead of emitting forbidden double braces", () => {
  expect(printLuau(local(method("%*", [{kind: "table", fields: [{name: "marker", value: lit(11)}]}]))))
    .toBe("local value = `{({ marker = 11 })}`\n");
});

const fixture = (name: string) => readFileSync(new URL(`./fixtures/format-interpolation/${name}`, import.meta.url));
type Manifest = {
  source: string; sourceSha256: string; inputs: Array<{path: string; sha256: string; pin: string; profile: string}>;
};
for (const name of ["manifest.json", "review-manifest.json"]) {
const manifest = JSON.parse(fixture(name).toString()) as Manifest;
for (const input of manifest.inputs) it(`validates ${manifest.source} at ${input.pin} ${input.profile}`, () => {
  expect(createHash("sha256").update(fixture(manifest.source)).digest("hex")).toBe(manifest.sourceSha256);
  const bytes = fixture(input.path);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(input.sha256);
  const result = decompile(bytes, {opcodeEncoding: "official"});
  if (!result.ok) throw new Error(result.error);
  expect(result.validation).toEqual([]);
  expect(result.source).toContain("`");
  if (name === "manifest.json") expect(result.source).toContain(":format(");
  else expect(result.source).toContain("{({ marker = 11 })}");
});
}
