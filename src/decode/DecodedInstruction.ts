import {
  CaptureType,
  InstructionFormat,
  Opcode,
  insnA,
  insnB,
  insnC,
  insnD,
  insnE,
  instructionWidth,
  isFastCall,
  jumpTarget,
  opcodeDescriptor,
  opcodeName,
} from "./Opcode.js";

export interface RegisterUse {
  register: number;
  role: "use" | "def" | "use-def";
}

export interface CallOperands {
  functionRegister: number;
  argumentBase: number;
  argumentCount: number | "multret";
  resultCount: number | "multret";
}

export interface CaptureInfo {
  type: CaptureType;
  source: number;
}

export interface DecodedInstruction {
  pc: number;
  rawWord: number;
  width: number;
  opcode: Opcode;
  mnemonic: string;
  format: InstructionFormat;
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  aux?: number;
  defs: number[];
  uses: number[];
  jumpTarget?: number;
  constantIndex?: number;
  protoIndex?: number;
  call?: CallOperands;
  capture?: CaptureInfo;
  builtinId?: number;
}

export function decodeInstructionWord(
  words: Uint32Array,
  pc: number,
  constantCount: number,
): DecodedInstruction {
  if (pc < 0 || pc >= words.length) {
    throw new Error(`instruction pc ${pc} is outside the code stream`);
  }
  const rawWord = words[pc]!;
  const opcode = (rawWord & 0xff) as Opcode;
  const descriptor = opcodeDescriptor(opcode);
  const width = instructionWidth(opcode);
  if (pc + width > words.length) {
    throw new Error(`opcode ${opcodeName(opcode)} at pc ${pc} needs ${width} words, ${words.length - pc} remain`);
  }
  const aux = width === 2 ? words[pc + 1] : undefined;
  const insn: DecodedInstruction = {
    pc,
    rawWord,
    width,
    opcode,
    mnemonic: descriptor?.name ?? opcodeName(opcode),
    format: descriptor?.format ?? InstructionFormat.ABC,
    a: insnA(rawWord),
    b: insnB(rawWord),
    c: insnC(rawWord),
    d: insnD(rawWord),
    e: insnE(rawWord),
    aux,
    defs: [],
    uses: [],
    jumpTarget: jumpTarget(rawWord, pc),
  };
  annotateEffects(insn, constantCount);
  return insn;
}

function annotateEffects(insn: DecodedInstruction, constantCount: number): void {
  const { opcode, a, b, c, d, aux } = insn;
  switch (opcode) {
    case Opcode.LOADNIL:
    case Opcode.LOADB:
    case Opcode.LOADN:
      insn.defs = [a];
      break;
    case Opcode.LOADK:
      insn.defs = [a];
      insn.constantIndex = d;
      break;
    case Opcode.LOADKX:
      insn.defs = [a];
      insn.constantIndex = aux;
      break;
    case Opcode.MOVE:
      insn.defs = [a];
      insn.uses = [b];
      break;
    case Opcode.GETGLOBAL:
      insn.defs = [a];
      insn.constantIndex = aux;
      break;
    case Opcode.SETGLOBAL:
      insn.uses = [a];
      insn.constantIndex = aux;
      break;
    case Opcode.GETUPVAL:
      insn.defs = [a];
      break;
    case Opcode.SETUPVAL:
      insn.uses = [a];
      break;
    case Opcode.GETIMPORT:
      insn.defs = [a];
      insn.constantIndex = d;
      break;
    case Opcode.GETTABLE:
      insn.defs = [a];
      insn.uses = [b, c];
      break;
    case Opcode.SETTABLE:
      insn.uses = [a, b, c];
      break;
    case Opcode.GETTABLEKS:
    case Opcode.GETUDATAKS:
      insn.defs = [a];
      insn.uses = [b];
      insn.constantIndex = aux !== undefined ? aux & 0xffff : undefined;
      break;
    case Opcode.SETTABLEKS:
    case Opcode.SETUDATAKS:
      insn.uses = [a, b];
      insn.constantIndex = aux !== undefined ? aux & 0xffff : undefined;
      break;
    case Opcode.GETTABLEN:
      insn.defs = [a];
      insn.uses = [b];
      break;
    case Opcode.SETTABLEN:
      insn.uses = [a, b];
      break;
    case Opcode.NEWCLOSURE:
      insn.defs = [a];
      insn.protoIndex = d;
      break;
    case Opcode.DUPCLOSURE:
      insn.defs = [a];
      insn.constantIndex = d;
      break;
    case Opcode.NAMECALL:
    case Opcode.NAMECALLUDATA:
      insn.defs = [a, a + 1];
      insn.uses = [b];
      insn.constantIndex = aux !== undefined ? aux & 0xffff : undefined;
      break;
    case Opcode.CALL:
    case Opcode.CALLFB:
      insn.call = {
        functionRegister: a,
        argumentBase: a + 1,
        argumentCount: b === 0 ? "multret" : b - 1,
        resultCount: c === 0 ? "multret" : c - 1,
      };
      insn.uses = collectRange(a, b === 0 ? a + 1 : a + (b - 1));
      insn.defs = c === 0 ? [a] : collectRange(a, a + Math.max(c - 2, 0));
      if (opcode === Opcode.CALLFB) {
        insn.constantIndex = aux;
      }
      break;
    case Opcode.RETURN:
      insn.uses = b === 0 ? [a] : collectRange(a, a + Math.max(b - 2, 0));
      break;
    case Opcode.JUMPIF:
    case Opcode.JUMPIFNOT:
      insn.uses = [a];
      break;
    case Opcode.JUMPIFEQ:
    case Opcode.JUMPIFLE:
    case Opcode.JUMPIFLT:
    case Opcode.JUMPIFNOTEQ:
    case Opcode.JUMPIFNOTLE:
    case Opcode.JUMPIFNOTLT:
      insn.uses = [a, aux ?? 0];
      break;
    case Opcode.JUMPXEQKNIL:
    case Opcode.JUMPXEQKB:
      insn.uses = [a];
      break;
    case Opcode.JUMPXEQKN:
    case Opcode.JUMPXEQKS:
      insn.uses = [a];
      insn.constantIndex = aux !== undefined ? aux & 0xffffff : undefined;
      break;
    case Opcode.ADD:
    case Opcode.SUB:
    case Opcode.MUL:
    case Opcode.DIV:
    case Opcode.MOD:
    case Opcode.POW:
    case Opcode.IDIV:
    case Opcode.AND:
    case Opcode.OR:
      insn.defs = [a];
      insn.uses = [b, c];
      break;
    case Opcode.ADDK:
    case Opcode.SUBK:
    case Opcode.MULK:
    case Opcode.DIVK:
    case Opcode.MODK:
    case Opcode.POWK:
    case Opcode.IDIVK:
    case Opcode.ANDK:
    case Opcode.ORK:
      insn.defs = [a];
      insn.uses = [b];
      insn.constantIndex = c;
      break;
    case Opcode.SUBRK:
    case Opcode.DIVRK:
      insn.defs = [a];
      insn.uses = [c];
      insn.constantIndex = b;
      break;
    case Opcode.CONCAT:
      insn.defs = [a];
      insn.uses = collectRange(b, c);
      break;
    case Opcode.NOT:
    case Opcode.MINUS:
    case Opcode.LENGTH:
      insn.defs = [a];
      insn.uses = [b];
      break;
    case Opcode.NEWTABLE:
      insn.defs = [a];
      break;
    case Opcode.DUPTABLE:
      insn.defs = [a];
      insn.constantIndex = d;
      break;
    case Opcode.SETLIST:
      insn.uses = b === 0 ? [a] : collectRange(a, b + Math.max(c - 2, 0));
      if (c !== 0) {
        insn.uses = [a, ...collectRange(b, b + c - 2)];
      } else {
        insn.uses = [a, b];
      }
      break;
    case Opcode.FORNPREP:
    case Opcode.FORNLOOP:
      insn.uses = [a, a + 1, a + 2];
      insn.defs = [a + 2, a + 3];
      break;
    case Opcode.FORGPREP:
    case Opcode.FORGPREP_INEXT:
    case Opcode.FORGPREP_NEXT:
      insn.uses = [a, a + 1, a + 2];
      break;
    case Opcode.FORGLOOP: {
      const count = aux !== undefined ? aux & 0xff : 2;
      insn.uses = [a, a + 1, a + 2];
      insn.defs = [a + 2, ...collectRange(a + 3, a + 2 + count)];
      break;
    }
    case Opcode.GETVARARGS:
      insn.defs = b === 0 ? [a] : collectRange(a, a + Math.max(b - 2, 0));
      break;
    case Opcode.CAPTURE:
      insn.capture = { type: a as CaptureType, source: b };
      if (a === CaptureType.VAL || a === CaptureType.REF) {
        insn.uses = [b];
      }
      break;
    case Opcode.FASTCALL:
    case Opcode.FASTCALL1:
    case Opcode.FASTCALL2:
    case Opcode.FASTCALL2K:
    case Opcode.FASTCALL3:
      insn.builtinId = a;
      if (opcode === Opcode.FASTCALL1) {
        insn.uses = [b];
      } else if (opcode === Opcode.FASTCALL2) {
        insn.uses = [b, aux !== undefined ? aux & 0xff : 0];
      } else if (opcode === Opcode.FASTCALL2K) {
        insn.uses = [b];
        insn.constantIndex = aux;
      } else if (opcode === Opcode.FASTCALL3) {
        const r2 = aux !== undefined ? aux & 0xff : 0;
        const r3 = aux !== undefined ? (aux >>> 8) & 0xff : 0;
        insn.uses = [b, r2, r3];
      }
      break;
    case Opcode.NEWCLASS:
      insn.defs = [a];
      insn.constantIndex = aux;
      if (b !== 0xff) {
        insn.uses = [b];
      }
      break;
    case Opcode.NEWCLASSMEMBER:
      insn.uses = [a, c];
      insn.constantIndex = aux;
      break;
    case Opcode.CMPPROTO:
      insn.uses = [a];
      insn.protoIndex = aux;
      break;
    default:
      break;
  }

  if (insn.constantIndex !== undefined && (insn.constantIndex < 0 || insn.constantIndex >= constantCount)) {
    if (!isFastCall(opcode)) {
      insn.constantIndex = insn.constantIndex;
    }
  }
}

function collectRange(from: number, to: number): number[] {
  if (to < from) {
    return [from];
  }
  const registers: number[] = [];
  for (let register = from; register <= to; register++) {
    registers.push(register);
  }
  return registers;
}

export function decodeCodeStream(words: Uint32Array, constantCount: number): DecodedInstruction[] {
  const instructions: DecodedInstruction[] = [];
  let pc = 0;
  while (pc < words.length) {
    const insn = decodeInstructionWord(words, pc, constantCount);
    instructions.push(insn);
    pc += insn.width;
  }
  return instructions;
}
