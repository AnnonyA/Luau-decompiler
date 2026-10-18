import { mergeLimits, type SafetyLimits } from "../safety/Limits.js";
import { BytecodeError } from "./BytecodeError.js";
import { BytecodeReader } from "./BytecodeReader.js";
import {
  LBC_TYPE_VERSION_MAX,
  LBC_TYPE_VERSION_MIN,
  LBC_VERSION_CLASSES,
  profileFor,
  type BytecodeProfile,
} from "./BytecodeProfile.js";
import { decodeImportPath, type LuauConstant } from "./Constant.js";
import { decodeCodeStream } from "./DecodedInstruction.js";
import { ConstantTag, Opcode, instructionWidth, opcodeDescriptor } from "./Opcode.js";
import type { BytecodeModule, FeedbackSlot, LocalDebugInfo, Prototype, UserdataType } from "./Prototype.js";

export type OpcodeEncoding = "auto" | "official" | "roblox";

export interface DecodeOptions {
  limits?: Partial<SafetyLimits>;
  opcodeEncoding?: OpcodeEncoding;
}

export interface DecodeResult {
  module: BytecodeModule;
  profile: BytecodeProfile;
}

export function decodeBytecode(input: Uint8Array | ArrayBuffer, options: DecodeOptions = {}): DecodeResult {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const limits = mergeLimits(options.limits);
  if (bytes.length === 0) {
    throw new BytecodeError("empty", "bytecode is empty");
  }
  if (bytes.length > limits.maxBytecodeBytes) {
    throw new BytecodeError("limit", `bytecode size ${bytes.length} exceeds limit ${limits.maxBytecodeBytes}`);
  }

  const reader = new BytecodeReader(bytes, limits);
  const version = reader.u8();
  if (version === 0) {
    const message = new TextDecoder().decode(bytes.subarray(1));
    throw new BytecodeError("compile-error", message || "compiler produced an error blob");
  }

  let typesVersion = 0;
  if (version >= 4) {
    typesVersion = reader.u8();
    if (typesVersion < LBC_TYPE_VERSION_MIN || typesVersion > LBC_TYPE_VERSION_MAX) {
      throw new BytecodeError("type-version", `unsupported type version ${typesVersion}`);
    }
  }

  const profile = profileFor(version, typesVersion);
  if (profile.status === "unsupported") {
    throw new BytecodeError("version", profile.notes[0] ?? `unsupported bytecode version ${version}`);
  }

  const strings = readStringTable(reader, limits);
  const userdataTypes = typesVersion === 3 ? readUserdataTypes(reader, strings, limits) : [];
  const protoCount = reader.boundedVarint(limits.maxPrototypeCount, "prototype count");
  const prototypes: Prototype[] = [];
  const encoding: OpcodeEncodingState = { value: options.opcodeEncoding ?? "auto" };

  for (let id = 0; id < protoCount; id++) {
    prototypes.push(readPrototype(reader, id, version, typesVersion, strings, limits, encoding));
  }
  if (encoding.value === "roblox") {
    profile.notes.push("Roblox opcode encoding was detected and normalized");
  }

  const mainProtoId = reader.varint();
  if (mainProtoId >= prototypes.length) {
    throw new BytecodeError("main", `main prototype ${mainProtoId} is out of range`);
  }
  if (encoding.value === "roblox" && reader.remaining === 24) {
    reader.skipTo(reader.bytes.length);
    profile.notes.push("Roblox bytecode trailer was recognized as opaque metadata");
  }
  if (!reader.atEnd) {
    throw new BytecodeError("trailing", `unused trailing bytes after main prototype`, reader.offset);
  }

  validateReferences(prototypes, strings, profile);
  return { module: { version, typesVersion, strings, userdataTypes, prototypes, mainProtoId }, profile };
}

function readStringTable(reader: BytecodeReader, limits: SafetyLimits): string[] {
  const count = reader.boundedVarint(limits.maxStringCount, "string count");
  const strings: string[] = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    const length = reader.varint();
    total += length;
    if (total > limits.maxStringBytes) {
      throw new BytecodeError("limit", "string table exceeds configured byte budget", reader.offset);
    }
    strings.push(reader.utf8(length));
  }
  return strings;
}

function readUserdataTypes(reader: BytecodeReader, strings: string[], limits: SafetyLimits): UserdataType[] {
  const types: UserdataType[] = [];
  let index = reader.u8();
  let seen = 0;
  while (index !== 0) {
    if (++seen > limits.maxUserdataTypes + 1) {
      throw new BytecodeError("limit", "userdata type remapping table is too large", reader.offset);
    }
    const name = readStringRef(reader, strings);
    types.push({ index, name });
    index = reader.u8();
  }
  return types;
}

function readStringRef(reader: BytecodeReader, strings: string[]): string {
  const id = reader.varint();
  if (id === 0) {
    return "";
  }
  const value = strings[id - 1];
  if (value === undefined) {
    throw new BytecodeError("string-ref", `string id ${id} is out of range`, reader.offset);
  }
  return value;
}

function optionalStringRef(reader: BytecodeReader, strings: string[]): string | undefined {
  const id = reader.varint();
  if (id === 0) {
    return undefined;
  }
  const value = strings[id - 1];
  if (value === undefined) {
    throw new BytecodeError("string-ref", `string id ${id} is out of range`, reader.offset);
  }
  return value;
}

interface OpcodeEncodingState {
  value: OpcodeEncoding;
}

function readPrototype(
  reader: BytecodeReader,
  id: number,
  version: number,
  typesVersion: number,
  strings: string[],
  limits: SafetyLimits,
  encoding: OpcodeEncodingState,
): Prototype {
  let protoSize = 0;
  let protoStart = reader.offset;
  if (version >= 12) {
    protoSize = reader.varint();
    protoStart = reader.offset;
  }

  const maxStackSize = reader.u8();
  const numParams = reader.u8();
  const numUpvalues = reader.u8();
  if (numUpvalues > limits.maxUpvalues) {
    throw new BytecodeError("limit", `upvalue count ${numUpvalues} exceeds limit ${limits.maxUpvalues}`, reader.offset);
  }
  const isVararg = reader.u8() !== 0;
  let flags = 0;
  let typeInfo: Uint8Array | undefined;

  if (version >= 4) {
    flags = reader.u8();
    const typeSize = reader.boundedVarint(limits.maxTypeInfoBytes, "typeinfo size");
    if (typeSize > 0) {
      typeInfo = reader.bytesOf(typeSize);
    }
  }

  const codeSize = reader.boundedVarint(limits.maxInstructionsPerPrototype, "instruction count");
  let code: Uint32Array = new Uint32Array(codeSize);
  for (let i = 0; i < codeSize; i++) {
    code[i] = reader.u32();
  }
  code = normalizeInstructionStream(code, id, encoding);

  const constantCount = reader.boundedVarint(limits.maxConstantsPerPrototype, "constant count");
  const constants: LuauConstant[] = [];
  for (let i = 0; i < constantCount; i++) {
    constants.push(readConstant(reader, strings, constants));
  }

  const childCount = reader.boundedVarint(limits.maxChildPrototypes, "child prototype count");
  const childProtoIds: number[] = [];
  for (let i = 0; i < childCount; i++) {
    childProtoIds.push(reader.varint());
  }

  const lineDefined = reader.varint();
  const debugName = optionalStringRef(reader, strings);

  let lineInfo: Prototype["lineInfo"];
  if (reader.u8() !== 0) {
    const lineGapLog2 = reader.u8();
    const intervals = ((codeSize - 1) >> lineGapLog2) + 1;
    const deltas = new Uint8Array(codeSize);
    for (let i = 0; i < codeSize; i++) {
      deltas[i] = reader.u8();
    }
    const absolute = new Int32Array(intervals);
    for (let i = 0; i < intervals; i++) {
      absolute[i] = reader.i32();
    }
    lineInfo = { lineGapLog2, deltas, absolute };
  }

  const locals: LocalDebugInfo[] = [];
  const upvalueNames: string[] = [];
  if (reader.u8() !== 0) {
    const localCount = reader.boundedVarint(limits.maxLocals, "local count");
    for (let i = 0; i < localCount; i++) {
      locals.push({
        name: readStringRef(reader, strings),
        startPc: reader.varint(),
        endPc: reader.varint(),
        register: reader.u8(),
      });
    }
    const upvalueCount = reader.varint();
    if (upvalueCount !== numUpvalues) {
      throw new BytecodeError("upvalues", `debug upvalue count ${upvalueCount} != proto nups ${numUpvalues}`, reader.offset);
    }
    for (let i = 0; i < upvalueCount; i++) {
      upvalueNames.push(readStringRef(reader, strings));
    }
  }

  const feedback: FeedbackSlot[] = [];
  if (version >= 11) {
    const feedbackSize = reader.boundedVarint(limits.maxFeedbackSlots, "feedback slots");
    for (let i = 0; i < feedbackSize; i++) {
      const kind = reader.u8();
      const pc = reader.varint();
      feedback.push({ kind, pc });
    }
  }

  let cost: bigint | undefined;
  if (version >= 12 && (flags & 8) !== 0) {
    cost = reader.varint64();
  }

  if (version >= 12) {
    reader.skipTo(protoStart + protoSize);
  }

  return {
    id,
    maxStackSize,
    numParams,
    numUpvalues,
    isVararg,
    flags,
    typeInfo,
    code,
    instructions: decodeCodeStream(code, constants.length),
    constants,
    childProtoIds,
    lineDefined,
    debugName,
    lineInfo,
    locals,
    upvalueNames,
    feedback,
    cost,
  };
}

function readConstant(reader: BytecodeReader, strings: string[], prior: LuauConstant[]): LuauConstant {
  const tag = reader.u8();
  switch (tag) {
    case ConstantTag.NIL:
      return { kind: "nil" };
    case ConstantTag.BOOLEAN:
      return { kind: "boolean", value: reader.u8() !== 0 };
    case ConstantTag.NUMBER:
      return { kind: "number", value: reader.f64() };
    case ConstantTag.STRING: {
      const id = reader.varint();
      if (id === 0) {
        return { kind: "string", value: "", stringId: 0 };
      }
      const value = strings[id - 1];
      if (value === undefined) {
        throw new BytecodeError("string-ref", `constant string id ${id} is out of range`, reader.offset);
      }
      return { kind: "string", value, stringId: id };
    }
    case ConstantTag.IMPORT: {
      const importId = reader.u32();
      const count = importId >>> 30;
      // Import components are indices into *earlier string constants*.
      // Never invent kNNN names for malformed imports: those identifiers
      // silently change the meaning of the reconstructed Luau program.
      if (count === 0) {
        throw new BytecodeError("import-ref", "import constant has no path components", reader.offset);
      }
      const indices = [(importId >>> 20) & 1023, (importId >>> 10) & 1023, importId & 1023];
      for (let i = 0; i < count; i++) {
        const index = indices[i]!;
        if (prior[index]?.kind !== "string") {
          throw new BytecodeError(
            "import-ref",
            `import component ${i} references missing or non-string constant ${index}`,
            reader.offset,
          );
        }
      }
      return { kind: "import", id: importId, path: decodeImportPath(importId, collectIndexedStrings(prior)) };
    }
    case ConstantTag.TABLE: {
      const keyCount = reader.varint();
      const keys: number[] = [];
      for (let i = 0; i < keyCount; i++) {
        keys.push(reader.varint());
      }
      return { kind: "table", keys };
    }
    case ConstantTag.TABLE_WITH_CONSTANTS: {
      const keyCount = reader.varint();
      const entries: Array<{ key: number; value: number }> = [];
      for (let i = 0; i < keyCount; i++) {
        entries.push({ key: reader.varint(), value: reader.i32() });
      }
      return { kind: "tableWithConstants", entries };
    }
    case ConstantTag.CLOSURE:
      return { kind: "closure", protoId: reader.varint() };
    case ConstantTag.VECTOR:
      return {
        kind: "vector",
        x: reader.f32(),
        y: reader.f32(),
        z: reader.f32(),
        w: reader.f32(),
        precise: false,
      };
    case ConstantTag.VECTORD:
      return {
        kind: "vector",
        x: reader.f64(),
        y: reader.f64(),
        z: reader.f64(),
        w: reader.f64(),
        precise: true,
      };
    case ConstantTag.INTEGER: {
      const negative = reader.u8() !== 0;
      const magnitude = reader.varint64();
      const value = negative ? -magnitude : magnitude;
      return { kind: "integer", value };
    }
    case ConstantTag.CLASS_SHAPE: {
      const classNameId = reader.varint();
      const numProperties = reader.varint();
      const numMethods = reader.varint();
      const members: number[] = [];
      for (let i = 0; i < numProperties + numMethods; i++) {
        members.push(reader.varint());
      }
      return { kind: "classShape", classNameId, members };
    }
    default:
      throw new BytecodeError("constant", `unknown constant tag ${tag}`, reader.offset);
  }
}

function collectIndexedStrings(constants: LuauConstant[]): string[] {
  return constants.map((constant) => (constant.kind === "string" ? constant.value : ""));
}

const ROBLOX_OPCODE_DECODE_MULTIPLIER = 203;

function normalizeInstructionStream(
  code: Uint32Array,
  protoId: number,
  encoding: OpcodeEncodingState,
): Uint32Array {
  if (encoding.value === "official") {
    validateInstructionStream(code, protoId);
    return code;
  }
  if (encoding.value === "roblox") {
    return normalizeRobloxOpcodes(code, protoId);
  }

  try {
    validateInstructionStream(code, protoId);
    encoding.value = "official";
    return code;
  } catch (officialError) {
    try {
      const normalized = normalizeRobloxOpcodes(code, protoId);
      encoding.value = "roblox";
      return normalized;
    } catch {
      throw officialError;
    }
  }
}

function normalizeRobloxOpcodes(code: Uint32Array, protoId: number): Uint32Array {
  const normalized = code.slice();
  let pc = 0;
  while (pc < normalized.length) {
    const word = normalized[pc]!;
    const encodedOpcode = word & 0xff;
    const opcode = (encodedOpcode * ROBLOX_OPCODE_DECODE_MULTIPLIER) & 0xff;
    const descriptor = opcodeDescriptor(opcode);
    if (!descriptor) {
      throw new BytecodeError(
        "opcode",
        `unknown Roblox-encoded opcode ${encodedOpcode} in prototype ${protoId} at pc ${pc}`,
      );
    }
    normalized[pc] = (word & 0xffffff00) | opcode;
    const width = instructionWidth(opcode);
    if (pc + width > normalized.length) {
      throw new BytecodeError(
        "aux",
        `opcode ${descriptor.name} in prototype ${protoId} at pc ${pc} is missing its AUX word`,
      );
    }
    pc += width;
  }
  validateInstructionStream(normalized, protoId);
  return normalized;
}

function validateInstructionStream(code: Uint32Array, protoId: number): void {
  let pc = 0;
  while (pc < code.length) {
    const opcode = code[pc]! & 0xff;
    const descriptor = opcodeDescriptor(opcode);
    if (!descriptor) {
      throw new BytecodeError("opcode", `unknown opcode ${opcode} in prototype ${protoId} at pc ${pc}`);
    }
    const width = instructionWidth(opcode);
    if (pc + width > code.length) {
      throw new BytecodeError(
        "aux",
        `opcode ${descriptor.name} in prototype ${protoId} at pc ${pc} is missing its AUX word`,
      );
    }
    if (opcode === Opcode.NEWCLOSURE) {
      const captures = countFollowingCaptures(code, pc + width);
      if (pc + width + captures > code.length) {
        throw new BytecodeError("capture", `NEWCLOSURE in prototype ${protoId} at pc ${pc} is truncated`);
      }
    }
    pc += width;
  }
}

function countFollowingCaptures(code: Uint32Array, start: number): number {
  let count = 0;
  let pc = start;
  while (pc < code.length && (code[pc]! & 0xff) === Opcode.CAPTURE) {
    count += 1;
    pc += 1;
  }
  return count;
}

function validateReferences(prototypes: Prototype[], _strings: string[], profile: BytecodeProfile): void {
  for (const proto of prototypes) {
    // DUPTABLE templates contain indices of string constants. The
    // reconstruction layer previously skipped missing or non-string keys,
    // silently dropping table fields from the recovered source.
    for (let templateIndex = 0; templateIndex < proto.constants.length; templateIndex++) {
      const template = proto.constants[templateIndex]!;
      if (template.kind !== "table" && template.kind !== "tableWithConstants") {
        continue;
      }
      const keys = template.kind === "table"
        ? template.keys
        : template.entries.map((entry) => entry.key);
      for (const keyIndex of keys) {
        if (keyIndex < 0 || keyIndex >= proto.constants.length) {
          throw new BytecodeError(
            "constant-ref",
            `prototype ${proto.id} table constant ${templateIndex} references missing key constant ${keyIndex}`,
          );
        }
        if (proto.constants[keyIndex]?.kind !== "string") {
          throw new BytecodeError(
            "constant-kind",
            `prototype ${proto.id} table constant ${templateIndex} requires a string key at constant ${keyIndex}`,
          );
        }
      }
    }
    // Instructions carrying AUX consume two words; the second word is data,
    // not a valid jump destination. Preserve real instruction boundaries for
    // both ordinary branches and optimized FASTCALL skip targets.
    const instructionStarts = new Set(proto.instructions.map((insn) => insn.pc));
    // The Luau closure constructors (NEWCLOSURE and DUPCLOSURE) may
    // each be followed by a capture list. Recover the child from either
    // the prototype table or the DUPCLOSURE constant before checking arity.
    const ownedCaptures = new Set<number>();
    for (let index = 0; index < proto.instructions.length; index++) {
      const insn = proto.instructions[index]!;
      if (insn.opcode !== Opcode.NEWCLOSURE && insn.opcode !== Opcode.DUPCLOSURE) {
        continue;
      }
      const childId = insn.opcode === Opcode.NEWCLOSURE
        ? proto.childProtoIds[insn.d]
        : (proto.constants[insn.d]?.kind === "closure"
          ? (proto.constants[insn.d] as Extract<LuauConstant, { kind: "closure" }>).protoId
          : undefined);
      const child = childId === undefined ? undefined : prototypes[childId];
      if (!child) {
        // Reference validation is independent of the capture sequence.
        continue;
      }
      for (let captureIndex = 0; captureIndex < child.numUpvalues; captureIndex++) {
        const capture = proto.instructions[index + captureIndex + 1];
        if (!capture || capture.opcode !== Opcode.CAPTURE) {
          throw new BytecodeError(
            "capture",
            `${insn.mnemonic} in prototype ${proto.id} at pc ${insn.pc} requires ${child.numUpvalues} CAPTURE instruction(s)`,
          );
        }
        ownedCaptures.add(capture.pc);
      }
    }
    for (const child of proto.childProtoIds) {
      if (child >= prototypes.length) {
        throw new BytecodeError("proto-ref", `prototype ${proto.id} references missing child ${child}`);
      }
    }
    for (const insn of proto.instructions) {
      if (insn.opcode === Opcode.CAPTURE) {
        if (!ownedCaptures.has(insn.pc)) {
          throw new BytecodeError(
            "capture",
            `orphan CAPTURE instruction in prototype ${proto.id} at pc ${insn.pc}`,
          );
        }
        const type = insn.capture?.type;
        const source = insn.capture?.source ?? -1;
        if (type !== 0 && type !== 1 && type !== 2) {
          throw new BytecodeError("capture", `invalid CAPTURE kind ${type} in prototype ${proto.id} at pc ${insn.pc}`);
        }
        const limit = type === 2 ? proto.numUpvalues : proto.maxStackSize;
        if (source < 0 || source >= limit) {
          throw new BytecodeError(
            "capture",
            `CAPTURE in prototype ${proto.id} at pc ${insn.pc} references ${type === 2 ? "upvalue" : "register"} ${source} outside limit ${limit}`,
          );
        }
      }
      if (!profile.allowsOpcode(insn.opcode)) {
        throw new BytecodeError(
          "opcode-version",
          `opcode ${insn.mnemonic} in prototype ${proto.id} at pc ${insn.pc} is not valid for bytecode version ${profile.version}`,
        );
      }
      if (insn.jumpTarget !== undefined) {
        const target = insn.jumpTarget;
        if (target < 0 || target > proto.code.length) {
          throw new BytecodeError("jump", `prototype ${proto.id} pc ${insn.pc} jumps outside the function`);
        }
        if (target !== proto.code.length && !instructionStarts.has(target)) {
          throw new BytecodeError(
            "jump-boundary",
            `prototype ${proto.id} pc ${insn.pc} jumps to pc ${target} inside an instruction's AUX word`,
          );
        }
      }
      if (insn.protoIndex !== undefined && insn.opcode === Opcode.NEWCLOSURE) {
        if (insn.protoIndex < 0 || insn.protoIndex >= proto.childProtoIds.length) {
          throw new BytecodeError("proto-ref", `prototype ${proto.id} pc ${insn.pc} child index is invalid`);
        }
      }
      // These opcodes directly consume an entry in the constant pool. Without
      // validation, missing entries become literal nil during reconstruction,
      // which silently changes the original program's meaning.
      if (hasDirectConstantOperand(insn.opcode)) {
        const index = insn.constantIndex;
        if (index === undefined || index < 0 || index >= proto.constants.length) {
          throw new BytecodeError(
            "constant-ref",
            `prototype ${proto.id} pc ${insn.pc} ${insn.mnemonic} references missing constant ${index}`,
          );
        }
        const constant = proto.constants[index]!;
        if (insn.opcode === Opcode.GETIMPORT && constant.kind !== "import") {
          throw new BytecodeError(
            "constant-kind",
            `prototype ${proto.id} pc ${insn.pc} GETIMPORT requires an import constant, got ${constant.kind}`,
          );
        }
        if (insn.opcode === Opcode.JUMPXEQKN && constant.kind !== "number") {
          throw new BytecodeError(
            "constant-kind",
            `prototype ${proto.id} pc ${insn.pc} JUMPXEQKN requires a number constant, got ${constant.kind}`,
          );
        }
        if (hasStringKeyOperand(insn.opcode) && constant.kind !== "string") {
          throw new BytecodeError(
            "constant-kind",
            `prototype ${proto.id} pc ${insn.pc} ${insn.mnemonic} requires a string constant, got ${constant.kind}`,
          );
        }
        if (
          insn.opcode === Opcode.DUPTABLE &&
          constant.kind !== "table" &&
          constant.kind !== "tableWithConstants"
        ) {
          throw new BytecodeError(
            "constant-kind",
            `prototype ${proto.id} pc ${insn.pc} DUPTABLE requires a table constant, got ${constant.kind}`,
          );
        }
        if (insn.opcode === Opcode.DUPCLOSURE) {
          if (constant.kind !== "closure") {
            throw new BytecodeError(
              "constant-kind",
              `prototype ${proto.id} pc ${insn.pc} DUPCLOSURE expected a closure constant`,
            );
          }
          if (constant.protoId >= prototypes.length) {
            throw new BytecodeError(
              "proto-ref",
              `prototype ${proto.id} pc ${insn.pc} DUPCLOSURE references missing prototype ${constant.protoId}`,
            );
          }
        }
      }
    }
  }
}

// Check only operands that are actual constant-pool indices, not feedback
// slots, builtin function identifiers, or version-dependent AUX metadata.
function hasDirectConstantOperand(opcode: Opcode): boolean {
  switch (opcode) {
    case Opcode.LOADK:
    case Opcode.LOADKX:
    case Opcode.GETGLOBAL:
    case Opcode.SETGLOBAL:
    case Opcode.GETIMPORT:
    case Opcode.GETTABLEKS:
    case Opcode.SETTABLEKS:
    case Opcode.NAMECALL:
    case Opcode.GETUDATAKS:
    case Opcode.SETUDATAKS:
    case Opcode.NAMECALLUDATA:
    case Opcode.DUPTABLE:
    case Opcode.DUPCLOSURE:
    case Opcode.ADDK:
    case Opcode.SUBK:
    case Opcode.MULK:
    case Opcode.DIVK:
    case Opcode.MODK:
    case Opcode.POWK:
    case Opcode.IDIVK:
    case Opcode.ANDK:
    case Opcode.ORK:
    case Opcode.SUBRK:
    case Opcode.DIVRK:
    case Opcode.JUMPXEQKN:
    case Opcode.JUMPXEQKS:
      return true;
    default:
      return false;
  }
}

function hasStringKeyOperand(opcode: Opcode): boolean {
  switch (opcode) {
    case Opcode.GETGLOBAL:
    case Opcode.SETGLOBAL:
    case Opcode.GETTABLEKS:
    case Opcode.SETTABLEKS:
    case Opcode.NAMECALL:
    case Opcode.GETUDATAKS:
    case Opcode.SETUDATAKS:
    case Opcode.NAMECALLUDATA:
    case Opcode.JUMPXEQKS:
      return true;
    default:
      return false;
  }
}
