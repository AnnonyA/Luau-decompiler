import { OPCODE_TABLE, type SupportStatus } from "./Opcode.js";

export const LBC_VERSION_MIN = 3;
export const LBC_VERSION_MAX = 13;
export const LBC_VERSION_TARGET = 6;
export const LBC_VERSION_CLASSES = 100;
export const LBC_TYPE_VERSION_MIN = 1;
export const LBC_TYPE_VERSION_MAX = 3;

export interface BytecodeProfile {
  version: number;
  typesVersion: number;
  status: SupportStatus;
  notes: string[];
  allowsOpcode(opcode: number): boolean;
}

export function profileFor(version: number, typesVersion: number): BytecodeProfile {
  const notes: string[] = [];
  let status: SupportStatus = "verified";

  if (version === 0) {
    return {
      version,
      typesVersion,
      status: "unsupported",
      notes: ["version 0 encodes a compiler error string, not executable bytecode"],
      allowsOpcode: () => false,
    };
  }

  if (version === 1 || version === 2) {
    return {
      version,
      typesVersion,
      status: "unsupported",
      notes: ["bytecode versions 1-2 are no longer accepted by current Luau runtimes"],
      allowsOpcode: () => false,
    };
  }

  if (version !== LBC_VERSION_CLASSES && (version < LBC_VERSION_MIN || version > LBC_VERSION_MAX)) {
    return {
      version,
      typesVersion,
      status: "unsupported",
      notes: [`unsupported bytecode version ${version}`],
      allowsOpcode: () => false,
    };
  }

  if (version >= 10 || version === LBC_VERSION_CLASSES) {
    status = "experimental";
    notes.push("class, feedback, and cost-model extensions are decoded but not fully reconstructed");
  }

  return {
    version,
    typesVersion,
    status,
    notes,
    allowsOpcode(opcode: number): boolean {
      const descriptor = OPCODE_TABLE[opcode];
      if (!descriptor) {
        return false;
      }
      if (descriptor.introducedIn === LBC_VERSION_CLASSES) {
        return version === LBC_VERSION_CLASSES || version >= 10;
      }
      return version >= descriptor.introducedIn;
    },
  };
}
