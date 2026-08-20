#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { decompile, parseQueryOptions } from "./decompile.js";
import { decodeBytecode } from "./decode/Decoder.js";
import { disassembleModule } from "./disasm/Disassembler.js";
import { parseRuntimeContext } from "./reconstruct/RuntimeContext.js";
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
  const options = parseQueryOptions(new URLSearchParams(process.env.LUAU_DECOMPILE_OPTS ?? ""));
  const contextFlag = process.argv.indexOf("--context");
  if (contextFlag >= 0 && process.argv[contextFlag + 1]) {
    try {
      options.runtimeContext = parseRuntimeContext(JSON.parse(readFileSync(process.argv[contextFlag + 1]!, "utf8")));
    } catch (error) {
      process.stderr.write(`failed to read --context: ${error instanceof Error ? error.message : error}\n`);
      process.exit(1);
    }
  }
  if (process.argv.includes("--no-context")) {
    options.runtimeContext = false;
  }
  const result = decompile(bytes, options);
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
