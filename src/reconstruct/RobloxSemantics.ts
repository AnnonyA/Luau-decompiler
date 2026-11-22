import type { Expression } from "../ast/Ast.js";
import { isValidIdentifier } from "./Naming.js";

const EVENT_PARAMS: Record<string, string[]> = {
  PlayerAdded: ["player"],
  PlayerRemoving: ["player"],
  CharacterAdded: ["character"],
  CharacterRemoving: ["character"],
  ChildAdded: ["child"],
  ChildRemoved: ["child"],
  DescendantAdded: ["descendant"],
  DescendantRemoving: ["descendant"],
  InputBegan: ["input", "gameProcessedEvent"],
  InputEnded: ["input", "gameProcessedEvent"],
  InputChanged: ["input", "gameProcessedEvent"],
  Heartbeat: ["deltaTime"],
  Stepped: ["time", "deltaTime"],
  RenderStepped: ["deltaTime"],
  PreRender: ["deltaTime"],
  PreAnimation: ["deltaTime"],
  PreSimulation: ["deltaTime"],
  PostSimulation: ["deltaTime"],
  Touched: ["hit"],
  TouchEnded: ["hit"],
  AncestryChanged: ["child", "parent"],
  Changed: ["property"],
  OnClientEvent: ["..."],
  OnServerEvent: ["player"],
  Activated: ["inputObject", "clickCount"],
  MouseButton1Click: [],
  MouseButton1Down: ["x", "y"],
  MouseButton1Up: ["x", "y"],
  MouseButton2Click: [],
  MouseEnter: ["x", "y"],
  MouseLeave: ["x", "y"],
  MouseMoved: ["x", "y"],
  MouseWheelForward: ["x", "y"],
  MouseWheelBackward: ["x", "y"],
  Focused: [],
  FocusLost: ["enterPressed"],
  SelectionGained: [],
  SelectionLost: [],
  Completed: ["playbackState"],
  Stopped: [],
  Played: [],
  DidLoop: [],
  Ended: [],
  Loaded: [],
  KeyframeReached: ["keyframe"],
  Triggered: ["player"],
  PromptShown: ["inputType"],
  PromptHidden: [],
  StateChanged: ["old", "new"],
  Died: [],
  Running: ["speed"],
  Jumping: ["active"],
  Climbing: ["speed"],
  Swimming: ["speed"],
  FreeFalling: ["active"],
  Seated: ["active", "seat"],
  HealthChanged: ["health"],
  Idled: ["time"],
  Event: ["..."],
  Observe: ["value"],
  ObserveKeys: ["value"],
};

const PROPERTY_LOCAL: Record<string, string> = {
  LocalPlayer: "LocalPlayer",
  Character: "character",
  Humanoid: "humanoid",
  PrimaryPart: "primaryPart",
  Parent: "parent",
  Name: "name",
  DisplayName: "displayName",
  UserId: "userId",
  Team: "team",
  TeamColor: "teamColor",
  CFrame: "cframe",
  Position: "position",
  Velocity: "velocity",
  Health: "health",
  MaxHealth: "maxHealth",
  WalkSpeed: "walkSpeed",
  JumpPower: "jumpPower",
  Text: "text",
  Value: "value",
  Enabled: "enabled",
  Visible: "visible",
  Adornee: "adornee",
};

const METHOD_RESULT: Record<string, string> = {
  GetPlayers: "players",
  GetChildren: "children",
  GetDescendants: "descendants",
  GetPlayerFromCharacter: "player",
  GetHumanoid: "humanoid",
  Clone: "clone",
  FindFirstChild: "child",
  FindFirstChildOfClass: "child",
  FindFirstChildWhichIsA: "child",
  WaitForChild: "child",
  IsA: "ok",
  GetService: "service",
  GetPropertyChangedSignal: "signal",
  Connect: "connection",
  Once: "connection",
  Disconnect: "unused",
};

const CALLBACK_METHODS = new Set([
  "Connect",
  "Once",
  "connect",
  "once",
  "ConnectParallel",
  "Observe",
  "ObserveKeys",
]);

export function nameFromProperty(name: string): string | undefined {
  return PROPERTY_LOCAL[name];
}

export function nameFromMethod(name: string, args: Expression[]): string | undefined {
  if (name === "GetService" || name === "WaitForChild" || name === "FindFirstChild") {
    const first = args[0];
    if (first?.kind === "literal" && typeof first.value === "string" && isValidIdentifier(first.value)) {
      if (name === "GetService" || name === "WaitForChild") {
        return first.value;
      }
      return lowerFirst(first.value);
    }
  }
  if (name === "Instance" || name === "new") {
    return undefined;
  }
  return METHOD_RESULT[name];
}

export function eventCallbackName(event: string): string {
  if (event.length === 0) {
    return "callback";
  }
  if (/^On[A-Z]/.test(event) || /^on[A-Z]/.test(event)) {
    return event[0]!.toLowerCase() + event.slice(1);
  }
  return `on${event}`;
}

export function typeFromExpression(expression: Expression): string | undefined {
  if (expression.kind === "literal") {
    if (expression.value === null) {
      // `local x: nil = nil` is noise; a nil initializer never deserves an annotation.
      return undefined;
    }
    if (typeof expression.value === "boolean") {
      return "boolean";
    }
    if (typeof expression.value === "number") {
      return "number";
    }
    if (typeof expression.value === "string") {
      return "string";
    }
    if (typeof expression.value === "bigint") {
      return "number";
    }
  }
  // Receiver-dependent Roblox facts are resolved on lexical bindings in FunctionEvidence.
  if (expression.kind === "call") {
    return typeFromCall(expression.callee);
  }
  return undefined;
}

function typeFromCall(callee: Expression): string | undefined {
  if (callee.kind === "identifier") {
    if (callee.name === "typeof" || callee.name === "type" || callee.name === "tostring") {
      return "string";
    }
    if (callee.name === "tonumber") {
      return "number?";
    }
    if (callee.name === "tick" || callee.name === "time" || callee.name === "os") {
      return "number";
    }
  }
  return undefined;
}

export interface CallbackHint {
  names: string[];
  firstParameterType?: string;
}

export function callbackParamTypes(hint: CallbackHint, mapped: string[], existing?: Array<string | undefined>): Array<string | undefined> | undefined {
  if (!hint.firstParameterType || mapped.length === 0) return existing;
  return mapped.map((_, index) => existing?.[index] ?? (index === 0 ? hint.firstParameterType : undefined));
}

export function callbackParamsFor(expression: Expression): CallbackHint | undefined {
  if (expression.kind === "method-call" && CALLBACK_METHODS.has(expression.name)) {
    return callbackParamsFor(expression.object);
  }
  if (expression.kind === "property") {
    const names = Object.hasOwn(EVENT_PARAMS, expression.name) ? EVENT_PARAMS[expression.name] : undefined;
    return names ? { names } : undefined;
  }
  if (expression.kind === "call") {
    const callee = expression.callee;
    if (callee.kind === "property" && callee.name === "new" && callee.object.kind === "identifier" && /Shake/i.test(callee.object.name)) {
      return { names: ["cframe"], firstParameterType: "CFrame" };
    }
  }
  return undefined;
}

export function stringLiteral(expression: Expression | undefined): string | undefined {
  if (expression?.kind === "literal" && typeof expression.value === "string") {
    return expression.value;
  }
  return undefined;
}

export function lowerFirst(name: string): string {
  if (name.length === 0) {
    return name;
  }
  return name[0]!.toLowerCase() + name.slice(1);
}

export const MATH_CONSTANTS: Array<{ value: number; object: string; name: string }> = [
  { value: Math.PI, object: "math", name: "pi" },
];
