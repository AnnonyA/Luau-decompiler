import type { AstNode } from "./Ast.js";

/** Clone the AST's plain object/array data without using the host call stack.
 * Keep shared nodes shared in the copy: analyses use node identity to resolve
 * references. Primitive values (including bigint, -0 and undefined) are copied
 * directly. This is an AST copy, not a general clone of arbitrary JS classes. */
export function cloneAst<T extends AstNode>(root: T): T {
  const copies = new Map<object, object>();
  const pending: Array<{ source: object; target: object }> = [];
  const copy = (source: object): object => {
    const existing = copies.get(source);
    if (existing) return existing;
    const target: object = Array.isArray(source) ? new Array(source.length) : {};
    copies.set(source, target);
    pending.push({ source, target });
    return target;
  };
  const result = copy(root);
  while (pending.length) {
    const { source, target } = pending.pop()!;
    for (const [key, value] of Object.entries(source)) {
      const child = value && typeof value === "object" ? copy(value) : value;
      if (key === "__proto__") {
        Object.defineProperty(target, key, { value: child, enumerable: true, configurable: true, writable: true });
      } else {
        (target as Record<string, unknown>)[key] = child;
      }
    }
  }
  return result as T;
}
