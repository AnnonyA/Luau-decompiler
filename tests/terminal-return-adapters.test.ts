import {readFileSync} from "node:fs";
import {expect, it} from "vitest";
import {decodeBytecode} from "../src/decode/Decoder.ts";
import {reconstructFunction} from "../src/reconstruct/Reconstructor.ts";

function nodes(value: unknown, kind: string): any[] {
  if (!value || typeof value !== "object") return [];
  const node = value as Record<string, unknown>;
  return [...(node.kind === kind ? [node] : []), ...Object.values(node).flatMap(child => nodes(child, kind))];
}

it.each(["O0g1", "O1g1", "O2g1", "O0g2", "O1g2", "O2g2"])(
  "preserves returning arms behind pure loop-exit adapters (%s)", profile => {
    const module = decodeBytecode(readFileSync(new URL(
      `./fixtures/terminal-return-adapters/${profile}-adapters.luauc`, import.meta.url))).module;
    // Normalization may erase simple stubs, but it is a bounded optimization.
    // Reconstructing the original graph must preserve the same terminal arms.
    const main = reconstructFunction(module, module.prototypes[module.mainProtoId]!);
    const functions = nodes(main.body, "function-expr");
    const search = functions.find(fn => fn.debugName === "search");
    const choose = functions.find(fn => fn.debugName === "choose");
    expect(search).toBeDefined();
    expect(choose).toBeDefined();
    expect(nodes(search.body, "break")).toEqual([]);
    expect(nodes(choose.body, "break")).toEqual([]);
    const found = nodes(search.body, "return").find(ret => ret.values[0]?.value === true);
    expect(found.values).toHaveLength(3);
    expect(found.values[1]).toMatchObject({kind: "literal", value: null});
    for (const label of ["found", "three", "seven"]) {
      expect(nodes(main.body, "call").filter(call => call.args.some((arg: any) => arg.value === label))).toHaveLength(1);
    }
    expect(nodes(choose.body, "function-expr")).toHaveLength(2);
  },
);
