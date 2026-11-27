import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {expect, it} from "vitest";
import {analyzeBindings} from "../src/analysis/Bindings.ts";
import {decompile} from "../src/decompile.ts";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/shared-return-phis/${name}`, import.meta.url));
const manifest = JSON.parse(fixture("manifest.json").toString()) as {
  source: string; sourceSha256: string; entries: Array<{profile: string; bytecode: string; sha256: string}>;
};
function nodes(value: unknown, kind: string): Record<string, any>[] {
  if (!value || typeof value !== "object") return [];
  const node = value as Record<string, any>;
  return [...(node.kind === kind ? [node] : []), ...Object.values(node).flatMap(child => nodes(child, kind))];
}
for (const entry of manifest.entries) {
  it(`retains the loader cell and emits its common initialization once at ${entry.profile}`, () => {
    const bytes = fixture(entry.bytecode);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(entry.sha256);
    expect(createHash("sha256").update(fixture(manifest.source)).digest("hex")).toBe(manifest.sourceSha256);
    const result = decompile(bytes, {opcodeEncoding: "official"});
    if (!result.ok) throw new Error(result.error);
    expect(result.validation).toEqual([]);
    expect([...analyzeBindings(result.ast.body).globals].sort()).toEqual(["print", "select", "table"]);
    const load = nodes(result.ast, "function-decl").find(fn => fn.name === "load");
    expect(load).toBeDefined();
    const writes = nodes(load!.body, "assign").filter(stmt => stmt.targets.some((target: any) =>
      target.kind === "property" && target.name === "ready"));
    expect(writes).toHaveLength(1);
    for (const marker of ["cached", "new"]) {
      expect(nodes(load!.body, "literal").filter(node => node.value === marker)).toHaveLength(1);
    }
    for (const ret of nodes(load!.body, "return").filter(ret => ret.values.length > 1)) {
      expect(ret.values).toHaveLength(5);
      expect(ret.values[3]).toEqual({kind: "literal", value: null});
    }
  });
}
