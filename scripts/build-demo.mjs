import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { execFileSync } from "node:child_process";
import { writeBytecode, abc, ad } from "../dist/decode/BytecodeWriter.js";
import { Opcode } from "../dist/decode/Opcode.js";

const root = new URL("../", import.meta.url);
const site = new URL("_site/", root);
await rm(site, { recursive: true, force: true });
await mkdir(site, { recursive: true });
await cp(new URL("web/", root), site, { recursive: true });
await cp(new URL("dist/", root), new URL("engine/", site), {
  recursive: true,
  filter: (source) => !/\.(?:map|ts)$/.test(source) &&
    !["server.js", "cli.js", "index.js"].includes(basename(source)),
});
// A small project-owned fixture. No uploaded or external code enters the site.
await writeFile(new URL("example.luauc", site), writeBytecode({
  maxStackSize: 2, numParams: 0, numUpvalues: 0,
  constants: [{ kind: "string", value: "print" }, { kind: "string", value: "Hello from Luau!" }],
  instructions: [abc(Opcode.GETGLOBAL, 0, 0, 0), 0, ad(Opcode.LOADK, 1, 1), abc(Opcode.CALL, 0, 2, 1), abc(Opcode.RETURN, 0, 1, 0)],
}));
let revision = "local";
try { revision = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" }).trim(); }
catch { /* Source archives do not contain Git metadata. */ }
await writeFile(new URL("version.json", site), JSON.stringify({ revision }));
await writeFile(new URL(".nojekyll", site), "");
console.log("Static demo built in _site/ (no server or API required).");
