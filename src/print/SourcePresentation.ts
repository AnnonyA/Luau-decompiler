import type {BytecodeModule} from '../decode/Prototype.js';

export const DECOMPILER_VERSION = '0.2.0';
type SourceResult = {source:string;module:Pick<BytecodeModule,'version' | 'typesVersion'>};

/** Presentation metadata belongs at the export boundary: the core source stays
 * deterministic for caches, semantic comparisons and library consumers. */
export function formatDecompiledSource(result:SourceResult, generatedAt = new Date()): string {
  const timestamp=generatedAt.toISOString().replace(/\.\d{3}Z$/, 'Z');
  return `-- [[ annonya.github.io ]] v${DECOMPILER_VERSION} | decompiled at ${timestamp}\n` +
    `-- Luau bytecode version: ${result.module.version} | Luau type version: ${result.module.typesVersion}\n\n` + result.source;
}
