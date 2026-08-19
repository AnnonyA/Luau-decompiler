#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { decompile } from "./decompile.js";
import { decodeBytecode } from "./decode/Decoder.js";
import { disassembleModule } from "./disasm/Disassembler.js";

function usage(): never {
  process.stderr.write("usage: luau-decompile <decompile|disassemble|info> <file>\n");
  process.exit(2);
}

const [, , command, file] = process.argv;
if (!command || !file) {
  usage();
}

const bytes = new Uint8Array(readFileSync(file));

if (command === "disassemble" || command === "info") {
  try {
    const { module, profile } = decodeBytecode(bytes);
    if (command === "info") {
      process.stdout.write(
        `version ${module.version}\ntypes ${module.typesVersion}\nstatus ${profile.status}\nprototypes ${module.prototypes.length}\n`,
      );
    } else {
      process.stdout.write(disassembleModule(module));
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
    process.exit(1);
  }
} else if (command === "decompile") {
  const result = decompile(bytes);
  if (!result.ok) {
    process.stderr.write(`${result.error}\n`);
    process.exit(1);
  }
  process.stdout.write(result.source);
  if (result.diagnostics.some((item) => item.severity === "error")) {
    process.exit(1);
  }
} else {
  usage();
}
