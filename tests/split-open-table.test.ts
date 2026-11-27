import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import type { TableExpression } from "../src/ast/Ast.ts";
import { decompile } from "../src/decompile.ts";

it.each(["O0g1", "O1g1", "O2g1", "O0g2", "O1g2", "O2g2"])(
  "keeps the whole prefix and open tail in one split constructor (%s)", profile => {
    const bytes = readFileSync(new URL(`./fixtures/split-open-table/${profile}-shuffled.luauc`, import.meta.url));
    const result = decompile(bytes);
    if (!result.ok) throw new Error(result.error);
    const build = result.ast.body.statements.find(statement => statement.kind === "function-decl" && statement.params[0] === "start");
    expect(build).toBeDefined();
    const collect = (node: unknown): TableExpression[] => {
      if (Array.isArray(node)) return node.flatMap(collect);
      if (!node || typeof node !== "object") return [];
      return [...((node as {kind?: string}).kind === "table" ? [node as TableExpression] : []), ...Object.values(node).flatMap(collect)];
    };
    const tables = collect(build);
    expect(tables).toHaveLength(1);
    expect(tables[0]!.fields).toHaveLength(41);
    const tail = tables[0]!.fields.at(-1)!;
    // A final positional call expands its results. CallExpression.open tracks
    // the argument pack, which is fixed in this authored example.
    expect(tail.key).toBeUndefined();
    expect(tail.name).toBeUndefined();
    expect(tail.value).toMatchObject({kind: "call", open: false});
    expect(tail.value).not.toHaveProperty("inlineForIdentity", true);
    expect(result.validation).toEqual([]);
  },
);
