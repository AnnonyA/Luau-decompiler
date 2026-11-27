import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {expect, it} from "vitest";
import {analyzeBindings} from "../src/analysis/Bindings.ts";
import {decompile} from "../src/decompile.ts";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/shared-return-conditions/${name}`, import.meta.url));
const manifest = JSON.parse(fixture("manifest.json").toString()) as {
  source: string; sourceSha256: string; entries: Array<{profile: string; bytecode: string; sha256: string}>;
};
function nodes(value: unknown, kind: string): Record<string, any>[] {
  if (!value || typeof value !== "object") return [];
  const node = value as Record<string, any>;
  return [...(node.kind === kind ? [node] : []), ...Object.values(node).flatMap(child => nodes(child, kind))];
}

for (const entry of manifest.entries) {
  it(`emits each shared classifier continuation once at ${entry.profile}`, () => {
    const bytes = fixture(entry.bytecode);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(entry.sha256);
    expect(createHash("sha256").update(fixture(manifest.source)).digest("hex")).toBe(manifest.sourceSha256);
    const result = decompile(bytes, {opcodeEncoding: "official"});
    if (!result.ok) throw new Error(result.error);
    expect(result.validation).toEqual([]);
    expect([...analyzeBindings(result.ast.body).globals].sort()).toEqual(["print", "select", "table"]);
    const classify = nodes(result.ast, "function-decl").find(fn => fn.name === "classify");
    expect(classify).toBeDefined();
    const literals = nodes(classify!.body, "literal");
    // These markers are the independent program's ordered predicate calls.
    // A later alternative is one shared continuation, not a separate copy
    // for every possible way an earlier short-circuit condition can fail.
    for (const marker of ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "o", "p", "other"]) {
      expect(literals.filter(node => node.value === marker), marker).toHaveLength(1);
    }
    for (const ret of nodes(classify!.body, "return")) {
      expect(ret.values).toHaveLength(3);
      expect(ret.values[1]).toEqual({kind: "literal", value: null});
    }
  });
}
