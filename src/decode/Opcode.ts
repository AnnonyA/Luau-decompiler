export enum Opcode {
  NOP = 0,
  BREAK = 1,
  LOADNIL = 2,
  LOADB = 3,
  LOADN = 4,
  LOADK = 5,
  MOVE = 6,
  GETGLOBAL = 7,
  SETGLOBAL = 8,
  GETUPVAL = 9,
  SETUPVAL = 10,
  CLOSEUPVALS = 11,
  GETIMPORT = 12,
  GETTABLE = 13,
  SETTABLE = 14,
  GETTABLEKS = 15,
  SETTABLEKS = 16,
  GETTABLEN = 17,
  SETTABLEN = 18,
  NEWCLOSURE = 19,
  NAMECALL = 20,
  CALL = 21,
  RETURN = 22,
  JUMP = 23,
  JUMPBACK = 24,
  JUMPIF = 25,
  JUMPIFNOT = 26,
  JUMPIFEQ = 27,
  JUMPIFLE = 28,
  JUMPIFLT = 29,
  JUMPIFNOTEQ = 30,
  JUMPIFNOTLE = 31,
  JUMPIFNOTLT = 32,
  ADD = 33,
  SUB = 34,
  MUL = 35,
  DIV = 36,
  MOD = 37,
  POW = 38,
  ADDK = 39,
  SUBK = 40,
  MULK = 41,
  DIVK = 42,
  MODK = 43,
  POWK = 44,
  AND = 45,
  OR = 46,
  ANDK = 47,
  ORK = 48,
  CONCAT = 49,
  NOT = 50,
  MINUS = 51,
  LENGTH = 52,
  NEWTABLE = 53,
  DUPTABLE = 54,
  SETLIST = 55,
  FORNPREP = 56,
  FORNLOOP = 57,
  FORGLOOP = 58,
  FORGPREP_INEXT = 59,
  FASTCALL3 = 60,
  FORGPREP_NEXT = 61,
  NATIVECALL = 62,
  GETVARARGS = 63,
  DUPCLOSURE = 64,
  PREPVARARGS = 65,
  LOADKX = 66,
  JUMPX = 67,
  FASTCALL = 68,
  COVERAGE = 69,
  CAPTURE = 70,
  SUBRK = 71,
  DIVRK = 72,
  FASTCALL1 = 73,
  FASTCALL2 = 74,
  FASTCALL2K = 75,
  FORGPREP = 76,
  JUMPXEQKNIL = 77,
  JUMPXEQKB = 78,
  JUMPXEQKN = 79,
  JUMPXEQKS = 80,
  IDIV = 81,
  IDIVK = 82,
  GETUDATAKS = 83,
  SETUDATAKS = 84,
  NAMECALLUDATA = 85,
  NEWCLASSMEMBER = 86,
  CALLFB = 87,
  CMPPROTO = 88,
  NEWCLASS = 89,
}

export const OPCODE_COUNT = 90;

export enum InstructionFormat {
  ABC = "ABC",
  AD = "AD",
  E = "E",
}

export enum CaptureType {
  VAL = 0,
  REF = 1,
  UPVAL = 2,
}

export enum BuiltinFunction {
  NONE = 0,
  ASSERT = 1,
  MATH_ABS = 2,
  MATH_ACOS = 3,
  MATH_ASIN = 4,
  MATH_ATAN2 = 5,
  MATH_ATAN = 6,
  MATH_CEIL = 7,
  MATH_COSH = 8,
  MATH_COS = 9,
  MATH_DEG = 10,
  MATH_EXP = 11,
  MATH_FLOOR = 12,
  MATH_FMOD = 13,
  MATH_FREXP = 14,
  MATH_LDEXP = 15,
  MATH_LOG10 = 16,
  MATH_LOG = 17,
  MATH_MAX = 18,
  MATH_MIN = 19,
  MATH_MODF = 20,
  MATH_POW = 21,
  MATH_RAD = 22,
  MATH_SINH = 23,
  MATH_SIN = 24,
  MATH_SQRT = 25,
  MATH_TANH = 26,
  MATH_TAN = 27,
  BIT32_ARSHIFT = 28,
  BIT32_BAND = 29,
  BIT32_BNOT = 30,
  BIT32_BOR = 31,
  BIT32_BXOR = 32,
  BIT32_BTEST = 33,
  BIT32_EXTRACT = 34,
  BIT32_LROTATE = 35,
  BIT32_LSHIFT = 36,
  BIT32_REPLACE = 37,
  BIT32_RROTATE = 38,
  BIT32_RSHIFT = 39,
  TYPE = 40,
  STRING_BYTE = 41,
  STRING_CHAR = 42,
  STRING_LEN = 43,
  TYPEOF = 44,
  STRING_SUB = 45,
  MATH_CLAMP = 46,
  MATH_SIGN = 47,
  MATH_ROUND = 48,
  RAWSET = 49,
  RAWGET = 50,
  RAWEQUAL = 51,
  TABLE_INSERT = 52,
  TABLE_UNPACK = 53,
  VECTOR = 54,
  BIT32_COUNTLZ = 55,
  BIT32_COUNTRZ = 56,
  SELECT_VARARG = 57,
  RAWLEN = 58,
  BIT32_EXTRACTK = 59,
  GETMETATABLE = 60,
  SETMETATABLE = 61,
  TONUMBER = 62,
  TOSTRING = 63,
  BIT32_BYTESWAP = 64,
  BUFFER_READI8 = 65,
  BUFFER_READU8 = 66,
  BUFFER_WRITEU8 = 67,
  BUFFER_READI16 = 68,
  BUFFER_READU16 = 69,
  BUFFER_WRITEU16 = 70,
  BUFFER_READI32 = 71,
  BUFFER_READU32 = 72,
  BUFFER_WRITEU32 = 73,
  BUFFER_READF32 = 74,
  BUFFER_WRITEF32 = 75,
  BUFFER_READF64 = 76,
  BUFFER_WRITEF64 = 77,
  VECTOR_MAGNITUDE = 78,
  VECTOR_NORMALIZE = 79,
  VECTOR_CROSS = 80,
  VECTOR_DOT = 81,
  VECTOR_FLOOR = 82,
  VECTOR_CEIL = 83,
  VECTOR_ABS = 84,
  VECTOR_SIGN = 85,
  VECTOR_CLAMP = 86,
  VECTOR_MIN = 87,
  VECTOR_MAX = 88,
  MATH_LERP = 89,
  VECTOR_LERP = 90,
  MATH_ISNAN = 91,
  MATH_ISINF = 92,
  MATH_ISFINITE = 93,
}

export enum ConstantTag {
  NIL = 0,
  BOOLEAN = 1,
  NUMBER = 2,
  STRING = 3,
  IMPORT = 4,
  TABLE = 5,
  CLOSURE = 6,
  VECTOR = 7,
  TABLE_WITH_CONSTANTS = 8,
  INTEGER = 9,
  CLASS_SHAPE = 10,
  VECTORD = 11,
}

export enum ProtoFlag {
  NATIVE_MODULE = 1 << 0,
  NATIVE_COLD = 1 << 1,
  NATIVE_FUNCTION = 1 << 2,
  INLINABLE = 1 << 3,
  USES_EXPORT = 1 << 4,
}

export type SupportStatus = "verified" | "experimental" | "decoder-only" | "unsupported";

export interface OpcodeDescriptor {
  opcode: Opcode;
  name: string;
  format: InstructionFormat;
  hasAux: boolean;
  introducedIn: number;
  status: SupportStatus;
}

const AUX = true;
const NO_AUX = false;

function d(
  opcode: Opcode,
  name: string,
  format: InstructionFormat,
  hasAux: boolean,
  introducedIn: number,
  status: SupportStatus = "verified",
): OpcodeDescriptor {
  return { opcode, name, format, hasAux, introducedIn, status };
}

export const OPCODE_TABLE: readonly OpcodeDescriptor[] = [
  d(Opcode.NOP, "NOP", InstructionFormat.ABC, NO_AUX, 1),
  d(Opcode.BREAK, "BREAK", InstructionFormat.ABC, NO_AUX, 1),
  d(Opcode.LOADNIL, "LOADNIL", InstructionFormat.ABC, NO_AUX, 1),
  d(Opcode.LOADB, "LOADB", InstructionFormat.ABC, NO_AUX, 1),
  d(Opcode.LOADN, "LOADN", InstructionFormat.AD, NO_AUX, 1),
  d(Opcode.LOADK, "LOADK", InstructionFormat.AD, NO_AUX, 1),
  d(Opcode.MOVE, "MOVE", InstructionFormat.ABC, NO_AUX, 1),
  d(Opcode.GETGLOBAL, "GETGLOBAL", InstructionFormat.ABC, AUX, 1),
  d(Opcode.SETGLOBAL, "SETGLOBAL", InstructionFormat.ABC, AUX, 1),
  d(Opcode.GETUPVAL, "GETUPVAL", InstructionFormat.ABC, NO_AUX, 1),
  d(Opcode.SETUPVAL, "SETUPVAL", InstructionFormat.ABC, NO_AUX, 1),
  d(Opcode.CLOSEUPVALS, "CLOSEUPVALS", InstructionFormat.ABC, NO_AUX, 1),
  d(Opcode.GETIMPORT, "GETIMPORT", InstructionFormat.AD, AUX, 1),
  d(Opcode.GETTABLE, "GETTABLE", InstructionFormat.ABC, NO_AUX, 1),
  d(Opcode.SETTABLE, "SETTABLE", InstructionFormat.ABC, NO_AUX, 1),
  d(Opcode.GETTABLEKS, "GETTABLEKS", InstructionFormat.ABC, AUX, 1),
  d(Opcode.SETTABLEKS, "SETTABLEKS", InstructionFormat.ABC, AUX, 1),
  d(Opcode.GETTABLEN, "GETTABLEN", InstructionFormat.ABC, NO_AUX, 1),
  d(Opcode.SETTABLEN, "SETTABLEN", InstructionFormat.ABC, NO_AUX, 1),
  d(Opcode.NEWCLOSURE, "NEWCLOSURE", InstructionFormat.AD, NO_AUX, 1),
  d(Opcode.NAMECALL, "NAMECALL", InstructionFormat.ABC, AUX, 1),
  d(Opcode.CALL, "CALL", InstructionFormat.ABC, NO_AUX, 1),
  d(Opcode.RETURN, "RETURN", InstructionFormat.ABC, NO_AUX, 1),
  d(Opcode.JUMP, "JUMP", InstructionFormat.AD, NO_AUX, 1),
  d(Opcode.JUMPBACK, "JUMPBACK", InstructionFormat.AD, NO_AUX, 1),
  d(Opcode.JUMPIF, "JUMPIF", InstructionFormat.AD, NO_AUX, 1),
  d(Opcode.JUMPIFNOT, "JUMPIFNOT", InstructionFormat.AD, NO_AUX, 1),
  d(Opcode.JUMPIFEQ, "JUMPIFEQ", InstructionFormat.AD, AUX, 1),
  d(Opcode.JUMPIFLE, "JUMPIFLE", InstructionFormat.AD, AUX, 1),
  d(Opcode.JUMPIFLT, "JUMPIFLT", InstructionFormat.AD, AUX, 1),
  d(Opcode.JUMPIFNOTEQ, "JUMPIFNOTEQ", InstructionFormat.AD, AUX, 1),
  d(Opcode.JUMPIFNOTLE, "JUMPIFNOTLE", InstructionFormat.AD, AUX, 1),
  d(Opcode.JUMPIFNOTLT, "JUMPIFNOTLT", InstructionFormat.AD, AUX, 1),
  d(Opcode.ADD, "ADD", InstructionFormat.ABC, NO_AUX, 1),
  d(Opcode.SUB, "SUB", InstructionFormat.ABC, NO_AUX, 1),
  d(Opcode.MUL, "MUL", InstructionFormat.ABC, NO_AUX, 1),
  d(Opcode.DIV, "DIV", InstructionFormat.ABC, NO_AUX, 1),
  d(Opcode.MOD, "MOD", InstructionFormat.ABC, NO_AUX, 1),
  d(Opcode.POW, "POW", InstructionFormat.ABC, NO_AUX, 1),
  d(Opcode.ADDK, "ADDK", InstructionFormat.ABC, NO_AUX, 1),
  d(Opcode.SUBK, "SUBK", InstructionFormat.ABC, NO_AUX, 1),
  d(Opcode.MULK, "MULK", InstructionFormat.ABC, NO_AUX, 1),
  d(Opcode.DIVK, "DIVK", InstructionFormat.ABC, NO_AUX, 1),
  d(Opcode.MODK, "MODK", InstructionFormat.ABC, NO_AUX, 1),
  d(Opcode.POWK, "POWK", InstructionFormat.ABC, NO_AUX, 1),
  d(Opcode.AND, "AND", InstructionFormat.ABC, NO_AUX, 1),
  d(Opcode.OR, "OR", InstructionFormat.ABC, NO_AUX, 1),
  d(Opcode.ANDK, "ANDK", InstructionFormat.ABC, NO_AUX, 1),
  d(Opcode.ORK, "ORK", InstructionFormat.ABC, NO_AUX, 1),
  d(Opcode.CONCAT, "CONCAT", InstructionFormat.ABC, NO_AUX, 1),
  d(Opcode.NOT, "NOT", InstructionFormat.ABC, NO_AUX, 1),
  d(Opcode.MINUS, "MINUS", InstructionFormat.ABC, NO_AUX, 1),
  d(Opcode.LENGTH, "LENGTH", InstructionFormat.ABC, NO_AUX, 1),
  d(Opcode.NEWTABLE, "NEWTABLE", InstructionFormat.ABC, AUX, 1),
  d(Opcode.DUPTABLE, "DUPTABLE", InstructionFormat.AD, NO_AUX, 1),
  d(Opcode.SETLIST, "SETLIST", InstructionFormat.ABC, AUX, 1),
  d(Opcode.FORNPREP, "FORNPREP", InstructionFormat.AD, NO_AUX, 1),
  d(Opcode.FORNLOOP, "FORNLOOP", InstructionFormat.AD, NO_AUX, 1),
  d(Opcode.FORGLOOP, "FORGLOOP", InstructionFormat.AD, AUX, 3),
  d(Opcode.FORGPREP_INEXT, "FORGPREP_INEXT", InstructionFormat.AD, NO_AUX, 1),
  d(Opcode.FASTCALL3, "FASTCALL3", InstructionFormat.ABC, AUX, 6),
  d(Opcode.FORGPREP_NEXT, "FORGPREP_NEXT", InstructionFormat.AD, NO_AUX, 1),
  d(Opcode.NATIVECALL, "NATIVECALL", InstructionFormat.ABC, NO_AUX, 1, "decoder-only"),
  d(Opcode.GETVARARGS, "GETVARARGS", InstructionFormat.ABC, NO_AUX, 1),
  d(Opcode.DUPCLOSURE, "DUPCLOSURE", InstructionFormat.AD, NO_AUX, 1),
  d(Opcode.PREPVARARGS, "PREPVARARGS", InstructionFormat.ABC, NO_AUX, 1),
  d(Opcode.LOADKX, "LOADKX", InstructionFormat.ABC, AUX, 1),
  d(Opcode.JUMPX, "JUMPX", InstructionFormat.E, NO_AUX, 1),
  d(Opcode.FASTCALL, "FASTCALL", InstructionFormat.ABC, NO_AUX, 1),
  d(Opcode.COVERAGE, "COVERAGE", InstructionFormat.E, NO_AUX, 1),
  d(Opcode.CAPTURE, "CAPTURE", InstructionFormat.ABC, NO_AUX, 1),
  d(Opcode.SUBRK, "SUBRK", InstructionFormat.ABC, NO_AUX, 5),
  d(Opcode.DIVRK, "DIVRK", InstructionFormat.ABC, NO_AUX, 5),
  d(Opcode.FASTCALL1, "FASTCALL1", InstructionFormat.ABC, NO_AUX, 1),
  d(Opcode.FASTCALL2, "FASTCALL2", InstructionFormat.ABC, AUX, 1),
  d(Opcode.FASTCALL2K, "FASTCALL2K", InstructionFormat.ABC, AUX, 1),
  d(Opcode.FORGPREP, "FORGPREP", InstructionFormat.AD, NO_AUX, 3),
  d(Opcode.JUMPXEQKNIL, "JUMPXEQKNIL", InstructionFormat.AD, AUX, 3),
  d(Opcode.JUMPXEQKB, "JUMPXEQKB", InstructionFormat.AD, AUX, 3),
  d(Opcode.JUMPXEQKN, "JUMPXEQKN", InstructionFormat.AD, AUX, 3),
  d(Opcode.JUMPXEQKS, "JUMPXEQKS", InstructionFormat.AD, AUX, 3),
  d(Opcode.IDIV, "IDIV", InstructionFormat.ABC, NO_AUX, 4),
  d(Opcode.IDIVK, "IDIVK", InstructionFormat.ABC, NO_AUX, 4),
  d(Opcode.GETUDATAKS, "GETUDATAKS", InstructionFormat.ABC, AUX, 9),
  d(Opcode.SETUDATAKS, "SETUDATAKS", InstructionFormat.ABC, AUX, 9),
  d(Opcode.NAMECALLUDATA, "NAMECALLUDATA", InstructionFormat.ABC, AUX, 9),
  d(Opcode.NEWCLASSMEMBER, "NEWCLASSMEMBER", InstructionFormat.ABC, AUX, 10, "experimental"),
  d(Opcode.CALLFB, "CALLFB", InstructionFormat.ABC, AUX, 11, "experimental"),
  d(Opcode.CMPPROTO, "CMPPROTO", InstructionFormat.AD, AUX, 11, "experimental"),
  d(Opcode.NEWCLASS, "NEWCLASS", InstructionFormat.ABC, AUX, 100, "experimental"),
];

const BY_OPCODE = new Map<number, OpcodeDescriptor>(OPCODE_TABLE.map((entry) => [entry.opcode, entry]));

export function opcodeDescriptor(opcode: number): OpcodeDescriptor | undefined {
  return BY_OPCODE.get(opcode);
}

export function opcodeName(opcode: number): string {
  return BY_OPCODE.get(opcode)?.name ?? `OP_${opcode}`;
}

export function instructionWidth(opcode: number): number {
  return BY_OPCODE.get(opcode)?.hasAux ? 2 : 1;
}

export function isJumpD(opcode: Opcode): boolean {
  switch (opcode) {
    case Opcode.JUMP:
    case Opcode.JUMPIF:
    case Opcode.JUMPIFNOT:
    case Opcode.JUMPIFEQ:
    case Opcode.JUMPIFLE:
    case Opcode.JUMPIFLT:
    case Opcode.JUMPIFNOTEQ:
    case Opcode.JUMPIFNOTLE:
    case Opcode.JUMPIFNOTLT:
    case Opcode.FORNPREP:
    case Opcode.FORNLOOP:
    case Opcode.FORGPREP:
    case Opcode.FORGLOOP:
    case Opcode.FORGPREP_INEXT:
    case Opcode.FORGPREP_NEXT:
    case Opcode.JUMPBACK:
    case Opcode.JUMPXEQKNIL:
    case Opcode.JUMPXEQKB:
    case Opcode.JUMPXEQKN:
    case Opcode.JUMPXEQKS:
    case Opcode.CMPPROTO:
      return true;
    default:
      return false;
  }
}

export function isFastCall(opcode: Opcode): boolean {
  switch (opcode) {
    case Opcode.FASTCALL:
    case Opcode.FASTCALL1:
    case Opcode.FASTCALL2:
    case Opcode.FASTCALL2K:
    case Opcode.FASTCALL3:
      return true;
    default:
      return false;
  }
}

export function isFallthrough(opcode: Opcode): boolean {
  switch (opcode) {
    case Opcode.RETURN:
    case Opcode.JUMP:
    case Opcode.JUMPBACK:
    case Opcode.JUMPX:
      return false;
    default:
      return true;
  }
}

export function isLoopBackedge(opcode: Opcode): boolean {
  switch (opcode) {
    case Opcode.JUMPBACK:
    case Opcode.FORGLOOP:
    case Opcode.FORNLOOP:
      return true;
    default:
      return false;
  }
}

export function insnOp(word: number): number {
  return word & 0xff;
}

export function insnA(word: number): number {
  return (word >>> 8) & 0xff;
}

export function insnB(word: number): number {
  return (word >>> 16) & 0xff;
}

export function insnC(word: number): number {
  return (word >>> 24) & 0xff;
}

export function insnD(word: number): number {
  return (word << 0) >> 16;
}

export function insnE(word: number): number {
  return word >> 8;
}

export function encodeAbc(op: Opcode, a: number, b: number, c: number): number {
  return (op & 0xff) | ((a & 0xff) << 8) | ((b & 0xff) << 16) | ((c & 0xff) << 24);
}

export function encodeAd(op: Opcode, a: number, d: number): number {
  return (op & 0xff) | ((a & 0xff) << 8) | ((d & 0xffff) << 16);
}

export function encodeE(op: Opcode, e: number): number {
  return (op & 0xff) | ((e & 0xffffff) << 8);
}

export function jumpTarget(word: number, pc: number): number | undefined {
  const op = insnOp(word) as Opcode;
  if (isJumpD(op)) {
    return pc + insnD(word) + 1;
  }
  if (isFastCall(op)) {
    return pc + insnC(word) + 2;
  }
  if (op === Opcode.LOADB && insnC(word) !== 0) {
    return pc + insnC(word) + 1;
  }
  if (op === Opcode.JUMPX) {
    return pc + insnE(word) + 1;
  }
  return undefined;
}

export const BUILTIN_NAMES: Record<number, string> = {
  [BuiltinFunction.ASSERT]: "assert",
  [BuiltinFunction.MATH_ABS]: "math.abs",
  [BuiltinFunction.MATH_ACOS]: "math.acos",
  [BuiltinFunction.MATH_ASIN]: "math.asin",
  [BuiltinFunction.MATH_ATAN2]: "math.atan2",
  [BuiltinFunction.MATH_ATAN]: "math.atan",
  [BuiltinFunction.MATH_CEIL]: "math.ceil",
  [BuiltinFunction.MATH_COSH]: "math.cosh",
  [BuiltinFunction.MATH_COS]: "math.cos",
  [BuiltinFunction.MATH_DEG]: "math.deg",
  [BuiltinFunction.MATH_EXP]: "math.exp",
  [BuiltinFunction.MATH_FLOOR]: "math.floor",
  [BuiltinFunction.MATH_FMOD]: "math.fmod",
  [BuiltinFunction.MATH_FREXP]: "math.frexp",
  [BuiltinFunction.MATH_LDEXP]: "math.ldexp",
  [BuiltinFunction.MATH_LOG10]: "math.log10",
  [BuiltinFunction.MATH_LOG]: "math.log",
  [BuiltinFunction.MATH_MAX]: "math.max",
  [BuiltinFunction.MATH_MIN]: "math.min",
  [BuiltinFunction.MATH_MODF]: "math.modf",
  [BuiltinFunction.MATH_POW]: "math.pow",
  [BuiltinFunction.MATH_RAD]: "math.rad",
  [BuiltinFunction.MATH_SINH]: "math.sinh",
  [BuiltinFunction.MATH_SIN]: "math.sin",
  [BuiltinFunction.MATH_SQRT]: "math.sqrt",
  [BuiltinFunction.MATH_TANH]: "math.tanh",
  [BuiltinFunction.MATH_TAN]: "math.tan",
  [BuiltinFunction.BIT32_ARSHIFT]: "bit32.arshift",
  [BuiltinFunction.BIT32_BAND]: "bit32.band",
  [BuiltinFunction.BIT32_BNOT]: "bit32.bnot",
  [BuiltinFunction.BIT32_BOR]: "bit32.bor",
  [BuiltinFunction.BIT32_BXOR]: "bit32.bxor",
  [BuiltinFunction.BIT32_BTEST]: "bit32.btest",
  [BuiltinFunction.BIT32_EXTRACT]: "bit32.extract",
  [BuiltinFunction.BIT32_LROTATE]: "bit32.lrotate",
  [BuiltinFunction.BIT32_LSHIFT]: "bit32.lshift",
  [BuiltinFunction.BIT32_REPLACE]: "bit32.replace",
  [BuiltinFunction.BIT32_RROTATE]: "bit32.rrotate",
  [BuiltinFunction.BIT32_RSHIFT]: "bit32.rshift",
  [BuiltinFunction.TYPE]: "type",
  [BuiltinFunction.STRING_BYTE]: "string.byte",
  [BuiltinFunction.STRING_CHAR]: "string.char",
  [BuiltinFunction.STRING_LEN]: "string.len",
  [BuiltinFunction.TYPEOF]: "typeof",
  [BuiltinFunction.STRING_SUB]: "string.sub",
  [BuiltinFunction.MATH_CLAMP]: "math.clamp",
  [BuiltinFunction.MATH_SIGN]: "math.sign",
  [BuiltinFunction.MATH_ROUND]: "math.round",
  [BuiltinFunction.RAWSET]: "rawset",
  [BuiltinFunction.RAWGET]: "rawget",
  [BuiltinFunction.RAWEQUAL]: "rawequal",
  [BuiltinFunction.TABLE_INSERT]: "table.insert",
  [BuiltinFunction.TABLE_UNPACK]: "table.unpack",
  [BuiltinFunction.VECTOR]: "vector",
  [BuiltinFunction.BIT32_COUNTLZ]: "bit32.countlz",
  [BuiltinFunction.BIT32_COUNTRZ]: "bit32.countrz",
  [BuiltinFunction.SELECT_VARARG]: "select",
  [BuiltinFunction.RAWLEN]: "rawlen",
  [BuiltinFunction.BIT32_EXTRACTK]: "bit32.extract",
  [BuiltinFunction.GETMETATABLE]: "getmetatable",
  [BuiltinFunction.SETMETATABLE]: "setmetatable",
  [BuiltinFunction.TONUMBER]: "tonumber",
  [BuiltinFunction.TOSTRING]: "tostring",
  [BuiltinFunction.BIT32_BYTESWAP]: "bit32.byteswap",
  [BuiltinFunction.MATH_LERP]: "math.lerp",
  [BuiltinFunction.MATH_ISNAN]: "math.isnan",
  [BuiltinFunction.MATH_ISINF]: "math.isinf",
  [BuiltinFunction.MATH_ISFINITE]: "math.isfinite",
};
