import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { block, chunk, ident, lit, type Expression, type LocalDeclaration, type Statement } from "../src/ast/Ast.ts";
import { recoverParallelAssignments } from "../src/ast/ParallelAssignments.ts";
import { foldTemporaries } from "../src/ast/TempFolding.ts";
import { cleanupAst } from "../src/ast/AstCleanup.ts";
import { decompile, defaultCleanupOptions } from "../src/decompile.ts";
import { printLuau } from "../src/print/LuauPrinter.ts";

const call = (name: string): Expression => ({kind: "call", callee: ident(name), args: [], open: false});
const field = (object: string, name: string): Expression => ({kind: "property", object: ident(object), name});
const index = (table: string, key: Expression): Expression => ({kind: "index", table: ident(table), key});
const local = (name: string, value: Expression): LocalDeclaration => ({kind: "local", names: [name], values: [value]});
const temp = (name: string, value: Expression): LocalDeclaration => ({...local(name, value),
  definition: {prototypeId: 2, pc: 4, register: 3}});
const store = (target: Expression, value: string): Statement => ({kind: "assign", targets: [target], values: [ident(value)]});
const fn = (statements: Statement[]): Statement => ({kind: "function-decl", name: "swap", local: true,
  params: ["owner", "left", "right"], isVararg: false, body: block(statements)});
const fixture = (): Statement[] => [
  temp("first", field("owner", "items")), temp("second", field("owner", "items")),
  temp("a", index("owner", ident("right"))), temp("b", index("owner", ident("left"))),
  store(index("first", ident("left")), "a"), store(index("second", ident("right")), "b"),
];
const recover = (statements: Statement[]) => recoverParallelAssignments(chunk([fn(statements)]));
const assignments = (statements: Statement[]) => {
  const result = recover(statements).body.statements[0]!;
  if (result.kind !== "function-decl") throw new Error("missing fixture function");
  return result.body.statements.filter(statement => statement.kind === "assign");
};

describe("private parallel indexed assignments", () => {
  it("restores a fixed store list and lets adjacent temporaries regain their original evaluation positions", () => {
    const result = recover(fixture());
    expect(assignments(fixture())).toHaveLength(1);
    expect(printLuau(foldTemporaries(result))).toContain("owner.items[left], owner.items[right] = owner[right], owner[left]");
  });

  it("keeps aliased destinations in their existing left-to-right store order", () => {
    const statements: Statement[] = [temp("a", call("first")), temp("b", call("second")),
      store(index("owner", lit(1)), "a"), store(index("owner", lit(1)), "b")];
    const result = assignments(statements);
    expect(result).toHaveLength(1);
    expect(result[0]!.values).toEqual([ident("a"), ident("b")]);
    expect(printLuau(foldTemporaries(recover(statements)))).toContain("owner[1], owner[1] = first(), second()");
  });

  it.each(["call", "method-call", "vararg"])("retains one result from each %s initializer", kind => {
    const value: Expression = kind === "call" ? call("many") : kind === "method-call"
      ? {kind: "method-call", object: ident("owner"), name: "many", args: [], open: false} : {kind: "vararg"};
    const statements = [temp("a", value), temp("b", value), store(field("owner", "a"), "a"), store(field("owner", "b"), "b")];
    const result = foldTemporaries(recover(statements));
    const declaration = result.body.statements[0]!;
    if (declaration.kind !== "function-decl") throw new Error("missing fixture function");
    expect(declaration.body.statements).toEqual([{kind: "assign", targets: [field("owner", "a"), field("owner", "b")],
      values: [value, {kind: "paren", expression: value}]}]);
  });

  it.each(["missing", "debug", "parallel-debug", "different-prototype"])("rejects %s producer ownership", evidence => {
    const statements = fixture();
    const declaration = statements[3] as LocalDeclaration;
    if (evidence === "missing") delete declaration.definition;
    if (evidence === "debug") declaration.definition!.debugName = "source";
    if (evidence === "parallel-debug") declaration.debugDeclaration = {prototypeId: 2, startPc: 5, endPc: 20, register: 3};
    if (evidence === "different-prototype") declaration.definition!.prototypeId = 3;
    expect(assignments(statements)).toHaveLength(2);
  });

  it("retains caller-protected temporary declarations", () => {
    expect(printLuau(foldTemporaries(recover(fixture()), {sourceNames: new Set(["a", "b", "first", "second"])})))
      .toContain("local a = owner[right]");
  });

  it.each(["effectful-key", "effectful-object", "global-key", "global-object"])("does not move an %s before the first store", effect => {
    const statements = fixture();
    const second = statements[5]!;
    if (second.kind !== "assign") throw new Error("missing assignment");
    second.targets[0] = effect === "effectful-key" ? index("second", call("key"))
      : effect === "effectful-object" ? {kind: "index", table: call("table"), key: lit(1)}
      : effect === "global-key" ? index("second", ident("globalKey")) : index("globalTable", lit(1));
    expect(assignments(statements)).toHaveLength(2);
  });

  it.each(["left", "right", "owner"])("keeps a destination depending on mutable captured cell %s", name => {
    const statements: Statement[] = [{kind: "function-decl", name: "mutate", local: true, params: [], isVararg: false,
      body: block([{kind: "assign", targets: [ident(name)], values: [call("changed")]}])},
    temp("a", call("first")), temp("b", call("second")),
    store(index("owner", ident("left")), "a"), store(index("owner", ident("right")), "b")];
    expect(assignments(statements)).toHaveLength(2);
  });

  it("permits an immutable captured destination cell", () => {
    const statements: Statement[] = [{kind: "function-decl", name: "read", local: true, params: [], isVararg: false,
      body: block([{kind: "return", values: [ident("owner")]}])},
    temp("a", call("first")), temp("b", call("second")),
    store(index("owner", lit(1)), "a"), store(index("owner", lit(2)), "b")];
    expect(assignments(statements)).toHaveLength(1);
  });

  it("rejects an identifier node shared by different lexical destination bindings", () => {
    const receiver = ident("owner");
    const destination = (key: number): Expression => ({kind: "index", table: receiver, key: lit(key)});
    const first = fn([{kind: "function-decl", name: "mutate", local: true, params: [], isVararg: false,
      body: block([{kind: "assign", targets: [ident("owner")], values: [call("changed")]}])},
      temp("a", call("first")), temp("b", call("second")),
      store(destination(1), "a"), store(destination(2), "b")]);
    const second: Statement = {kind: "function-decl", name: "other", local: true,
      params: ["owner"], isVararg: false, body: block([{kind: "return", values: [receiver]}])};
    const result = recoverParallelAssignments(chunk([first, second])).body.statements[0]!;
    if (result.kind !== "function-decl") throw new Error("missing fixture function");
    expect(result.body.statements.filter(statement => statement.kind === "assign")).toHaveLength(2);
  });

  it.each(["captured", "used-twice", "written", "gap", "reverse-order", "local-target"])("keeps %s scalar results", reason => {
    const statements = fixture();
    if (reason === "captured") statements.push(local("reader", {kind: "function-expr", params: [], isVararg: false,
      body: block([{kind: "return", values: [ident("a")]}])}));
    if (reason === "used-twice") statements.push({kind: "return", values: [ident("a")]});
    if (reason === "written") statements.push({kind: "assign", targets: [ident("a")], values: [lit(0)]});
    if (reason === "gap") statements.splice(4, 0, {kind: "expression-stmt", expression: call("observe")});
    if (reason === "reverse-order") [statements[2], statements[3]] = [statements[3]!, statements[2]!];
    if (reason === "local-target") (statements[5] as Extract<Statement, {kind: "assign"}>).targets = [ident("left")];
    expect(assignments(statements).filter(statement => statement.targets.length > 1)).toHaveLength(0);
  });

  it("respects the disabled temporary-recovery option", () => {
    const result = cleanupAst(chunk([fn(fixture())]), defaultCleanupOptions({foldSingleUseTemps: false, typeAnnotations: "off"}));
    expect(printLuau(result)).not.toMatch(/\], [^\n]*\] =/);
  });

  it("pins the independently executed normal and Hard bytecodes and exercises the recovered stores", () => {
    const base = new URL("./fixtures/parallel-assignments/", import.meta.url);
    const manifest = JSON.parse(readFileSync(new URL("manifest.json", base), "utf8")) as {
      sources: Array<{name: string; sourceSha256: string; bytecodes: Array<{profile: string; path: string; sha256: string}>}>;
    };
    const parallelStores = (node: unknown): number => {
      if (!node || typeof node !== "object") return 0;
      if (Array.isArray(node)) return node.reduce((count, value) => count + parallelStores(value), 0);
      const statement = node as Statement;
      return (statement.kind === "assign" && statement.targets.length > 1 ? 1 : 0) +
        Object.values(node).reduce<number>((count, value) => count + parallelStores(value), 0);
    };
    expect(manifest.sources).toHaveLength(3);
    for (const source of manifest.sources) {
      expect(createHash("sha256").update(readFileSync(new URL(source.name + ".luau", base))).digest("hex")).toBe(source.sourceSha256);
      expect(source.bytecodes).toHaveLength(12);
      for (const entry of source.bytecodes) {
        const bytes = readFileSync(new URL(entry.path, base));
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(entry.sha256);
        const result = decompile(bytes, {opcodeEncoding: "official"});
        if (!result.ok) throw new Error(source.name + "/" + entry.profile + ": " + result.error);
        expect(result.validation).toEqual([]);
        // Hard transforms can insert statements between scalar producers.
        // Those retain their original form; all twelve profiles still pass
        // the saved-bytecode execution comparison and AST validation.
        if (source.name === "parallel-store-effects" && !entry.profile.includes("+")) {
          expect(parallelStores(result.ast)).toBeGreaterThan(0);
        }
      }
    }
  });
});
