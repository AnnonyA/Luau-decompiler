// Offline subset of Roblox/creator-docs at a23352b27af917e55e165e4d42583580700d1fbf.
// See docs/references/roblox-callback-types.md for source signatures and licenses.
export function lookupRobloxService(name: string): string | undefined {
  return name === "Players" ? "Players" : undefined;
}

export function lookupRobloxEventParameters(receiver: string, event: string): readonly string[] | undefined {
  return receiver === "Players" && event === "PlayerAdded" ? ["Player"] : undefined;
}

export function lookupRobloxProperty(receiver: string, member: string): string | undefined {
  if (receiver === "Player") {
    switch (member) {
      case "DisplayName": return "string";
      case "UserId": return "number";
    }
  }
  return undefined;
}

// The caller checks that the call has zero explicit arguments.
export function lookupRobloxMethodResult(receiver: string, method: string): string | undefined {
  return receiver === "Player" && method === "GetFullName" ? "string" : undefined;
}
