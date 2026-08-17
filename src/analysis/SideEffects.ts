import { Opcode } from "../decode/Opcode.js";
import type { DecodedInstruction } from "../decode/DecodedInstruction.js";

export type SideEffectClass =
  | "pure"
  | "read-only"
  | "global-read"
  | "table-read"
  | "metamethod"
  | "call"
  | "mutation"
  | "control"
  | "unknown";

const RANK: Record<SideEffectClass, number> = {
  pure: 0,
  "read-only": 1,
  "global-read": 2,
  "table-read": 3,
  metamethod: 4,
  call: 5,
  mutation: 6,
  control: 7,
  unknown: 8,
};

export function joinEffects(a: SideEffectClass, b: SideEffectClass): SideEffectClass {
  return RANK[a] >= RANK[b] ? a : b;
}

export function isObservable(effect: SideEffectClass): boolean {
  return RANK[effect] >= RANK.call;
}

export function mayHaveMetamethod(effect: SideEffectClass): boolean {
  return RANK[effect] >= RANK.metamethod;
}

export function effectOf(insn: DecodedInstruction): SideEffectClass {
  switch (insn.opcode) {
    case Opcode.NOP:
    case Opcode.LOADNIL:
    case Opcode.LOADB:
    case Opcode.LOADN:
    case Opcode.LOADK:
    case Opcode.LOADKX:
    case Opcode.MOVE:
    case Opcode.GETUPVAL:
    case Opcode.NOT:
    case Opcode.PREPVARARGS:
    case Opcode.GETVARARGS:
    case Opcode.CAPTURE:
    case Opcode.COVERAGE:
      return "pure";
    case Opcode.GETGLOBAL:
    case Opcode.GETIMPORT:
      return "global-read";
    case Opcode.GETTABLE:
    case Opcode.GETTABLEKS:
    case Opcode.GETTABLEN:
    case Opcode.GETUDATAKS:
    case Opcode.NAMECALL:
    case Opcode.NAMECALLUDATA:
      return "table-read";
    case Opcode.ADD:
    case Opcode.SUB:
    case Opcode.MUL:
    case Opcode.DIV:
    case Opcode.MOD:
    case Opcode.POW:
    case Opcode.IDIV:
    case Opcode.ADDK:
    case Opcode.SUBK:
    case Opcode.MULK:
    case Opcode.DIVK:
    case Opcode.MODK:
    case Opcode.POWK:
    case Opcode.IDIVK:
    case Opcode.SUBRK:
    case Opcode.DIVRK:
    case Opcode.MINUS:
    case Opcode.LENGTH:
    case Opcode.CONCAT:
    case Opcode.AND:
    case Opcode.OR:
    case Opcode.ANDK:
    case Opcode.ORK:
      return "metamethod";
    case Opcode.NEWTABLE:
    case Opcode.DUPTABLE:
    case Opcode.NEWCLOSURE:
    case Opcode.DUPCLOSURE:
      return "pure";
    case Opcode.SETGLOBAL:
    case Opcode.SETTABLE:
    case Opcode.SETTABLEKS:
    case Opcode.SETTABLEN:
    case Opcode.SETUDATAKS:
    case Opcode.SETLIST:
    case Opcode.SETUPVAL:
    case Opcode.CLOSEUPVALS:
      return "mutation";
    case Opcode.CALL:
    case Opcode.CALLFB:
    case Opcode.FASTCALL:
    case Opcode.FASTCALL1:
    case Opcode.FASTCALL2:
    case Opcode.FASTCALL2K:
    case Opcode.FASTCALL3:
      return "call";
    case Opcode.RETURN:
    case Opcode.JUMP:
    case Opcode.JUMPBACK:
    case Opcode.JUMPX:
    case Opcode.JUMPIF:
    case Opcode.JUMPIFNOT:
    case Opcode.JUMPIFEQ:
    case Opcode.JUMPIFLE:
    case Opcode.JUMPIFLT:
    case Opcode.JUMPIFNOTEQ:
    case Opcode.JUMPIFNOTLE:
    case Opcode.JUMPIFNOTLT:
    case Opcode.JUMPXEQKNIL:
    case Opcode.JUMPXEQKB:
    case Opcode.JUMPXEQKN:
    case Opcode.JUMPXEQKS:
    case Opcode.FORNPREP:
    case Opcode.FORNLOOP:
    case Opcode.FORGPREP:
    case Opcode.FORGLOOP:
    case Opcode.FORGPREP_INEXT:
    case Opcode.FORGPREP_NEXT:
    case Opcode.BREAK:
      return "control";
    default:
      return "unknown";
  }
}
