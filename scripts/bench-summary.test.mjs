import { test } from "node:test";
import assert from "node:assert/strict";
import { summarizeReport } from "./bench-summary.mjs";

test("benchmark summary distinguishes measured decode from unmeasured semantics", () => {
  const report = {
    schemaVersion: 1,
    localEngine: "AnnonyA/Luau-decompiler",
    localVersion: "0.2.0",
    platform: { node: "v22.0.0" },
    fixtureCounts: { total: 2 },
    samples: [
      {
        id: "valid",
        sha256: "0123456789abaaaaaaaa",
        ourEngine: { success: true, durationMs: 12.34, syntax: { status: "NOT_CHECKED" } },
      },
      {
        id: "unsupported",
        sha256: "abcdef012345bbbbbbbb",
        ourEngine: { success: false, errorCode: "version", durationMs: 2 },
      },
    ],
  };
  const markdown = summarizeReport(report);
  assert.match(markdown, /valid \| 0123456789ab \| yes \| NOT_CHECKED \| 12.34/);
  assert.match(markdown, /unsupported \| abcdef012345 \| no \(version\) \| NOT_CHECKED \| 2/);
  assert.match(markdown, /Semantic equivalence: NOT MEASURED/);
  assert.match(markdown, /does not execute or time LunaUX/);
});

test("summary does not silently accept malformed reports", () => {
  assert.throws(() => summarizeReport({ schemaVersion: 2, samples: [] }), /unsupported benchmark/);
  assert.throws(() => summarizeReport({ schemaVersion: 1 }), /unsupported benchmark/);
});

test("escapes dynamic fields in Markdown tables", () => {
  const markdown = summarizeReport({
    schemaVersion: 1,
    localEngine: "x",
    localVersion: "0.2.0",
    platform: { node: "v20" },
    fixtureCounts: { total: 1 },
    samples: [{
      id: "malicious|row\nnext",
      sha256: "a".repeat(64),
      ourEngine: { success: true, durationMs: 0, syntax: { status: "PASS" } },
    }],
  });
  assert.match(markdown, /malicious\\\|row next/);
});
