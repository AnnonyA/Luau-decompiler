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
  // 'type' and 'export' are contextual keywords in Luau: they remain valid
  // variable, property and method names outside type-declaration syntax.
]);

const GENERIC_FALLBACKS = ["value", "result", "item", "entry", "state", "data", "count", "index", "key"];

export class NameAllocator {
  private readonly used = new Set<string>();
  private readonly nextSuffix = new Map<string, number>();

  constructor(reserved: Iterable<string> = []) {
    for (const name of reserved) {
      this.used.add(name);
    }
  }

  isUsed(name: string): boolean {
    return this.used.has(name);
  }

  reserve(name: string): string {
    return this.take(name);
  }

  take(preferred: string): string {
    const base = sanitizeIdentifier(preferred);
    if (!this.used.has(base)) {
      this.used.add(base);
      return base;
    }
    let suffix = this.nextSuffix.get(base) ?? 2;
    while (this.used.has(`${base}${suffix}`)) {
      suffix += 1;
    }
    const next = `${base}${suffix}`;
    this.nextSuffix.set(base, suffix + 1);
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
    // A rollback can release earlier suffixes; a cached cursor is no longer
    // valid. The public snapshot remains a reusable, independent set of names.
    this.nextSuffix.clear();
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

/** Allocate parameter names from locals alive at function entry.
 * A register may later be reused by an unrelated local, whose debug name
 * must not be assigned to the original parameter.
 */
export function parameterNames(
  prototype: Prototype,
  allocator: NameAllocator,
  fallback: (index: number, total: number) => string =
    (index, total) => total === 1 ? "arg" : `arg${index}`,
): string[] {
  const names: string[] = [];
  for (let i = 0; i < prototype.numParams; i++) {
    const debug = debugNameAt(prototype, i, 0);
    names.push(allocator.reserve(debug ?? fallback(i, prototype.numParams)));
  }
  return names;
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
