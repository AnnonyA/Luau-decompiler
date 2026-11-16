import type { Expression } from "../ast/Ast.js";
import { isValidIdentifier } from "./Naming.js";

/**
 * Deterministic naming evidence: what an initializer or a use says about the
 * role of a binding. Every rule reads the expression as written; none of them
 * moves, adds or removes an evaluation. A rule that finds nothing returns
 * undefined and the caller falls back to a neutral name.
 */

export interface InitializerContext {
  /** Chunk-level handles keep the PascalCase of the instance they name. */
  atRoot: boolean;
  /** Inside a `function T:method()` body, where `self` is already bound. */
  inMethod: boolean;
  /** Name already inferred for a local binding, if any. */
  nameOf: (identifier: string) => string | undefined;
}

/** `TextLabel` -> `textLabel`, `UIListLayout` -> `uiListLayout`, `CFrame` -> `cframe`, `ID` -> `id`. */
export function lowerCamel(name: string): string {
  if (name.length === 0 || !/^[A-Z]/.test(name)) return name;
  const special = /^(CFrame|UDim)(.*)$/.exec(name);
  if (special) return special[1]!.toLowerCase() + special[2]!;
  const run = /^[A-Z]+/.exec(name)![0];
  if (run.length === name.length) return name.toLowerCase();
  if (run.length === 1) return run.toLowerCase() + name.slice(1);
  // `HTTPService`: the last capital of the run starts the next word.
  const next = name[run.length]!;
  const keep = /[a-z]/.test(next) ? 1 : 0;
  return run.slice(0, run.length - keep).toLowerCase() + name.slice(run.length - keep);
}

const VERB_PREFIX = /^(?:get|find|create|make|build|compute|calculate|load|fetch|read|parse|resolve|ensure|clone|new|generate|pick|select|lookup|request|query|to|as)(?=[A-Z])/i;
const PREDICATE_PREFIX = /^(?:is|has|can|should)(?=[A-Z])/;
const QUALIFIER = /(?:From|With|By|On|Of|For|In|At)[A-Z].*$/;

/** Calls made for their effect say nothing about the value they return. */
const ACTION_VERBS = new Set([
  "play", "stop", "pause", "resume", "destroy", "fire", "emit", "set", "add", "remove", "update", "connect",
  "disconnect", "insert", "clear", "send", "invoke", "run", "start", "init", "initialize", "apply", "call", "push",
  "pop", "print", "warn", "wait", "spawn", "delay", "defer", "kick", "save", "write", "show", "hide", "toggle",
  "open", "close", "enable", "disable", "reset", "refresh", "render", "register", "bind", "unbind", "build", "make",
  "create", "new", "get", "find", "load", "execute", "process", "handle", "dispatch", "trigger", "notify", "log",
  "assert", "error", "check", "validate", "setup", "cleanup", "teardown", "mount", "unmount", "attach", "detach",
  "enter", "leave", "exit", "step", "tick", "flush", "commit", "release", "lock", "unlock", "move", "teleport",
]);

const RESULT_OF_VERB: Record<string, string> = {
  merge: "merged", clone: "clone", copy: "copy", sort: "sorted", filter: "filtered", map: "mapped",
  parse: "parsed", format: "formatted", fetch: "fetched", load: "loaded", split: "parts", join: "joined", concat: "joined", trim: "trimmed",
  round: "rounded", clamp: "clamped", lerp: "lerped", freeze: "frozen", reverse: "reversed", shuffle: "shuffled",
  flatten: "flattened", encode: "encoded", decode: "decoded", serialize: "serialized", deserialize: "deserialized",
  compress: "compressed", decompress: "decompressed", normalize: "normalized", resolve: "resolved",
  wrap: "wrapped", unwrap: "unwrapped", compute: "computed", calculate: "calculated", measure: "measured",
  convert: "converted", scale: "scaled", rotate: "rotated", translate: "translated", transform: "transformed",
  interpolate: "interpolated", invert: "inverted", combine: "combined", reduce: "reduced", choose: "chosen",
};

const TRANSPARENT_MATH = new Set(["floor", "ceil", "round", "abs", "sqrt", "rad", "deg", "sign", "clamp", "min", "max"]);
const CONSTRUCTORS = /^(?:new|from[A-Z]\w*|Angles|lookAt|lookAlong|fromRGB|fromHSV|fromHex|identity|zero|one)$/;
const NAMESPACES = new Set(["math", "string", "table", "os", "bit32", "utf8", "coroutine", "task", "debug", "buffer", "vector"]);

function noun(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/^_+/, "");
  const name = lowerCamel(cleaned);
  return isValidIdentifier(name) && name.length > 1 ? name : undefined;
}

function stringArgument(expression: Expression | undefined): string | undefined {
  return expression?.kind === "literal" && typeof expression.value === "string" && isValidIdentifier(expression.value)
    ? expression.value : undefined;
}

/** `GetPlayerFromCharacter` -> `player`, `CreatePlayer` -> `player`, `orientation` -> `orientation`. */
function nounFromMember(member: string): string | undefined {
  const predicate = member.replace(PREDICATE_PREFIX, "");
  if (predicate !== member) return noun(predicate);
  const stripped = member.replace(VERB_PREFIX, "");
  if (stripped !== member) return noun(stripped.replace(QUALIFIER, "") || stripped);
  const lower = member.toLowerCase();
  if (RESULT_OF_VERB[lower]) return RESULT_OF_VERB[lower];
  if (ACTION_VERBS.has(lower)) return undefined;
  return member.length >= 3 ? noun(member) : undefined;
}

function typeName(base: string): string | undefined {
  return noun(base);
}

/** A bare function name is a noun only behind a verb: `getOwnPlot` -> `ownPlot`, `isReady` -> `ready`. */
function nounFromFunctionName(name: string): string | undefined {
  const predicate = name.replace(PREDICATE_PREFIX, "");
  if (predicate !== name) return noun(predicate);
  const stripped = name.replace(VERB_PREFIX, "");
  return stripped !== name ? noun(stripped.replace(QUALIFIER, "") || stripped) : undefined;
}

function rootIdentifier(expression: Expression): string | undefined {
  let node: Expression = expression;
  for (;;) {
    if (node.kind === "identifier") return node.name;
    if (node.kind === "property" || node.kind === "method-call") node = node.object;
    else if (node.kind === "index") node = node.table;
    else if (node.kind === "paren") node = node.expression;
    else return undefined;
  }
}

/** The role an initializer gives the local it defines. */
export function nameFromInitializer(expression: Expression | undefined, context: InitializerContext): string | undefined {
  if (!expression) return undefined;
  const recurse = (inner: Expression | undefined): string | undefined => nameFromInitializer(inner, context);
  const handle = (raw: string): string | undefined => (context.atRoot ? (isValidIdentifier(raw) ? raw : undefined) : noun(raw));
  switch (expression.kind) {
    case "paren":
      return recurse(expression.expression);
    case "identifier":
      return context.nameOf(expression.name);
    case "unary":
      if (expression.op === "#") return "count";
      return expression.op === "-" ? recurse(expression.argument) : undefined;
    case "binary":
      if (expression.op === "or") {
        // A default keeps the role of what it defaults; two competing reads name nothing.
        const left = recurse(expression.left);
        if (expression.right.kind === "literal" || expression.right.kind === "table") return left;
        const right = recurse(expression.right);
        return left === right || right === undefined ? left : undefined;
      }
      if (expression.op === "and") {
        // `x and x.Field`: the guard and the lookup name the same binding.
        const guard = expression.left;
        return guard.kind === "identifier" && rootIdentifier(expression.right) === guard.name ? recurse(expression.right) : undefined;
      }
      return undefined;
    case "if-expr":
      return recurse(expression.consequent) ?? recurse(expression.alternate);
    case "property":
      if (!isValidIdentifier(expression.name)) return undefined;
      if (expression.name === "LocalPlayer") return "LocalPlayer";
      return lowerCamel(expression.name);
    case "index": {
      const key = stringArgument(expression.key);
      if (key) return handle(key);
      const collection = recurse(expression.table);
      const element = collection ? singular(collection) : undefined;
      return element && element !== collection ? element : undefined;
    }
    case "method-call":
      return nameFromMethodCall(expression, context, handle, recurse);
    case "call":
      return nameFromCall(expression, context, recurse);
    default:
      return undefined;
  }
}

function nameFromMethodCall(
  expression: Extract<Expression, { kind: "method-call" }>,
  context: InitializerContext,
  handle: (raw: string) => string | undefined,
  recurse: (inner: Expression | undefined) => string | undefined,
): string | undefined {
  const method = expression.name;
  const first = stringArgument(expression.args[0]);
  if (method === "GetService") return first;
  if (/^(?:FindFirst|WaitFor)/.test(method)) return first ? handle(first) : "child";
  if (method === "GetAttribute") return first ? noun(first) : "attribute";
  if (method === "Connect" || method === "Once" || method === "ConnectParallel" || method === "connect") return "connection";
  if (method === "LoadAnimation") return "track";
  if (method === "Clone") return "clone";
  if (method === "Raycast") return "raycastResult";
  if (method === "Create" && recurse(expression.object) === "TweenService") return "tween";
  if (method === "Create") return "tween";
  if (method === "lower" || method === "upper" || method === "sub" || method === "gsub") return recurse(expression.object);
  if (method === "split") return "parts";
  if (method === "new" || method === "New") return first ? noun(first) : recurse(expression.object);
  if (method === "IsA" || method === "IsDescendantOf" || method === "IsAncestorOf") return undefined;
  return nounFromMember(method);
}

function nameFromCall(
  expression: Extract<Expression, { kind: "call" }>,
  context: InitializerContext,
  recurse: (inner: Expression | undefined) => string | undefined,
): string | undefined {
  const { callee, args } = expression;
  if (callee.kind === "identifier") {
    switch (callee.name) {
      case "require": return moduleName(args[0]);
      case "tostring": case "tonumber": return recurse(args[0]);
      case "typeof": case "type": return "typeName";
      case "tick": case "time": return "now";
      case "getmetatable": return "metatable";
      case "setmetatable": return context.atRoot ? undefined : context.inMethod ? "object" : "self";
      case "select": return args[0]?.kind === "literal" && args[0].value === "#" ? "count" : undefined;
      case "pcall": case "xpcall": return "success";
      default: return nounFromFunctionName(callee.name);
    }
  }
  if (callee.kind !== "property") return undefined;
  const base = callee.object.kind === "identifier" ? callee.object.name : undefined;
  const member = callee.name;
  if (base === "Instance" && member === "new") return noun(stringArgument(args[0])) ?? "instance";
  if (base === "os" && (member === "clock" || member === "time")) return "now";
  if (base === "math" && TRANSPARENT_MATH.has(member)) return recurse(args[0]);
  if (base === "table" && member === "find") return "index";
  if (base === "table" && member === "pack") return "packed";
  if (base === "table" && member === "clone") return recurse(args[0]) ?? "clone";
  if (base === "string" && member === "split") return "parts";
  if (base === "string" && (member === "lower" || member === "upper" || member === "sub" || member === "gsub")) return recurse(args[0]);
  if (base === "task" && member === "wait") return "elapsed";
  if ((base === "task" && (member === "spawn" || member === "defer" || member === "delay")) ||
      (base === "coroutine" && (member === "create" || member === "running"))) return "thread";
  if (base && NAMESPACES.has(base)) return undefined;
  if (base && /^[A-Z]/.test(base) && CONSTRUCTORS.test(member)) return typeName(base);
  if (member === "new") return recurse(callee.object) ?? (base ? noun(base) : undefined);
  return nounFromMember(member);
}

function moduleName(path: Expression | undefined): string | undefined {
  if (path?.kind === "property" && isValidIdentifier(path.name)) return path.name;
  if (path?.kind === "index") return stringArgument(path.key);
  if (path?.kind === "method-call") return stringArgument(path.args[0]);
  return undefined;
}

// ----------------------------------------------------------------- arguments

const FUNCTION_SLOTS: Record<string, Array<string | undefined>> = {
  "math.clamp": ["value", "min", "max"],
  "task.wait": ["duration"],
  "task.delay": ["duration", "callback"],
  "task.spawn": ["callback"],
  "task.defer": ["callback"],
  "coroutine.wrap": ["callback"],
  "coroutine.create": ["callback"],
  "string.format": ["formatString"],
  "table.insert": ["list"],
  "table.remove": ["list"],
  "table.sort": ["list"],
  "table.concat": ["list"],
  "table.find": ["list"],
  "table.clear": ["list"],
  "table.unpack": ["list"],
  "Instance.new": ["className", "parent"],
  "TweenInfo.new": ["duration"],
  ipairs: ["list"],
  unpack: ["list"],
  error: ["message"],
  require: ["moduleScript"],
  pcall: ["callback"],
  xpcall: ["callback"],
};

const METHOD_SLOTS: Record<string, Array<string | undefined>> = {
  FindFirstChild: ["childName"],
  WaitForChild: ["childName"],
  GetAttribute: ["attributeName"],
  FireClient: ["player"],
  InvokeClient: ["player"],
  GetPlayerFromCharacter: ["character"],
  IsDescendantOf: ["ancestor"],
  IsAncestorOf: ["descendant"],
  LoadAnimation: ["animation"],
  PivotTo: ["cframe"],
  SetPrimaryPartCFrame: ["cframe"],
  MoveTo: ["position"],
  IsA: ["className"],
  FindFirstChildOfClass: ["className"],
  FindFirstChildWhichIsA: ["className"],
  FindFirstAncestorOfClass: ["className"],
  FindFirstAncestorWhichIsA: ["className"],
  GetPropertyChangedSignal: ["propertyName"],
  FindFirstAncestor: ["ancestorName"],
  GetService: ["serviceName"],
  JSONDecode: ["json"],
  GetTagged: ["tag"],
  Raycast: ["origin", "direction", "raycastParams"],
  Kick: ["message"],
};

/** The name of the parameter slot a bare argument fills in a known API. */
export function argumentSlot(call: Extract<Expression, { kind: "call" | "method-call" }>, index: number): string | undefined {
  if (call.kind === "method-call") {
    if (call.name === "Create" && call.args.length === 3) return ["instance", "tweenInfo", "goal"][index];
    return METHOD_SLOTS[call.name]?.[index];
  }
  const callee = call.callee;
  const path = callee.kind === "identifier" ? callee.name
    : callee.kind === "property" && callee.object.kind === "identifier" ? `${callee.object.name}.${callee.name}` : undefined;
  return path ? FUNCTION_SLOTS[path]?.[index] : undefined;
}

export const INSTANCE_METHODS = new Set([
  "FindFirstChild", "FindFirstChildOfClass", "FindFirstChildWhichIsA", "FindFirstAncestor", "WaitForChild",
  "GetChildren", "GetDescendants", "GetPivot", "PivotTo", "Clone", "Destroy", "GetAttribute", "SetAttribute",
  "GetFullName", "IsDescendantOf", "ScaleTo", "GetBoundingBox", "IsA", "HasTag", "AddTag", "RemoveTag", "GetTags",
  "IsAncestorOf", "GetPropertyChangedSignal", "FindFirstAncestorOfClass", "FindFirstAncestorWhichIsA",
  "ClearAllChildren", "GetExtentsSize", "GetAttributes",
]);

export const STRING_METHODS = new Set(["sub", "gsub", "gmatch", "match", "find", "lower", "upper", "split", "rep", "byte", "len", "format"]);

const INSTANCE_PROPERTIES = new Set([
  "Name", "ClassName", "Position", "CFrame", "Size", "Anchored", "Transparency", "Visible", "Enabled", "Color",
  "Material", "CanCollide", "Text", "Adornee", "Parent", "Orientation", "Rotation", "Velocity", "Massless",
  "CanQuery", "CanTouch", "PrimaryPart", "Archivable",
]);

/** Field keys that describe every value and therefore name none. */
const VAGUE_KEYS = new Set(["value", "val", "v", "data", "item", "key", "index", "self", "type", "result", "arg", "n"]);

export function nameFromFieldKey(key: string): string | undefined {
  const name = noun(key.replace(/\d+$/, ""));
  return name && !VAGUE_KEYS.has(name) ? name : undefined;
}

export interface UseSummary {
  fields: Set<string>;
  fieldWrites: number;
  instanceMethod: boolean;
  stringMethod: boolean;
  otherMethod: boolean;
  called: boolean;
  indexedByNumber: boolean;
  measured: boolean;
  iterated: boolean;
  defaultsToTable: boolean;
  disconnects: boolean;
}

export function emptyUseSummary(): UseSummary {
  return {
    fields: new Set(), fieldWrites: 0, instanceMethod: false, stringMethod: false, otherMethod: false, called: false,
    indexedByNumber: false, measured: false, iterated: false, defaultsToTable: false, disconnects: false,
  };
}

/** A role from how a binding is used, strongest evidence first. */
export function nameFromUses(uses: UseSummary): string | undefined {
  const { fields } = uses;
  if (fields.has("Character") || (fields.has("UserId") && fields.has("DisplayName"))) return "player";
  if (fields.has("KeyCode") || fields.has("UserInputType")) return "input";
  if (uses.disconnects) return "connection";
  if (uses.instanceMethod) return "instance";
  const instanceFields = [...fields].filter((field) => INSTANCE_PROPERTIES.has(field)).length;
  if (fields.has("ClassName") || (fields.has("Parent") && instanceFields >= 2) ||
      (fields.has("CFrame") && (fields.has("Position") || fields.has("Size")))) return "instance";
  if (uses.stringMethod) return "text";
  if (uses.defaultsToTable) return "options";
  if (uses.called && fields.size === 0 && !uses.otherMethod) return "callback";
  if ((uses.measured || uses.indexedByNumber) && fields.size === 0 && !uses.otherMethod) return "list";
  if (uses.iterated && fields.size === 0 && !uses.otherMethod) return "items";
  if (uses.otherMethod && fields.size < 3) return "object";
  if (fields.size >= 3) return uses.fieldWrites > 0 ? "state" : "data";
  return undefined;
}

// ------------------------------------------------------------------- plurals

const IRREGULAR_SINGULAR: Record<string, string> = {
  children: "child", people: "person", indices: "index", vertices: "vertex", matrices: "matrix", feet: "foot",
  teeth: "tooth", mice: "mouse", geese: "goose", descendants: "descendant",
};
const NOT_PLURAL = new Set(["status", "data", "class", "props", "series", "axis", "radius", "index", "canvas", "bus", "alias", "this", "is", "has", "pos", "os"]);

/** `players` -> `player`, `entries` -> `entry`, `modelsByPlayer` -> `model`, `pointList` -> `point`. */
export function singular(name: string): string {
  const by = /^(.+?)By[A-Z]/.exec(name);
  if (by) return singular(by[1]!);
  const container = /^(.+?)(?:List|Array|Map|Dict|Lookup|Registry|Table|Set)$/.exec(name);
  if (container) return container[1]!;
  const lower = name.toLowerCase();
  if (NOT_PLURAL.has(lower)) return name;
  const tail = /[A-Z]?[a-z]+$/.exec(name)?.[0];
  if (tail && IRREGULAR_SINGULAR[tail.toLowerCase()]) {
    const replacement = IRREGULAR_SINGULAR[tail.toLowerCase()]!;
    const cased = /^[A-Z]/.test(tail) ? replacement[0]!.toUpperCase() + replacement.slice(1) : replacement;
    return name.slice(0, name.length - tail.length) + cased;
  }
  if (/[^aeiou]ies$/.test(name) && name.length > 4) return name.slice(0, -3) + "y";
  if (/(?:ses|xes|zes|ches|shes)$/.test(name)) return name.slice(0, -2);
  if (/[^siu]s$/.test(name) && name.length > 2) return name.slice(0, -1);
  return name;
}

export function plural(name: string): string {
  if (singular(name) !== name || NOT_PLURAL.has(name.toLowerCase())) return name;
  if (/child$/i.test(name)) return name + "ren";
  if (/[^aeiou]y$/.test(name)) return name.slice(0, -1) + "ies";
  if (/(?:s|x|z|ch|sh)$/.test(name)) return name + "es";
  return name + "s";
}
