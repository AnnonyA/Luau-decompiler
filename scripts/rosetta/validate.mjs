#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const suite = JSON.parse(readFileSync(new URL("../../benchmarks/rosetta/suite.json", import.meta.url), "utf8"));
export const tierNames = Object.freeze(Object.keys(suite.tiers));

function demand(condition, message) {
  if (!condition) throw new Error(`Invalid Rosetta result: ${message}`);
}

function object(value, label) {
  demand(value !== null && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
}

function integer(value, label) {
  demand(Number.isSafeInteger(value) && value >= 0, `${label} must be a non-negative safe integer`);
}

function score(actual, expected, label) {
  object(actual, label);
  for (const key of ["passed", "total"]) {
    integer(actual[key], `${label}.${key}`);
    demand(actual[key] === expected[key], `${label}.${key} is ${actual[key]}, reconstructed ${expected[key]}`);
  }
}

export function inventoryHash(names) {
  return createHash("sha256").update(JSON.stringify(names)).digest("hex");
}

/** Validate the pinned corpus and reconstruct all scores from individual verdicts.
 * Refusals remain failures of an all-pass gate; known unusable originals are excluded.
 * A valid measurement can contain failures only when requireAllPass is explicitly false.
 */
export function validateResult(result, { tier, expectedVersion, requireAllPass = true } = {}) {
  object(result, "root");
  demand(result.format === "rosetta-result" && result.schema === 1, "unsupported format/schema");
  demand(result.rosetta === suite.rosettaVersion, `rosetta must be ${suite.rosettaVersion}`);
  demand(result.luau === suite.luau, `luau must be ${suite.luau}`);
  object(result.suite, "suite");
  const selectedTier = tier ?? result.suite.tier;
  demand(tierNames.includes(selectedTier), `unknown tier ${String(selectedTier)}`);
  const expected = suite.tiers[selectedTier];
  demand(result.suite.name === suite.suite, `suite.name must be ${suite.suite}`);
  demand(result.suite.tier === selectedTier, `suite.tier must be ${selectedTier}`);
  demand(result.suite.hash === expected.hash, `suite.hash must be ${expected.hash}`);
  demand(JSON.stringify(result.profiles) === JSON.stringify(expected.profiles), "profile list/order differs from the pinned tier");
  object(result.decompiler, "decompiler");
  demand(result.decompiler.name === suite.decompiler, `decompiler.name must be ${suite.decompiler}`);
  demand(typeof result.decompiler.version === "string" && result.decompiler.version.length > 0, "decompiler.version is missing");
  if (expectedVersion !== undefined) demand(result.decompiler.version === expectedVersion, "decompiler.version differs from the measured engine revision");
  demand(typeof result.created === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(result.created) && Number.isFinite(Date.parse(result.created)), "created must be an ISO UTC timestamp");
  demand(Number.isFinite(result.seconds) && result.seconds >= 0, "seconds must be finite and non-negative");
  integer(result.threads, "threads");
  demand(result.threads > 0, "threads must be positive");
  object(result.letters, "letters");
  demand(Object.keys(result.letters).length === Object.keys(suite.letters).length, "letter mapping has missing or additional verdicts");
  for (const [letter, verdict] of Object.entries(suite.letters)) {
    demand(result.letters[letter] === verdict, `letter ${letter} must mean ${verdict}`);
  }
  demand(Array.isArray(result.sections) && result.sections.length === expected.sections.length, "section list is incomplete or has additional entries");

  const excluded = new Set(expected.unusable.flatMap((entry) => entry.profiles.map((profile) => `${entry.section}/${entry.test}/${profile}`)));
  const counts = Object.fromEntries(Object.values(suite.letters).map((name) => [name, 0]));
  const sections = [];
  let roundTrips = 0;
  for (const [sectionIndex, expectedSection] of expected.sections.entries()) {
    const section = result.sections[sectionIndex];
    const label = `sections[${sectionIndex}]`;
    object(section, label);
    demand(section.id === expectedSection.id, `${label}.id must be ${expectedSection.id}`);
    demand(Array.isArray(section.tests) && section.tests.length === expectedSection.programs, `${section.id} must contain all ${expectedSection.programs} pinned programs`);
    const names = section.tests.map((test) => test?.name);
    const inventory = suite.inventories[expectedSection.inventory];
    demand(new Set(names).size === names.length, `${section.id} has duplicate program names`);
    demand(inventoryHash(names) === inventory.sha256, `${section.id} program inventory/order differs from the pinned suite`);

    const sectionScore = { passed: 0, total: 0 };
    for (const test of section.tests) {
      const testLabel = `${section.id}/${test.name}`;
      demand(typeof test.results === "string" && test.results.length === expected.profiles.length, `${testLabel} must have one verdict per profile`);
      const detailKeys = [];
      for (const [profileIndex, letter] of [...test.results].entries()) {
        demand(Object.hasOwn(suite.letters, letter), `${testLabel} has unknown verdict letter ${letter}`);
        const profile = expected.profiles[profileIndex];
        const isExcluded = excluded.has(`${testLabel}/${profile}`);
        demand((letter === "u") === isExcluded, `${testLabel}/${profile} changed the pinned unusable-original exclusions`);
        counts[suite.letters[letter]]++;
        roundTrips++;
        if (letter !== "u") sectionScore.total++;
        if (letter === "p") sectionScore.passed++;
        else detailKeys.push(profile);
      }
      const details = test.details ?? {};
      object(details, `${testLabel}.details`);
      demand(JSON.stringify(Object.keys(details).sort()) === JSON.stringify(detailKeys.sort()), `${testLabel}.details must describe exactly the non-passing profiles`);
      for (const detail of Object.values(details)) demand(typeof detail === "string" && detail.trim().length > 0, `${testLabel} has an empty failure detail`);
    }
    demand(sectionScore.total === expectedSection.usable, `${section.id} usable count differs from the pinned suite`);
    score(section.score, sectionScore, `${section.id}.score`);
    sections.push({ id: section.id, ...sectionScore });
  }
  demand(roundTrips === expected.roundTrips, `expected ${expected.roundTrips} round trips, reconstructed ${roundTrips}`);
  demand(counts.unusable === excluded.size, "unusable count differs from the pinned originals");
  const overall = { passed: counts.pass, total: roundTrips - counts.unusable };
  demand(overall.total === expected.usable, `expected ${expected.usable} usable round trips`);
  score(result.score, overall, "score");
  object(result.totals, "totals");
  for (const [name, count] of Object.entries(result.totals)) {
    demand(Object.hasOwn(counts, name), `totals contains unknown verdict ${name}`);
    integer(count, `totals.${name}`);
  }
  for (const [name, count] of Object.entries(counts)) {
    demand((result.totals[name] ?? 0) === count, `totals.${name} is ${result.totals[name] ?? 0}, reconstructed ${count}`);
  }
  const summary = { tier: selectedTier, hash: expected.hash, ...overall, roundTrips, counts, sections, allPass: overall.passed === overall.total };
  if (requireAllPass && !summary.allPass) {
    throw new Error(`Rosetta ${selectedTier} all-pass gate failed: ${overall.passed}/${overall.total}; ${JSON.stringify(counts)}`);
  }
  return summary;
}

export function validateResultText(text, options) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid Rosetta result: malformed JSON (${error.message})`);
  }
  return validateResult(parsed, options);
}

function main(args) {
  if (args.includes("--help")) {
    console.log("Usage: node scripts/rosetta/validate.mjs <result.json> [--tier TIER] [--expected-version SHA] [--measure-only]");
    return;
  }
  let file;
  const options = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--measure-only") options.requireAllPass = false;
    else if (arg === "--tier" || arg === "--expected-version") {
      const value = args[++i];
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value`);
      options[arg === "--tier" ? "tier" : "expectedVersion"] = value;
    } else if (!arg.startsWith("--") && !file) file = arg;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!file) throw new Error("A Rosetta result.json path is required");
  const summary = validateResultText(readFileSync(resolve(file), "utf8"), options);
  console.log(JSON.stringify(summary, null, 2));
  if (options.requireAllPass === false) console.log("Measurement only: recorded failures remain failures; the all-pass gate was not requested.");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
