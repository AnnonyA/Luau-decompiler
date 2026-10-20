#!/usr/bin/env node
/**
 * Ensure a configured official Luau parser was actually run.
 * A reported syntax FAIL remains a *measured* fidelity failure, not a fake
 * CI success. We report these as pending issues until the corpus is clean.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function inspectSyntaxReport(report) {
  if (report.schemaVersion !== 1 || !Array.isArray(report.samples) ||
      typeof report.compiler !== "object" || report.compiler.mode !== "--only-parse --null") {
    throw new Error("benchmark report does not identify official parser execution");
  }
  if (report.samples.length === 0) throw new Error("empty parser report");
  const own = { PASS: 0, FAIL: 0 };
  const published = { PASS: 0, FAIL: 0 };
  for (const item of report.samples) {
    if (!item.ourEngine?.success) {
      throw new Error("decompiler failed to emit source for " + item.id);
    }
    const result = item.ourEngine.syntax?.status;
    if (result !== "PASS" && result !== "FAIL") {
      throw new Error("official parser did not complete for our output: " + item.id);
    }
    own[result]++;
    if (item.competitorPublishedSource?.available) {
      const competitorResult = item.competitorPublishedSource.syntax?.status;
      if (competitorResult !== "PASS" && competitorResult !== "FAIL") {
        throw new Error("official parser did not complete for published reference: " + item.id);
      }
      published[competitorResult]++;
    }
  }
  return { checked: report.samples.length, own, published };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const file = process.argv[2];
  if (!file) {
    process.stderr.write("usage: node scripts/bench-assert-syntax.mjs <report.json>\n");
    process.exitCode = 2;
  } else {
    try {
      const counts = inspectSyntaxReport(JSON.parse(await readFile(resolve(file), "utf8")));
      process.stdout.write(JSON.stringify(counts, null, 2) + "\n");
      process.stdout.write(
        "Syntax FAIL counts are recorded and are NOT semantic-equivalence scores. " +
        "They do not fail this baseline collection job until a zero-failure gate is adopted.\n",
      );
    } catch (error) {
      process.stderr.write(String(error instanceof Error ? error.message : error) + "\n");
      process.exitCode = 1;
    }
  }
}
