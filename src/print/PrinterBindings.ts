import { analyzeBindings, type LexicalBinding } from "../analysis/Bindings.js";
import type { Block, FunctionDeclaration, FunctionExpression, LocalDeclaration } from "../ast/Ast.js";

export type PrintedFunction = FunctionDeclaration | FunctionExpression;

export interface PrinterBindings {
  constants: ReadonlySet<LocalDeclaration>;
  captures: ReadonlyMap<PrintedFunction, ReadonlySet<string>>;
}

/** Inspect the final AST without changing binding names or capture lifetimes. */
export function analyzePrinterBindings(root: Block, preferConst: boolean, upvalueComments: boolean): PrinterBindings {
  const constants = new Set<LocalDeclaration>();
  const captures = new Map<PrintedFunction, Set<string>>();
  if (!preferConst && !upvalueComments) return { constants, captures };

  const { bindings } = analyzeBindings(root);
  if (preferConst) {
    const declarations = new Map<LocalDeclaration, LexicalBinding[]>();
    for (const binding of bindings) {
      if (binding.declaration.kind !== "local") continue;
      const group = declarations.get(binding.declaration) ?? [];
      group.push(binding);
      declarations.set(binding.declaration, group);
    }
    for (const [declaration, group] of declarations) {
      const last = declaration.values.at(-1);
      // Match the official parser's const initializer arity check, including
      // its rejection of extra fixed initializers as well as missing ones.
      const enoughValues = declaration.values.length === declaration.names.length ||
        last?.kind === "call" || last?.kind === "method-call" || last?.kind === "vararg";
      if (enoughValues && group.length === declaration.names.length && group.every(binding => binding.writes.length === 0)) {
        constants.add(declaration);
      }
    }
  }

  if (upvalueComments) {
    const owners = new Map<Block, PrintedFunction[]>();
    const visit = (value: unknown, functions: PrintedFunction[]): void => {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) {
        value.forEach(child => visit(child, functions));
        return;
      }
      const node = value as { kind?: string };
      if (node.kind === "function-decl" || node.kind === "function-expr") {
        const fn = node as PrintedFunction;
        visit(fn.body, [...functions, fn]);
      } else {
        if (node.kind === "block") owners.set(node as Block, functions);
        Object.values(value).forEach(child => visit(child, functions));
      }
    };
    visit(root, []);
    for (const binding of bindings) {
      if (!binding.captured) continue;
      for (const reference of [...binding.reads, ...binding.writes]) {
        // Every function between declaration and use forwards this upvalue,
        // even when only its descendant actually reads or writes the binding.
        for (const fn of (owners.get(reference.scope) ?? []).slice(binding.depth)) {
          const names = captures.get(fn) ?? new Set<string>();
          names.add(binding.name);
          captures.set(fn, names);
        }
      }
    }
  }
  return { constants, captures };
}
