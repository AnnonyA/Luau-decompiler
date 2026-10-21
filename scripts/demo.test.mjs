import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Worker } from "node:worker_threads";

const site = new URL("../_site/", import.meta.url);

function decompileInWorker(bytes) {
  return new Promise((resolve, reject) => {
    // Bridge the browser messaging API to a real isolated Node worker. This
    // exercises module loading and structured cloning of the actual site worker.
    const worker = new Worker(`
      const { parentPort, workerData } = require("node:worker_threads");
      globalThis.self = { postMessage: (value) => parentPort.postMessage(value) };
      import(workerData).then(() => {
        parentPort.on("message", (data) => self.onmessage({ data }));
        parentPort.postMessage({ ready: true });
      }).catch((error) => { throw error; });
    `, { eval: true, workerData: new URL("worker.js", site).href });
    const timer = setTimeout(() => finish(new Error("Demo worker timed out")), 10_000);
    function finish(error, value) {
      clearTimeout(timer);
      void worker.terminate();
      if (error) reject(error); else resolve(value);
    }
    worker.on("error", (error) => finish(error));
    worker.on("message", (value) => {
      if (value.ready) worker.postMessage({ bytes, options: { typeAnnotations: "off" } });
      else finish(null, value);
    });
  });
}

test("the published example decompiles in the isolated demo worker", async () => {
  const bytes = new Uint8Array(await readFile(new URL("example.luauc", site)));
  const result = await decompileInWorker(bytes);
  assert.equal(result.ok, true);
  assert.match(result.source, /print\("Hello from Luau!"\)/);
  assert.match(result.disassembly, /CALL/);
  assert.equal(result.profile.version, 6);
});

test("the worker returns an actionable unsupported-bytecode diagnostic", async () => {
  const result = await decompileInWorker(new Uint8Array([255, 0, 0]));
  assert.equal(result.ok, false);
  assert.match(result.error, /version/i);
  assert.ok(result.diagnostics.length > 0);
});

test("the worker rejects malformed requests without crashing", async () => {
  const result = await decompileInWorker(null);
  assert.equal(result.ok, false);
  assert.match(result.error, /bytecode/i);
});
