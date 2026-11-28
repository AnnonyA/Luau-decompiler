import type {FunctionDeclaration, FunctionExpression} from '../ast/Ast.js';
import {block} from '../ast/Ast.js';
import {analyzeBindings} from '../analysis/Bindings.js';
import {isValidIdentifier} from './Naming.js';

/** A return/assignment literal has no source debug name. A declaration can
 * carry the original name without another allocation, call or literal, but
 * only if its recursive binding does not capture a previously free name.
 * Inspect the whole closure, including descendant functions and parameters.
 * Callers must confine the declaration to a fresh scope, or use it as the
 * final declaration in an existing factory body. */
export function namedClosureDeclaration(fn: FunctionExpression): FunctionDeclaration | undefined {
  if (!fn.debugName || !isValidIdentifier(fn.debugName)) return undefined;
  const free = analyzeBindings(block([{kind: 'return', values: [fn]}])).globals;
  if (free.has(fn.debugName)) return undefined;
  return {kind: 'function-decl', local: true, name: fn.debugName,
    params: fn.params, paramTypes: fn.paramTypes, returnType: fn.returnType,
    isVararg: fn.isVararg, body: fn.body, line: fn.line,
    closureIdentity: fn.closureIdentity, creationSite: fn.creationSite};
}
