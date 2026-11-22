import { expect, it } from "vitest";
import { robloxClasses, robloxDatatypes, robloxEnums } from "../src/reconstruct/roblox-api.generated.js";
import {
  lookupRobloxCallbackParameters, lookupRobloxEventParameters, lookupRobloxMethodResult,
  lookupRobloxProperty, lookupRobloxService,
} from "../src/reconstruct/roblox-api-facts.js";

it("includes every class, datatype and enum file in the pinned Creator Hub snapshot", () => {
  expect(Object.keys(robloxClasses)).toHaveLength(644);
  expect(Object.keys(robloxDatatypes)).toHaveLength(49);
  expect(Object.keys(robloxEnums)).toHaveLength(526);
});

it("reaches every declared signal and callback through the public lookup", () => {
  for (const [name, owner] of Object.entries(robloxClasses)) {
    if (owner.service) expect(lookupRobloxService(name)).toBe(name);
    for (const [event, params] of Object.entries(owner.events ?? {})) {
      expect(lookupRobloxEventParameters(name, event), name + "." + event).toEqual(params);
    }
    for (const [callback, params] of Object.entries(owner.callbacks ?? {})) {
      expect(lookupRobloxCallbackParameters(name, callback), name + "." + callback).toEqual(params);
    }
  }
});

it("preserves owner-specific event signatures and rejects JS prototype names", () => {
  expect(lookupRobloxEventParameters("TextButton", "InputBegan")).toEqual(["InputObject"]);
  expect(lookupRobloxEventParameters("UserInputService", "InputBegan")).toEqual(["InputObject", "boolean"]);
  for (const name of ["constructor", "__proto__", "toString"]) {
    expect(lookupRobloxService(name)).toBeUndefined();
    expect(lookupRobloxEventParameters(name, "InputBegan")).toBeUndefined();
    expect(lookupRobloxProperty("Instance", name)).toBeUndefined();
    expect(lookupRobloxMethodResult("Instance", name)).toBeUndefined();
  }
});
