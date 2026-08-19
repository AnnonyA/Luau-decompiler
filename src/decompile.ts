import { validateAst, type ValidationFailure } from "./ast/AstValidator.js";
import type { Chunk } from "./ast/Ast.js";
import { chunk } from "./ast/Ast.js";
import { cleanupAst, type CleanupOptions } from "./ast/AstCleanup.js";
import { decodeBytecode, type DecodeOptions, type DecodeResult } from "./decode/Decoder.js";
import { BytecodeError } from "./decode/BytecodeError.js";
import type { BytecodeModule } from "./decode/Prototype.js";
import type { BytecodeProfile } from "./decode/BytecodeProfile.js";
import { DiagnosticBag, type Diagnostic } from "./diagnostics.js";
import { disassembleModule } from "./disasm/Disassembler.js";
import { printLuau, hasArtificialComments, type PrintOptions } from "./print/LuauPrinter.js";
import { reconstructFunction } from "./reconstruct/Reconstructor.js";
import { applyRuntimeContext, parseRuntimeContext, type RuntimeContext } from "./reconstruct/RuntimeContext.js";

export type TypeAnnotationMode = "off" | "functions" | "useful";

export interface DecompileOptions extends DecodeOptions, PrintOptions {
  debugNames?: boolean;
  typeAnnotations?: TypeAnnotationMode;
  ifExpressions?: boolean;
  earlyReturn?: boolean;
  interpolatedStrings?: boolean;
  mathConstants?: boolean;
  /** Live-game naming hints. Pass `false` to ignore any collected context. */
  runtimeContext?: RuntimeContext | false;
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

export function defaultCleanupOptions(options: DecompileOptions = {}): CleanupOptions {
  return {
    typeAnnotations: options.typeAnnotations ?? "useful",
    ifExpressions: options.ifExpressions ?? true,
    earlyReturn: options.earlyReturn ?? true,
    interpolatedStrings: options.interpolatedStrings ?? true,
    mathConstants: options.mathConstants ?? true,
  };
}

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
  const raw = chunk(reconstructed.body.statements);
  const cleaned = cleanupAst(raw, defaultCleanupOptions(options));
  const ast = options.runtimeContext === false ? cleaned : applyRuntimeContext(cleaned, options.runtimeContext);
  const validation = validateAst(ast);
  for (const failure of validation) {
    diagnostics.error(failure.code, failure.message);
  }

  const source = printLuau(ast, { indent: options.indent ?? 4 });
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

export function parseQueryOptions(query: URLSearchParams): DecompileOptions {
  const indentRaw = query.get("indent");
  const indent = indentRaw === "tab" ? "tab" : indentRaw === "2" ? 2 : 4;
  const typeAnnotations = (query.get("type_annotations") as TypeAnnotationMode | null) ?? "useful";
  const runtimeRaw = query.get("runtime_context");
  let runtimeContext: RuntimeContext | false | undefined;
  if (runtimeRaw === "false") {
    runtimeContext = false;
  } else if (runtimeRaw) {
    try {
      runtimeContext = parseRuntimeContext(JSON.parse(runtimeRaw));
    } catch {
      runtimeContext = undefined;
    }
  }
  return {
    indent,
    typeAnnotations: ["off", "functions", "useful"].includes(typeAnnotations) ? typeAnnotations : "useful",
    ifExpressions: query.get("if_expressions") !== "false",
    earlyReturn: query.get("early_return") !== "false",
    interpolatedStrings: query.get("interpolated_strings") !== "false",
    mathConstants: query.get("math_constants") !== "false",
    runtimeContext,
  };
}
