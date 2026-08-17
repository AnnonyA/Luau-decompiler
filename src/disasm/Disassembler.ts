import type { DecodedInstruction } from "../decode/DecodedInstruction.js";
import type { BytecodeModule, Prototype } from "../decode/Prototype.js";
import { Opcode } from "../decode/Opcode.js";

export function disassembleModule(module: BytecodeModule): string {
  const lines: string[] = [
    `bytecode version ${module.version}`,
    `type version ${module.typesVersion}`,
    `strings ${module.strings.length}`,
    `prototypes ${module.prototypes.length}`,
    `main ${module.mainProtoId}`,
    "",
  ];
  for (const proto of module.prototypes) {
    lines.push(disassemblePrototype(module, proto));
    lines.push("");
  }
  return lines.join("\n");
}

export function disassemblePrototype(module: BytecodeModule, proto: Prototype): string {
  const header = [
    `proto ${proto.id}${proto.debugName ? ` "${proto.debugName}"` : ""}`,
    `  params ${proto.numParams} upvalues ${proto.numUpvalues} stack ${proto.maxStackSize}${proto.isVararg ? " vararg" : ""}`,
  ];
  if (proto.constants.length > 0) {
    header.push("  constants:");
    proto.constants.forEach((constant, index) => {
      header.push(`    K${index} ${formatConstant(constant)}`);
    });
  }
  header.push("  code:");
  for (const insn of proto.instructions) {
    header.push(`    ${String(insn.pc).padStart(4, " ")}  ${formatInsn(insn, proto)}`);
  }
  return header.join("\n");
}

function formatInsn(insn: DecodedInstruction, proto: Prototype): string {
  const parts = [insn.mnemonic.padEnd(14, " "), `A=${insn.a}`, `B=${insn.b}`, `C=${insn.c}`, `D=${insn.d}`];
  if (insn.aux !== undefined) {
    parts.push(`AUX=${insn.aux}`);
  }
  if (insn.jumpTarget !== undefined) {
    parts.push(`-> ${insn.jumpTarget}`);
  }
  if (insn.constantIndex !== undefined) {
    const constant = proto.constants[insn.constantIndex];
    if (constant) {
      parts.push(`; ${formatConstant(constant)}`);
    }
  }
  if (insn.opcode === Opcode.CAPTURE) {
    parts.push(`; capture ${insn.a}/${insn.b}`);
  }
  return parts.join(" ");
}

function formatConstant(constant: { kind: string; [key: string]: unknown }): string {
  switch (constant.kind) {
    case "nil":
      return "nil";
    case "boolean":
      return String(constant.value);
    case "number":
      return String(constant.value);
    case "string":
      return JSON.stringify(constant.value);
    case "import":
      return `import ${(constant.path as string[]).join(".")}`;
    case "table":
      return `table keys=${JSON.stringify(constant.keys)}`;
    case "closure":
      return `closure proto ${constant.protoId}`;
    case "integer":
      return `int ${constant.value}`;
    case "vector":
      return `vector ${constant.x},${constant.y},${constant.z}`;
    default:
      return constant.kind;
  }
}
