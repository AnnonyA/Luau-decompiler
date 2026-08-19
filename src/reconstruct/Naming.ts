import type { BytecodeModule, Prototype } from "../decode/Prototype.js";
import type { LuauConstant } from "../decode/Constant.js";

const KEYWORDS = new Set([
  "and",
  "break",
  "do",
  "else",
  "elseif",
  "end",
  "false",
  "for",
  "function",
  "if",
  "in",
  "local",
  "nil",
  "not",
  "or",
  "repeat",
  "return",
  "then",
  "true",
  "until",
  "while",
  "continue",
  "export",
  "type",
]);

const GENERIC_FALLBACKS = ["value", "result", "item", "entry", "state", "data", "count", "index", "key"];

export class NameAllocator {
  private readonly used = new Set<string>();

  constructor(reserved: Iterable<string> = []) {
    for (const name of reserved) {
      this.used.add(name);
    }
  }

  isUsed(name: string): boolean {
    return this.used.has(name);
  }

  reserve(name: string): string {
    const sanitized = sanitizeIdentifier(name);
    return this.take(sanitized);
  }

  take(preferred: string): string {
    const base = sanitizeIdentifier(preferred);
    if (!this.used.has(base)) {
      this.used.add(base);
      return base;
    }
    let suffix = 2;
    while (this.used.has(`${base}${suffix}`)) {
      suffix += 1;
    }
    const next = `${base}${suffix}`;
    this.used.add(next);
    return next;
  }

  fallback(role?: string): string {
    if (role) {
      return this.take(role);
    }
    for (const candidate of GENERIC_FALLBACKS) {
      if (!this.used.has(candidate)) {
        return this.take(candidate);
      }
    }
    return this.take("tmp");
  }

  snapshot(): Set<string> {
    return new Set(this.used);
  }

  restore(snapshot: Set<string>): void {
    this.used.clear();
    for (const name of snapshot) {
      this.used.add(name);
    }
  }
}

export function sanitizeIdentifier(raw: string): string {
  let name = raw.replace(/[^A-Za-z0-9_]/g, "_");
  if (!/^[A-Za-z_]/.test(name)) {
    name = `_${name}`;
  }
  if (KEYWORDS.has(name)) {
    name = `${name}_`;
  }
  return name || "value";
}

export function isValidIdentifier(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(name) && !KEYWORDS.has(name);
}

export function debugNameAt(prototype: Prototype, register: number, pc: number): string | undefined {
  const matches = prototype.locals.filter(
    (local) => local.register === register && pc >= local.startPc && pc < local.endPc,
  );
  return matches.at(-1)?.name;
}

export function parameterNames(prototype: Prototype, allocator: NameAllocator): string[] {
  const names: string[] = [];
  for (let i = 0; i < prototype.numParams; i++) {
    const debug = prototype.locals.find((local) => local.register === i && local.startPc === 0)?.name
      ?? prototype.locals.find((local) => local.register === i)?.name;
    names.push(allocator.reserve(debug ?? `arg${i === 0 && prototype.numParams === 1 ? "" : ""}`));
  }
  return names.map((name, index) => (name === "arg" && prototype.numParams !== 1 ? allocator.take(`arg${index}`) : name));
}

export function nameFromConstant(constant: LuauConstant | undefined): string | undefined {
  if (!constant) {
    return undefined;
  }
  if (constant.kind === "string" && isValidIdentifier(constant.value)) {
    return constant.value;
  }
  if (constant.kind === "import" && constant.path.length > 0) {
    return constant.path[constant.path.length - 1];
  }
  return undefined;
}

export function nameFromGetService(args: Array<LuauConstant | undefined>): string | undefined {
  const service = args[0];
  if (service?.kind === "string" && isValidIdentifier(service.value)) {
    return service.value;
  }
  return undefined;
}

export function importExpression(module: BytecodeModule, constantIndex: number, proto: Prototype): string[] {
  const constant = proto.constants[constantIndex];
  if (constant?.kind === "import") {
    return constant.path;
  }
  return [];
}
