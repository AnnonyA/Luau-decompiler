import { describe, expect, it } from "vitest";
import { startServer } from "../src/server.ts";
import { DEFAULT_SAFETY_LIMITS } from "../src/safety/Limits.ts";
import { compile, proto, ret } from "./helpers.ts";

describe("HTTP request limits", () => {
  it("returns HTTP 413 for oversized binary data without blocking valid requests", async () => {
    const server = startServer(0, "127.0.0.1");
    try {
      if (!server.listening) {
        await new Promise<void>((resolve, reject) => {
          server.once("listening", resolve);
          server.once("error", reject);
        });
      }
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("expected TCP server address");
      }
      const url = `http://127.0.0.1:${address.port}/decompile`;
      const tooLarge = new Uint8Array(DEFAULT_SAFETY_LIMITS.maxBytecodeBytes + 1);
      const rejected = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: tooLarge,
      });
      expect(rejected.status).toBe(413);
      const error = await rejected.json();
      expect(error).toMatchObject({ ok: false, code: "payload-too-large" });

      const validBytecode = compile(proto({ instructions: [ret()] }));
      const accepted = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: validBytecode,
      });
      expect(accepted.status).toBe(200);
      const result = await accepted.json();
      expect(result).toMatchObject({ ok: true });
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
  });
});
