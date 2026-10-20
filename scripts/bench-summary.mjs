#!/usr/bin/env node
/**
 * Convert a measured benchmark report to a short GitHub Actions summary.
 * This is not a semantic fidelity leaderboard.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const escapeCell = (value) => String(value).replace(/\|/g, "\\|").replace(/[\r\n]+/g, " ");

export function summarizeReport(report) {
  if (report.schemaVersion !== 1 || !Array.isArray(report.samples)) {
    throw new Error("unsupported benchmark report schema");
  }
  const lines = [
    "## Luau decompiler benchmark",
    "",
    "Engine: " + escapeCell(report.localEngine) + " " + escapeCell(report.localVersion),
    "",
    "Node: " + escapeCell(report.platform?.node ?? "unknown") + " · input files: " + report.fixtureCounts.total,
    "",
    "| Fixture | Bytecode SHA-256 | Decompiled | Official syntax check | Decompile ms |",
    "| --- | --- | --- | --- | ---: |",
  ];
  for (const sample of report.samples) {
    const own = sample.ourEngine;
    const status = own.success ? "yes" : "no (" + own.errorCode + ")";
    lines.push(
      "| " + escapeCell(sample.id) +
      " | " + escapeCell(sample.sha256.slice(0, 12)) +
      " | " + escapeCell(status) +
      " | " + escapeCell(own.syntax?.status ?? "NOT_CHECKED") +
      " | " + escapeCell(own.durationMs) + " |",
    );
  }
  lines.push(
    "",
    "**Semantic equivalence: NOT MEASURED.** This report does not execute or time LunaUX.",
    "",
    "A missing official Luau compiler means syntax remains **NOT_CHECKED**, even when AST validation passed.",
    "",
  );
  return lines.join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const reportPath = process.argv[2];
  if (!reportPath) {
    process.stderr.write("usage: node scripts/bench-summary.mjs <benchmark-report.json>\n");
    process.exitCode = 2;
  } else {
    try {
      const report = JSON.parse(await readFile(resolve(reportPath), "utf8"));
      process.stdout.write(summarizeReport(report));
    } catch (error) {
      process.stderr.write(String(error instanceof Error ? error.message : error) + "\n");
      process.exitCode = 1;
    }
  }
}
