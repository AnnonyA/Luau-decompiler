import type { Chunk } from '../ast/Ast.js';
import { analyzeBindings, replaceReferences, type LexicalBinding } from '../analysis/Bindings.js';
import { NameAllocator } from './Naming.js';
export interface NameStyleOptions {
  generatedNames?: 'readable' | 'compact';
  nameCasing?: 'preserve' | 'camelCase' | 'snake_case' | 'PascalCase';
}
export function styleLocalNames(ast: Chunk, options: NameStyleOptions = {}): Chunk {
  const compact = options.generatedNames === 'compact';
  const casing = options.nameCasing ?? 'preserve';
  if (!compact && casing === 'preserve') return ast;

  // Analyze a private copy so callers can retain the pre-rename evidence.
  // Expand shared expression objects into distinct occurrences: the same
  // spelling can resolve to different bindings at different points in the tree.
  const result = replaceReferences(ast, new Map());
  const { bindings, globals } = analyzeBindings(result.body);
  const typeNames = annotationNames(result);
  // Reserve even later declarations. A new name must not capture a reference
  // resolved before that declaration, or collide with an unchanged binding.
  const allocator = new NameAllocator([...globals, ...typeNames, ...bindings.map(b => b.name)]);
  const setters = bindings.map(declarationSetter);
  let serial = 0;
  bindings.forEach((binding, index) => {
    // Method receivers are implicit syntax. Types are opaque strings in this
    // AST, so preserve their identifiers until type expressions are modeled.
    if (binding.name === 'self' || typeNames.has(binding.name)) return;
    let preferred = binding.name;
    if (compact) {
      do { preferred = `v${++serial}`; } while (allocator.isUsed(preferred));
    } else {
      preferred = formatName(preferred, casing);
    }
    if (preferred === binding.name) return;
    const name = allocator.take(preferred);
    setters[index]!(name);
    for (const reference of [...binding.reads, ...binding.writes]) {
      if (reference.declarationRoot && reference.statement.kind === 'function-decl') {
        reference.statement.name = name + reference.statement.name.slice(binding.name.length);
      } else {
        reference.node.name = name;
      }
    }
  });
  return result;
}

function declarationSetter(binding: LexicalBinding): (name: string) => void {
  const declaration = binding.declaration;
  switch (declaration.kind) {
    case 'local':
    case 'generic-for': {
      const index = binding.declarationIndex!;
      return name => { declaration.names[index] = name; };
    }
    case 'numeric-for': return name => { declaration.name = name; };
    case 'function-decl':
      if (declaration.local && binding.scope !== declaration.body) {
        return name => { declaration.name = name; };
      }
      // Fall through: parameters belong to the function's body scope.
    case 'function-expr': {
      const index = binding.declarationIndex;
      return name => { if (index !== undefined) declaration.params[index] = name; };
    }
    default: throw new Error(`Unsupported binding declaration: ${declaration.kind}`);
  }
}

function formatName(name: string, casing: NonNullable<NameStyleOptions['nameCasing']>): string {
  if (casing === 'preserve') return name;
  const prefix = name.match(/^_*/)?.[0] ?? '';
  const words = name.slice(prefix.length)
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .split(/_+/).filter(Boolean).map(word => word.toLowerCase());
  if (!words.length) return name;
  if (casing === 'snake_case') return prefix + words.join('_');
  return prefix + words.map((word, index) => index === 0 && casing === 'camelCase'
    ? word : word[0]!.toUpperCase() + word.slice(1)).join('');
}

function annotationNames(ast: Chunk): Set<string> {
  const names = new Set<string>();
  const visit = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      if (key === 'types' || key === 'paramTypes' || key === 'returnType') {
        for (const type of Array.isArray(value) ? value : [value]) {
          if (typeof type === 'string') for (const name of type.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []) names.add(name);
        }
      } else visit(value);
    }
  };
  visit(ast);
  return names;
}
