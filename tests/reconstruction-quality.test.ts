import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decompile } from "../src/decompile.ts";

/** Fixtures are project-authored Luau compiled with the official compiler
 * (`luau-compile --binary -O<n> -g1`); the source sits beside each chunk. */
function decompileFixture(name: string): string {
  const bytes = readFileSync(new URL(`./fixtures/quality/${name}.luauc`, import.meta.url));
  const result = decompile(new Uint8Array(bytes), { opcodeEncoding: "official" });
  if (!result.ok) throw new Error(result.error);
  return result.source;
}

describe("closure presentation", () => {
  const source = decompileFixture("inline-callbacks");

  it("returns a single-use anonymous function to the call that receives it", () => {
    expect(source).toMatch(/InputBegan:Connect\(function\(input: InputObject, gameProcessedEvent: boolean\)/);
    expect(source).toMatch(/PreAnimation:Connect\(function\(\)/);
    expect(source).toMatch(/task\.delay\(1, function\(\)/);
    expect(source).toMatch(/task\.spawn\(function\(\)/);
    expect(source).not.toMatch(/local function on[A-Z]/);
    expect(source).not.toMatch(/\b(?:spawned|delayed)\b/);
  });

  it("declares named functions with `local function`, never a split declaration", () => {
    expect(source).toContain("local function setSprinting(");
    expect(source).toContain("local function track(");
    expect(source).not.toMatch(/^\s*local \w+\n\s*function /m);
  });

  it("captures a runtime value through an ordinary local", () => {
    expect(source).toMatch(/local camPart = \w+\.RootPart\.CamPart/);
    expect(source).not.toMatch(/\bcaptured\d*\b/);
    expect(source).not.toMatch(/^\s*do$/m);
  });
});

describe("structure a person would have written", () => {
  const source = decompileFixture("guard-structure");
  const body = (name: string): string => {
    const start = source.indexOf(`local function ${name}(`);
    expect(start).toBeGreaterThanOrEqual(0);
    return source.slice(start, source.indexOf("\nend\n", start));
  };

  it("joins the tests of one shared exit arm instead of repeating the arm", () => {
    const launch = body("launch");
    expect(launch).toMatch(/if \w+ and \w+ and \w+ then/);
    expect(launch.match(/destroy\(/g)).toHaveLength(1);
  });

  it("recovers a value assigned across a test as one short-circuit expression", () => {
    expect(body("build")).toMatch(/local \w+ = \w+ > 0 and \{ tier = \w+ \} or nil/);
    expect(body("firstFloor")).toMatch(/local \w+ = \w+ and \w+\.gui\n\s+local \w+ = \w+ and \w+\.scale/);
  });

  it("writes an early exit as a guard clause, with no `else` after it", () => {
    const build = body("build");
    expect(build).toMatch(/if not \w+ then\n\s+note\("wait", \w+\)\n\s+return\n\s+end\n\s+local/);
    expect(build).not.toMatch(/\belse\n\s+local/);
    const handle = body("handle");
    expect(handle).toMatch(/if \w+ then\n\s+return\n\s+end\n\s+if \w+\.kind == "mouse" then\n\s+note\("attack"\)\n\s+elseif/);
    expect(handle).not.toMatch(/note\("attack"\)\n\s+return/);
  });

  it("prefers a positive condition over a chain of negated guards", () => {
    const scan = body("scan");
    expect(scan).toMatch(/if \w+ and \w+ and \w+\.health > 0 then/);
    expect(scan).toMatch(/if \w+ < \w+ then/);
    expect(scan).not.toContain("not (");
    expect(scan.match(/continue/g)).toHaveLength(2);
  });

  it("rebuilds an elseif ladder at the end of a loop body", () => {
    const waitUntil = body("waitUntil");
    expect(waitUntil).toMatch(/if \w+ == 2 then[\s\S]+elseif \w+ == 4 then/);
    expect(waitUntil).not.toContain("continue");
    expect(waitUntil).toMatch(/\w+\.length > 0 and \w+\.length > 0 and \w+\.loaded/);
  });

  it("keeps nested conditional returns as statements", () => {
    expect(body("ladder")).not.toMatch(/then if /);
    expect(source).not.toMatch(/local snapshot\d* =/);
  });
});

describe("temporaries", () => {
  const source = decompileFixture("temporaries");

  it("returns an argument expression to the call that evaluated it in place", () => {
    expect(source).toMatch(/:FireServer\(\w+, math\.floor\(Config\.BaseDamage \* \(1 - \w+ \/ 50\)\)\)/);
    expect(source).toMatch(/:Create\(\w+, TweenInfo\.new\(0\.3\), \{ FieldOfView = if \w+ then 80 else 70 \}\):Play\(\)/);
    expect(source).toMatch(/\[#\w+ \+ 1\] = table\.concat\(\{ \w+, \w+ \}, " "\)/);
    expect(source).not.toMatch(/local \w+ = (?:math\.floor|table\.concat|TweenInfo\.new)\b/);
  });

  it("keeps a local the source declared, even when it is read once", () => {
    // Each of these values sat in a register of its own below its reader.
    expect(source).toMatch(/local Remotes: Instance = ReplicatedStorage:WaitForChild\("Remotes"\)\nlocal \w+: Instance = Remotes:WaitForChild\("Damage"\)/);
    expect(source).toMatch(/local (\w+) = \{ WalkSpeed = \w+ and Config\.SprintSpeed or Config\.WalkSpeed \}\n\s+local (\w+) = TweenService:Create\(\w+, TweenInfo\.new\(0\.25, [^\n]+, \1\)\n\s+\2:Play\(\)/);
  });

  it("keeps a value evaluated before an earlier read of its consumer", () => {
    // `camera.CFrame` is read after the bob offset was computed.
    expect(source).toMatch(/local (\w+) = math\.sin\(os\.clock\(\) \* 8\) \* math\.clamp\(\w+ \/ 16, 0, 1\) \* 0\.1\n\s+\w+\.CFrame \*= CFrame\.new\(0, \1, 0\)/);
  });
});

describe("generic-for loop variables", () => {
  it("does not merge a body temporary with a later loop's variables", () => {
    const source = decompileFixture("generic-loop-scratch");
    expect(source).toMatch(/for _, (\w+) in \w+ do\n\s+\1\.Parent = nil\n\s+end/);
    expect(source).not.toMatch(/^\s*local \w+$/m);
  });
});

describe("stores after a nested constructor", () => {
  it("keeps writes through a register that previously held a nested literal", () => {
    const source = decompileFixture("nested-constructor-store");
    expect(source).toMatch(/\.max \*= 2/);
    expect(source).toMatch(/\[#\w+\.tags \+ 1\] = "d"/);
  });
});
