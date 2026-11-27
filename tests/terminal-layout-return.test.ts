import {readFileSync} from "node:fs";
import {expect, it} from "vitest";
import {decompile} from "../src/decompile.ts";

function nodes(value: unknown, kind: string): any[] {
  if (!value || typeof value !== "object") return [];
  const node = value as Record<string, unknown>;
  return [...(node.kind === kind ? [node] : []), ...Object.values(node).flatMap(child => nodes(child, kind))];
}

it.each(["O0g1", "O1g1", "O2g1", "O0g2", "O1g2", "O2g2"])(
  "keeps an early bare return placed at the physical bytecode end (%s)", profile => {
    const result = decompile(readFileSync(new URL(
      `./fixtures/terminal-layout-return/${profile}-adapters.luauc`, import.meta.url)));
    if (!result.ok) throw new Error(result.error);
    const route = nodes(result.ast, "function-decl").find(fn => fn.name === "route");
    expect(route).toBeDefined();
    const loop = nodes(route.body, "generic-for")[0];
    expect(loop).toBeDefined();
    expect(nodes(loop.body, "return").filter(ret => ret.values.length === 0)).toHaveLength(2);
    expect(route.body.statements.at(-1).kind).toBe("expression-stmt");
    expect(result.validation).toEqual([]);
  },
);
