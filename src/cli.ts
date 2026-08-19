#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { decompile, parseQueryOptions } from "./decompile.js";
import { decodeBytecode } from "./decode/Decoder.js";
import { disassembleModule } from "./disasm/Disassembler.js";
import { startServer } from "./server.js";

function usage(): never {
  process.stderr.write("usage: luau-decompile <decompile|disassemble|info|serve> [file|port]\n");
  process.exit(2);
}

const [, , command, target] = process.argv;
if (!command) {
  usage();
}

if (command === "serve") {
  const port = Number(target ?? process.env.PORT ?? 3000);
  startServer(port, "0.0.0.0");
  process.stdout.write(`listening on 0.0.0.0:${port}\n`);
} else if (!target) {
  usage();
} else if (command === "disassemble" || command === "info") {
  try {
    const bytes = new Uint8Array(readFileSync(target));
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
  const bytes = new Uint8Array(readFileSync(target));
  const result = decompile(bytes, parseQueryOptions(new URLSearchParams(process.env.LUAU_DECOMPILE_OPTS ?? "")));
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
