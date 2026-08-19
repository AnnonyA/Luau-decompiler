import type { Expression } from "../ast/Ast.js";
import { isValidIdentifier } from "./Naming.js";

export const SERVICE_TYPES = new Set([
  "Players",
  "Workspace",
  "ReplicatedStorage",
  "ServerStorage",
  "ServerScriptService",
  "StarterGui",
  "StarterPack",
  "StarterPlayer",
  "Lighting",
  "TweenService",
  "RunService",
  "UserInputService",
  "ContextActionService",
  "HttpService",
  "MarketplaceService",
  "TeleportService",
  "DataStoreService",
  "MessagingService",
  "CollectionService",
  "PhysicsService",
  "PathfindingService",
  "ProximityPromptService",
  "SoundService",
  "Chat",
  "Teams",
  "TestService",
  "TextChatService",
  "VoiceChatService",
  "SocialService",
  "PolicyService",
  "LocalizationService",
  "GuiService",
  "Debris",
  "InsertService",
  "AssetService",
  "AvatarEditorService",
  "BadgeService",
  "FriendService",
  "GroupService",
  "MemoryStoreService",
  "NotificationService",
  "ReplicatedFirst",
  "ScriptContext",
  "Stats",
  "LogService",
  "ContentProvider",
]);

const EVENT_PARAMS: Record<string, string[]> = {
  PlayerAdded: ["player"],
  PlayerRemoving: ["player"],
  CharacterAdded: ["character"],
  CharacterRemoving: ["character"],
  ChildAdded: ["child"],
  ChildRemoved: ["child"],
  DescendantAdded: ["descendant"],
  DescendantRemoving: ["descendant"],
  InputBegan: ["input", "gameProcessed"],
  InputEnded: ["input", "gameProcessed"],
  InputChanged: ["input", "gameProcessed"],
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
  GetPropertyChangedSignal: ["property"],
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
  LocalPlayer: "player",
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
  if (expression.kind === "call") {
    return typeFromCall(expression.callee, expression.args);
  }
  if (expression.kind === "method-call") {
    return typeFromMethod(expression.object, expression.name, expression.args);
  }
  if (expression.kind === "property") {
    if (expression.name === "LocalPlayer") {
      return "Player";
    }
    if (expression.name === "Character") {
      return "Model";
    }
  }
  return undefined;
}

function typeFromCall(callee: Expression, args: Expression[]): string | undefined {
  if (callee.kind === "property" && callee.object.kind === "identifier" && callee.object.name === "Instance" && callee.name === "new") {
    const className = stringLiteral(args[0]);
    return className;
  }
  if (callee.kind === "property" && callee.object.kind === "identifier" && callee.object.name === "CFrame" && callee.name === "new") {
    return "CFrame";
  }
  if (callee.kind === "property" && callee.object.kind === "identifier" && callee.object.name === "Vector3" && callee.name === "new") {
    return "Vector3";
  }
  if (callee.kind === "property" && callee.object.kind === "identifier" && callee.object.name === "Color3") {
    return "Color3";
  }
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

function typeFromMethod(_object: Expression, name: string, args: Expression[]): string | undefined {
  if (name === "GetService") {
    const service = stringLiteral(args[0]);
    if (service && SERVICE_TYPES.has(service)) {
      return service;
    }
    return "Instance";
  }
  if (name === "IsA") {
    return "boolean";
  }
  if (name === "GetChildren" || name === "GetDescendants" || name === "GetPlayers") {
    return "{Instance}";
  }
  if (name === "Clone" || name === "WaitForChild" || name === "FindFirstChild") {
    const className = stringLiteral(args[0]);
    return className && SERVICE_TYPES.has(className) ? className : "Instance";
  }
  if (name === "Connect" || name === "Once") {
    return "RBXScriptConnection";
  }
  return undefined;
}

export function callbackParamsFor(expression: Expression): string[] | undefined {
  if (expression.kind === "method-call" && CALLBACK_METHODS.has(expression.name)) {
    return callbackParamsFor(expression.object);
  }
  if (expression.kind === "property") {
    return EVENT_PARAMS[expression.name];
  }
  if (expression.kind === "call" && expression.callee.kind === "property" && expression.callee.name === "GetPropertyChangedSignal") {
    return ["property"];
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
