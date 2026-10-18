import { describe, expect, it } from "vitest";
import { decompile } from "../src/decompile.ts";
import { compile, proto, ret } from "./helpers.ts";

describe("decompile pipeline errors", () => {
  it("returns a typed failure instead of throwing from a later pipeline stage", () => {
    const bytes = compile(proto({ instructions: [ret()] }));
    // An untyped JS consumer can supply a value outside the TS indent union.
    // The printer rejects negative indentation, which must be returned as an
    // API failure instead of escaping through the public entry point.
    const result = decompile(bytes, { indent: -1 as 2 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("pipeline");
      expect(result.error).toBeTruthy();
      expect(result.diagnostics).toContainEqual({
        severity: "error",
        code: "pipeline",
        message: result.error,
      });
    }
  });

  it("still decompiles normally with valid options", () => {
    const result = decompile(compile(proto({ instructions: [ret()] })), { indent: 2 });
    expect(result.ok).toBe(true);
  });
});
