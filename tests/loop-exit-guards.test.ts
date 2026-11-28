import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {expect, it} from "vitest";
import {block, chunk, ident, lit, type Expression, type Statement} from "../src/ast/Ast.ts";
import {cleanupAst} from "../src/ast/AstCleanup.ts";
import {decompile} from "../src/decompile.ts";
import {printLuau} from "../src/print/LuauPrinter.ts";

const call = (name: string, args: Expression[] = []): Expression => ({kind: "call", callee: ident(name), args});
const effect = (name: string): Statement => ({kind: "expression-stmt", expression: call(name)});
const clean = (statements: Statement[]) => cleanupAst(chunk(statements), {
  typeAnnotations: "off", ifExpressions: false, earlyReturn: false, earlyContinue: true,
  foldSingleUseTemps: false, unfoldModuleTables: false, interpolatedStrings: false, mathConstants: false,
});
const loop = (body: Statement[]): Statement => ({kind: "numeric-for", name: "index", start: lit(1), stop: lit(4), body: block(body)});
const guard = (...body: Statement[]): Statement => ({kind: "if", test: ident("ready"), consequent: block(body), branches: []});

it.each(["break", "return"] as const)("keeps an effectful %s branch as the loop exit", kind => {
  const exit: Statement = kind === "return" ? {kind, values: [call("many")]} : {kind};
  const output = printLuau(clean([loop([guard(effect("selected"), exit)])]));
  expect(output).toContain("if ready then\n        selected()");
  expect(output).not.toContain("continue");
  expect(output).toContain(kind === "return" ? "return many()" : "break");
});

it("keeps the terminating predicate attached to its exit work", () => {
  const output = printLuau(clean([loop([guard(guard(effect("selected"), {kind: "break"}))])]));
  expect(output).toContain("selected()");
  expect(output.match(/ready/g)).toHaveLength(2);
  // A prefix may remain a guard, but the actual terminating predicate stays
  // attached to the work that selects and leaves this loop.
  expect(output).toMatch(/if ready(?: and ready)? then\n\s+selected\(\)\n\s+break/);
});

it("retains normal guard recovery for work that continues the iteration", () => {
  const output = printLuau(clean([loop([guard(effect("first"), effect("second"))])]));
  expect(output).toContain("if not ready then\n        continue");
  expect(output).toContain("first()\n    second()");
});

it("keeps a closure local inside its terminating branch", () => {
  const saved: Statement = {kind: "assign", targets: [ident("saved")], values: [{kind: "function-expr", params: [], isVararg: false,
    body: block([{kind: "return", values: [ident("cell")]}])}]};
  const output = clean([loop([guard({kind: "local", names: ["cell"], values: [ident("index")]}, saved, {kind: "break"})])]);
  const body = (output.body.statements[0] as Extract<Statement, {kind: "numeric-for"}>).body;
  expect(body.statements).toHaveLength(1);
  expect(body.statements[0]).toMatchObject({kind: "if", consequent: {statements: [{kind: "local", names: ["cell"]}, saved, {kind: "break"}]}});
});

const fixture = (path: string) => readFileSync(new URL(`./fixtures/loop-exit-guards/${path}`, import.meta.url));
type Manifest = {
  source: string; sourceSha256: string; inputs: Array<{path: string; sha256: string; pin: string; profile: string}>;
};
for (const name of ["manifest.json", "completed-manifest.json", "review-manifest.json"]) {
const manifest = JSON.parse(fixture(name).toString()) as Manifest;
for (const input of manifest.inputs) {
  it(`preserves ${manifest.source} at ${input.pin} ${input.profile}`, () => {
    expect(createHash("sha256").update(fixture(manifest.source)).digest("hex")).toBe(manifest.sourceSha256);
    const bytes = fixture(input.path);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(input.sha256);
    const result = decompile(bytes, {opcodeEncoding: "official"});
    if (!result.ok) throw new Error(result.error);
    expect(result.validation).toEqual([]);
    expect(result.source).toContain("break");
    if (name === "completed-manifest.json" && !input.profile.startsWith("O2")) {
      const repeat = result.ast.body.statements.find(statement => statement.kind === "repeat");
      if (repeat?.kind !== "repeat" || repeat.test.kind !== "call") throw new Error("missing repeat test call");
      const exit = repeat.body.statements.find(statement => statement.kind === "if");
      if (exit?.kind !== "if" || exit.test.kind !== "call") throw new Error("missing exit predicate");
      expect(repeat.test.callee).toEqual(exit.test.callee);
      expect(repeat.test.callee.kind).toBe("identifier");
      const argument = repeat.test.args[0];
      if (argument?.kind !== "identifier") throw new Error("missing test argument binding");
      const definition = repeat.body.statements.find(statement => statement.kind === "local" && statement.names.includes(argument.name));
      expect(definition).toMatchObject({kind: "local", values: [{kind: "binary", op: "..", left: {kind: "literal", value: "until"}}]});
    }
  });
}
}
