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
  private readonly reserved: ReadonlySet<string>;
  private readonly symbols?: NameAllocator;
  private readonly captures = new Set<string>();
  private readonly nextSuffix = new Map<string, number>();
  private readonly preferredNames: ReadonlySet<string>;
  /** Generated names of bindings whose register use proves a declared local. */
  readonly declaredLocals = new Set<string>();
  /** Suffixed name -> the name that was asked for. */
  readonly stems = new Map<string, string>();

  /** Children share the immutable module inventory, but start with fresh
   * bindings, capture reservations and suffix cursors. */
  constructor(reserved: Iterable<string> | NameAllocator = [], preferredNames: Iterable<string> = [], symbols?: NameAllocator) {
    this.symbols = reserved instanceof NameAllocator ? reserved.symbols : symbols;
    this.reserved = reserved instanceof NameAllocator ? reserved.reserved : new Set(reserved);
    this.preferredNames = reserved instanceof NameAllocator ? reserved.preferredNames : new Set(preferredNames);
  }

  /** Only names actually handed out in this function. */
  get allocated(): ReadonlySet<string> {
    return this.used;
  }

  isUsed(name: string): boolean {
    return this.used.has(name) || this.reserved.has(name) || this.captures.has(name);
  }

  protectCapture(name: string): void {
    this.captures.add(name);
  }

  reserve(name: string): string {
    // Cleanup keys scratch provenance by spelling until lexical name inference.
    // Keep these internal symbols unique while allowing true declaration names
    // to be claimed independently in each function.
    if (!this.symbols) return this.take(name);
    const symbol = this.symbols.take(name, candidate => !this.isUsed(candidate) && !this.preferredNames.has(candidate));
    this.used.add(symbol);
    const stem = this.symbols.stems.get(symbol);
    if (stem) this.stems.set(symbol, stem);
    return symbol;
  }

  /** Claim a prototype's own name, keeping other prototypes' names available. */
  claim(preferred: string): string {
    const base = sanitizeIdentifier(preferred);
    return this.take(preferred, name => name === base || !this.preferredNames.has(name));
  }

  take(preferred: string, accept: (name: string) => boolean = name => !this.preferredNames.has(name)): string {
    const base = sanitizeIdentifier(preferred);
    if (!this.isUsed(base) && accept(base)) {
      this.used.add(base);
      return base;
    }
    let suffix = this.nextSuffix.get(base) ?? 2;
    while (this.isUsed(`${base}${suffix}`) || !accept(`${base}${suffix}`)) {
      suffix += 1;
    }
    const next = `${base}${suffix}`;
    this.nextSuffix.set(base, suffix + 1);
    this.used.add(next);
    this.stems.set(next, base);
    return next;
  }

  fallback(role?: string): string {
    if (role) {
      return this.take(role);
    }
    for (const candidate of GENERIC_FALLBACKS) {
      if (!this.isUsed(candidate)) {
        return this.take(candidate);
      }
    }
    return this.take("tmp");
  }

  snapshot() {
    return {
      used: new Set(this.used),
      stems: new Map(this.stems),
      nextSuffix: new Map(this.nextSuffix),
      declaredLocals: new Set(this.declaredLocals),
      symbols: this.symbols && {
        used: new Set(this.symbols.used),
        stems: new Map(this.symbols.stems),
        nextSuffix: new Map(this.symbols.nextSuffix),
      },
    };
  }

  restore(snapshot: ReturnType<NameAllocator["snapshot"]>): void {
    if (this.symbols && snapshot.symbols) {
      this.symbols.used.clear();
      this.symbols.stems.clear();
      this.symbols.nextSuffix.clear();
      for (const name of snapshot.symbols.used) this.symbols.used.add(name);
      for (const [name, stem] of snapshot.symbols.stems) this.symbols.stems.set(name, stem);
      for (const [name, suffix] of snapshot.symbols.nextSuffix) this.symbols.nextSuffix.set(name, suffix);
    }
    this.used.clear();
    // A rollback can release earlier suffixes; a cached cursor is no longer
    // valid. Capture reservations and module names outlive every speculation.
    this.nextSuffix.clear();
    for (const [name, suffix] of snapshot.nextSuffix) this.nextSuffix.set(name, suffix);
    for (const name of snapshot.used) this.used.add(name);
    this.stems.clear();
    for (const [name, stem] of snapshot.stems) this.stems.set(name, stem);
    this.declaredLocals.clear();
    for (const name of snapshot.declaredLocals) this.declaredLocals.add(name);
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
    names.push(debug ? allocator.take(debug) : allocator.reserve(fallback(i, prototype.numParams)));
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
