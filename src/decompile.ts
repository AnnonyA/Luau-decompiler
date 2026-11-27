import { applyOptionalRewrites } from "./reconstruct/OptionalRewrites.js";
import { boundLocalLifetimes } from "./reconstruct/LocalLifetimes.js";
import { validateAst, type ValidationFailure } from "./ast/AstValidator.js";
import type { Chunk } from "./ast/Ast.js";
import { chunk } from "./ast/Ast.js";
import { cleanupAst, type CleanupOptions } from "./ast/AstCleanup.js";
import { presentClosures } from "./ast/ClosurePresentation.js";
import { foldTemporaries } from "./ast/TempFolding.js";
import { decodeBytecode, type DecodeOptions, type DecodeResult } from "./decode/Decoder.js";
import { BytecodeError } from "./decode/BytecodeError.js";
import type { BytecodeModule } from "./decode/Prototype.js";
import type { BytecodeProfile } from "./decode/BytecodeProfile.js";
import { Opcode } from "./decode/Opcode.js";
import { DiagnosticBag, type Diagnostic } from "./diagnostics.js";
import { disassembleModule } from "./disasm/Disassembler.js";
import { printLuau, hasArtificialComments, type PrintOptions } from "./print/LuauPrinter.js";
import { reconstructFunction } from "./reconstruct/Reconstructor.js";
import { lowerClosureIdentity } from "./reconstruct/ClosureIdentityLowering.js";
import { recoverClosureFactories } from "./reconstruct/ClosureInlineRecovery.js";
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
  earlyContinue?: boolean;
  foldSingleUseTemps?: boolean;
  unfoldModuleTables?: boolean;
  keepDeadFunctions?: boolean;
  rerollUnrolledLoops?: boolean;
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
    earlyContinue: options.earlyContinue ?? true,
    foldSingleUseTemps: options.foldSingleUseTemps ?? true,
    unfoldModuleTables: options.unfoldModuleTables ?? true,
    interpolatedStrings: options.interpolatedStrings ?? true,
    mathConstants: options.mathConstants ?? false,
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

  for (const prototype of decoded.module.prototypes) {
    if (!prototype.constants.some(constant => constant.kind === "vector")) continue;
    const firstUses = new Map<number, number>();
    for (const instruction of prototype.instructions) {
      const index = instruction.constantIndex;
      if (index !== undefined && !firstUses.has(index)) firstUses.set(index, instruction.pc);
    }
    prototype.constants.forEach((constant, index) => {
      if (constant.kind !== "vector") return;
      diagnostics.warning("vector-constructor-assumption",
        `prototype ${prototype.id} K${index} is a ${constant.precise ? "64" : "32"}-bit vector constant; reconstructed vector.create requires the native constructor and compatible VM vector size/precision and recompilation options. The bytecode does not identify a callable constructor or the host configuration.`,
        { prototypeId: prototype.id, pc: firstUses.get(index) });
    });
  }

  const main = decoded.module.prototypes[decoded.module.mainProtoId];
  if (!main) {
    return { ok: false, error: "missing main prototype", code: "main", diagnostics: [...diagnostics.all] };
  }

  try {
    const reconstructed = reconstructFunction(decoded.module, main);
    const factories = recoverClosureFactories(chunk(reconstructed.body.statements), decoded.module);
    const lowered = lowerClosureIdentity(factories.ast, decoded.module);
    const resolvedKeys = new Set(lowered.resolvedKeys);
    for (const diagnostic of factories.diagnostics) {
      diagnostics.push(diagnostic);
      if (diagnostic.code !== "closure-identity-native-inline" || diagnostic.prototypeId === undefined) continue;
      const instruction = decoded.module.prototypes[diagnostic.prototypeId]?.instructions.find(instruction => instruction.pc === diagnostic.pc);
      if (instruction?.opcode === Opcode.DUPCLOSURE) resolvedKeys.add(`${diagnostic.prototypeId}:${instruction.d}`);
    }
    for (const diagnostic of reconstructed.closureIdentityDiagnostics) {
      const instruction = diagnostic.prototypeId !== undefined && diagnostic.pc !== undefined
        ? decoded.module.prototypes[diagnostic.prototypeId]?.instructions.find(instruction => instruction.pc === diagnostic.pc) : undefined;
      if (diagnostic.code === "closure-identity-unresolved" && instruction?.opcode === Opcode.DUPCLOSURE &&
          resolvedKeys.has(`${diagnostic.prototypeId}:${instruction.d}`)) continue;
      diagnostics.push(diagnostic);
    }
    const raw = presentClosures(lowered.ast);
    const debugNames = new Set(decoded.module.prototypes.flatMap((prototype) => prototype.locals.map((local) => local.name)));
    const sourceNames = new Set([...reconstructed.declaredLocals, ...debugNames]);
    const cleaned = cleanupAst(raw, { ...defaultCleanupOptions(options), sourceNames, debugNames,
      nameStems: reconstructed.nameStems, workingNames: reconstructed.workingNames });
    const helpers = new Set<string>();
    const restored = options.recoverInlinedFunctions === false ? cleaned
      : recoverInlineCalls(cleaned, inlineHelperLines(decoded.module), helpers);
    const recovered = helpers.size === 0 || options.foldSingleUseTemps === false
      ? restored : foldTemporaries(restored, { argumentsOf: helpers });
    const rewritten = options.mathConstants || options.rerollUnrolledLoops || options.keepDeadFunctions === false || options.unfoldModuleTables !== false
      ? applyOptionalRewrites(recovered, {
      mathConstants: options.mathConstants ?? false,
      rerollUnrolledLoops: options.rerollUnrolledLoops ?? false,
      keepDeadFunctions: options.keepDeadFunctions ?? true,
      unfoldModuleTables: options.unfoldModuleTables ?? true,
    }) : recovered;
    const contextual = options.runtimeContext === false ? rewritten : applyRuntimeContext(rewritten, options.runtimeContext);
    const ast = boundLocalLifetimes(styleLocalNames(recoverFunctionEvidence(contextual, options), options), options);
    const validation = validateAst(ast);
    for (const failure of validation) {
      diagnostics.error(failure.code, failure.message);
    }

    const printOptions: PrintOptions = {indent: options.indent ?? 4, unicodeStrings: options.unicodeStrings,
      upvalueComments: options.upvalueComments, functionLineComments: options.functionLineComments, preferConst: options.preferConst};
    const printedSource = printLuau(ast, printOptions);
    const source = factories.requiresOptimization2 ? `--!optimize 2\n${printedSource}` : printedSource;
    // Opt-in metadata comments are deliberate. Still verify the same AST with
    // annotations disabled so comments cannot conceal an accidental token.
    const bareSource = options.upvalueComments || options.functionLineComments
      ? printLuau(ast, {...printOptions, upvalueComments: false, functionLineComments: false}) : printedSource;
    if (hasArtificialComments(bareSource)) {
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
    mathConstants: query.get("math_constants") === "true",
    earlyContinue: query.get("early_continue") !== "false",
    foldSingleUseTemps: query.get("fold_single_use_temps") !== "false",
    unfoldModuleTables: query.get("unfold_module_tables") !== "false",
    keepDeadFunctions: query.get("keep_dead_functions") !== "false",
    rerollUnrolledLoops: query.get("reroll_unrolled_loops") === "true",
    preferConst: query.get("prefer_const") === "true",
    unicodeStrings: query.get("unicode_strings") !== "false",
    upvalueComments: query.get("upvalue_comments") === "true",
    functionLineComments: query.get("function_line_comments") === "true",
    recoverInlinedFunctions: query.get("recover_inlined_functions") !== "false",
    runtimeContext,
  };
}

function parseNameCasing(value: string | null): NameStyleOptions['nameCasing'] {
  return value === 'camelCase' || value === 'snake_case' || value === 'PascalCase' ? value : 'preserve';
}
