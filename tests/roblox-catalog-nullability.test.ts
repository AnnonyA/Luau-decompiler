import { expect, it } from "vitest";
import { lookupRobloxMethodResult, lookupRobloxProperty, lookupRobloxStaticResult } from "../src/reconstruct/roblox-api-facts.js";

it("keeps parse failure in the result of DateTime.fromIsoDate", () => {
  expect(lookupRobloxStaticResult("DateTime", "fromIsoDate", 1)).toBe("DateTime?");
  expect(lookupRobloxStaticResult("DateTime", "fromUnixTimestamp", 1)).toBe("DateTime");
});

it("includes nil when a tool icon or collision group does not exist", () => {
  expect(lookupRobloxMethodResult("ContextActionService", "GetCurrentLocalToolIcon", 0)).toBe("string?");
  expect(lookupRobloxMethodResult("PhysicsService", "GetCollisionGroupId", 1)).toBe("number?");
});

it.each(["FloatCurveKey", "RotationCurveKey"])("keeps unset tangents on %s optional", (curve) => {
  expect(lookupRobloxProperty(curve, "LeftTangent")).toBe("number?");
  expect(lookupRobloxProperty(curve, "RightTangent")).toBe("number?");
});
