import { validateAst, type ValidationFailure } from "./ast/AstValidator.js";
import type { Chunk } from "./ast/Ast.js";
import { chunk } from "./ast/Ast.js";
import { cleanupAst, type CleanupOptions } from "./ast/AstCleanup.js";
import { decodeBytecode, type DecodeOptions, type DecodeResult } from "./decode/Decoder.js";
import { BytecodeError } from "./decode/BytecodeError.js";
import type { BytecodeModule } from "./decode/Prototype.js";
import type { BytecodeProfile } from "./decode/BytecodeProfile.js";
import { Opcode } from "./decode/Opcode.js";
import { DiagnosticBag, type Diagnostic } from "./diagnostics.js";
import { disassembleModule } from "./disasm/Disassembler.js";
import { printLuau, hasArtificialComments, type PrintOptions } from "./print/LuauPrinter.js";
import { reconstructFunction } from "./reconstruct/Reconstructor.js";
import { applyRuntimeContext, parseRuntimeContext, type RuntimeContext } from "./reconstruct/RuntimeContext.js";
import { styleLocalNames, type NameStyleOptions } from "./reconstruct/NameStyle.js";
import { recoverFunctionEvidence } from "./reconstruct/FunctionEvidence.js";
import { inlineHelperLines, recoverInlineCalls } from "./reconstruct/InlineRecovery.js";

export type TypeAnnotationMode = "off" | "functions" | "useful";

export interface DecompileOptions extends DecodeOptions, PrintOptions, NameStyleOptions {
  debugNames?: boolean;
  typeAnnotations?: TypeAnnotationMode;
  ifExpressions?: boolean;
  earlyReturn?: boolean;
  interpolatedStrings?: boolean;
  mathConstants?: boolean;
  /** Recover proven numeric calls from retained helpers expanded by O2. */
  recoverInlinedFunctions?: boolean;
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

  // Decoding experimental class instructions is useful for inspection, but
  // the source AST does not represent classes yet. Do not report success
  // after silently dropping their constructors or method registration.
  for (const prototype of decoded.module.prototypes) {
    for (const instruction of prototype.instructions) {
      if (instruction.opcode === Opcode.NEWCLASS || instruction.opcode === Opcode.NEWCLASSMEMBER ||
          instruction.opcode === Opcode.CONSTRUCT || instruction.opcode === Opcode.FINCONSTRUCT) {
        const error = `unsupported opcode ${instruction.mnemonic} in prototype ${prototype.id} at pc ${instruction.pc}: experimental class source reconstruction is not implemented`;
        diagnostics.error("unsupported-opcode", error, { prototypeId: prototype.id, pc: instruction.pc });
        return { ok: false, error, code: "unsupported-opcode", diagnostics: [...diagnostics.all] };
      }
    }
  }

  const main = decoded.module.prototypes[decoded.module.mainProtoId];
  if (!main) {
    return { ok: false, error: "missing main prototype", code: "main", diagnostics: [...diagnostics.all] };
  }

  try {
    const reconstructed = reconstructFunction(decoded.module, main);
    const raw = chunk(reconstructed.body.statements);
    const cleaned = cleanupAst(raw, defaultCleanupOptions(options));
    const recovered = options.recoverInlinedFunctions === false ? cleaned : recoverInlineCalls(cleaned, inlineHelperLines(decoded.module));
    const contextual = options.runtimeContext === false ? recovered : applyRuntimeContext(recovered, options.runtimeContext);
    const ast = styleLocalNames(recoverFunctionEvidence(contextual, options), options);
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    diagnostics.error("pipeline", message);
    return { ok: false, error: message, code: "pipeline", diagnostics: [...diagnostics.all] };
  }

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
    generatedNames: query.get("generated_names") === "compact" ? "compact" : "readable",
    nameCasing: parseNameCasing(query.get("name_casing")),
    typeAnnotations: ["off", "functions", "useful"].includes(typeAnnotations) ? typeAnnotations : "useful",
    ifExpressions: query.get("if_expressions") !== "false",
    earlyReturn: query.get("early_return") !== "false",
    interpolatedStrings: query.get("interpolated_strings") !== "false",
    mathConstants: query.get("math_constants") !== "false",
    recoverInlinedFunctions: query.get("recover_inlined_functions") !== "false",
    runtimeContext,
  };
}

function parseNameCasing(value: string | null): NameStyleOptions['nameCasing'] {
  return value === 'camelCase' || value === 'snake_case' || value === 'PascalCase' ? value : 'preserve';
}
