import { decompile } from "./engine/decompile.js";
import { validateSize } from "./assets/input.js";

self.onmessage = ({ data }) => {
  try {
    if (!(data?.bytes instanceof Uint8Array)) throw new Error("Expected binary Luau bytecode.");
    validateSize(data.bytes.byteLength);
    const result = decompile(data.bytes, data.options);
    if (!result.ok) {
      self.postMessage(result);
      return;
    }
    // AST/module/profile contain BigInts or functions and can be very large.
    // Send only the cloneable fields used by the interface.
    const { version, typesVersion, status } = result.profile;
    self.postMessage({
      ok: true, source: result.source, disassembly: result.disassembly,
      diagnostics: result.diagnostics, profile: { version, typesVersion, status },
    });
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error), diagnostics: [] });
  }
};
