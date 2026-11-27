import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import type { NumericForStatement } from "../src/ast/Ast.ts";
import { decompile } from "../src/decompile.ts";

it.each(["O0g1", "O1g1", "O2g1", "O0g2", "O1g2", "O2g2"])(
  "retains numeric iteration and its bounds through an entry jump (%s)", profile => {
    const bytes = readFileSync(new URL(`./fixtures/numeric-entry-layout/${profile}-shuffled.luauc`, import.meta.url));
    const result = decompile(bytes);
    if (!result.ok) throw new Error(result.error);
    const visit = (node: unknown): NumericForStatement[] => {
      if (Array.isArray(node)) return node.flatMap(visit);
      if (!node || typeof node !== "object") return [];
      return [...((node as {kind?: string}).kind === "numeric-for" ? [node as NumericForStatement] : []), ...Object.values(node).flatMap(visit)];
    };
    const loops = visit(result.ast);
    expect(loops).toHaveLength(1);
    expect(loops[0]!.start).toEqual({kind: "literal", value: 1});
    expect(loops[0]!.stop).toEqual({kind: "identifier", name: "limit"});
    expect(loops[0]!.body.statements.some(statement => statement.kind === "compound-assign" &&
      statement.op === "+" && statement.value.kind === "identifier" && statement.value.name === loops[0]!.name)).toBe(true);
  },
);
