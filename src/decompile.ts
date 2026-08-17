import { validateAst, type ValidationFailure } from "./ast/AstValidator.js";
import type { Chunk } from "./ast/Ast.js";
import { chunk } from "./ast/Ast.js";
import { decodeBytecode, type DecodeOptions, type DecodeResult } from "./decode/Decoder.js";
import { BytecodeError } from "./decode/BytecodeError.js";
import type { BytecodeModule } from "./decode/Prototype.js";
import type { BytecodeProfile } from "./decode/BytecodeProfile.js";
import { DiagnosticBag, type Diagnostic } from "./diagnostics.js";
import { disassembleModule } from "./disasm/Disassembler.js";
import { printLuau, hasArtificialComments } from "./print/LuauPrinter.js";
import { reconstructFunction } from "./reconstruct/Reconstructor.js";

export interface DecompileOptions extends DecodeOptions {
  debugNames?: boolean;
}

export interface DecompileSuccess {
  ok: true;
  source: string;
  ast: Chunk;
  module: BytecodeModule;
  profile: BytecodeProfile;
  diagnostics: Diagnostic[];
  disassembly: string;
  validation: ValidationFailure[];
}

export interface DecompileFailure {
  ok: false;
  error: string;
  code: string;
  diagnostics: Diagnostic[];
}

export type DecompileResult = DecompileSuccess | DecompileFailure;

export function decompile(input: Uint8Array | ArrayBuffer, options: DecompileOptions = {}): DecompileResult {
  const diagnostics = new DiagnosticBag();
  let decoded: DecodeResult;
  try {
    decoded = decodeBytecode(input, options);
  } catch (error) {
    if (error instanceof BytecodeError) {
      diagnostics.error(error.code, error.message);
      return { ok: false, error: error.message, code: error.code, diagnostics: [...diagnostics.all] };
    }
    const message = error instanceof Error ? error.message : String(error);
    diagnostics.error("internal", message);
    return { ok: false, error: message, code: "internal", diagnostics: [...diagnostics.all] };
  }

  for (const note of decoded.profile.notes) {
    diagnostics.info("profile", note);
  }

  const main = decoded.module.prototypes[decoded.module.mainProtoId];
  if (!main) {
    return { ok: false, error: "missing main prototype", code: "main", diagnostics: [...diagnostics.all] };
  }

  const reconstructed = reconstructFunction(decoded.module, main);
  const ast = chunk(reconstructed.body.statements);
  const validation = validateAst(ast);
  for (const failure of validation) {
    diagnostics.error(failure.code, failure.message);
  }

  const source = printLuau(ast);
  if (hasArtificialComments(source)) {
    diagnostics.error("comments", "printer emitted a comment");
  }

  return {
    ok: true,
    source,
    ast,
    module: decoded.module,
    profile: decoded.profile,
    diagnostics: [...diagnostics.all],
    disassembly: disassembleModule(decoded.module),
    validation,
  };
}

export function decodeOnly(input: Uint8Array | ArrayBuffer, options: DecodeOptions = {}): DecodeResult {
  return decodeBytecode(input, options);
}
