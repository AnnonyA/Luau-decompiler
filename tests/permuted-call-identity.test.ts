import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { decompile } from "../src/decompile.ts";

it.each(["O0g1", "O1g1", "O2g1", "O0g2", "O1g2", "O2g2"])(
  "evaluates the object factory once when consumers precede it physically (%s)", profile => {
    const bytes = readFileSync(new URL(`./fixtures/permuted-call-identity/${profile}-shuffled.luauc`, import.meta.url));
    const result = decompile(bytes);
    if (!result.ok) throw new Error(result.error);
    const observers = result.ast.body.statements.filter(statement => statement.kind === "function-decl" &&
      statement.params[0] === "offset");
    expect(observers).toHaveLength(1);
    const collect = (node: unknown): Array<{kind: string}> => {
      if (Array.isArray(node)) return node.flatMap(collect);
      if (!node || typeof node !== "object") return [];
      return [...((node as {kind?: string}).kind === "call" ? [node as {kind: string}] : []), ...Object.values(node).flatMap(collect)];
    };
    expect(collect(observers[0])).toHaveLength(1);
    expect(result.validation).toEqual([]);
  },
);
