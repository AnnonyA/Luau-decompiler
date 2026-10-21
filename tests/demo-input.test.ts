import { describe, expect, it } from "vitest";
import { decodeBase64, validateSize, MAX_BYTES } from "../web/assets/input.js";
import { DEFAULT_SAFETY_LIMITS } from "../src/safety/Limits.ts";

describe("browser bytecode input", () => {
  it("decodes padded and unpadded Base64 with whitespace without changing bytes", () => {
    expect([...decodeBase64(" AP+A\nQQ== ")]).toEqual([0, 255, 128, 65]);
    expect([...decodeBase64("AP+AQQ")]).toEqual([0, 255, 128, 65]);
  });

  it.each(["", " \n", "x", "@@@", "AA=A", "AAAA=", "data:application/octet-stream;base64,AA=="])(
    "rejects invalid or empty input %j", (input) => {
      expect(() => decodeBase64(input)).toThrow();
    },
  );

  it("checks binary size before reading a selected file", () => {
    expect(MAX_BYTES).toBe(DEFAULT_SAFETY_LIMITS.maxBytecodeBytes);
    expect(() => validateSize(0)).toThrow(/empty/i);
    expect(() => validateSize(MAX_BYTES + 1)).toThrow(/16 MiB/);
    expect(() => validateSize(MAX_BYTES)).not.toThrow();
  });

  it("rejects oversized Base64 before decoding it", () => {
    expect(() => decodeBase64("A".repeat(Math.ceil(MAX_BYTES / 3) * 4 + 4))).toThrow(/16 MiB/);
  });
});
