import type {TableField} from "../ast/Ast.js";
import type {LuauConstant} from "../decode/Constant.js";
import {isValidIdentifier} from "./Naming.js";

/** Restore a complete DUPTABLE's key order by moving only its actual preloaded
 * primitive constants. Other fields retain their identity and relative order:
 * calls, reads, closures and allocations cannot be reordered by this proof.
 * The caller must still own the private pending constructor. */
export function restoreTemplateFieldOrder(
  fields: TableField[], template: LuauConstant | undefined, constants: readonly LuauConstant[],
): TableField[] {
  if (template?.kind !== "tableWithConstants" || template.entries.length < 2 ||
      template.entries.length > 32 || fields.length !== template.entries.length) return fields;
  const byName = new Map<string, TableField>();
  for (const field of fields) {
    // These exact spellings keep the output a record-only DUPTABLE. A direct
    // anonymous/renamed function instead needs brackets to preserve debug.info.
    if (field.list || field.key || field.name === undefined || !isValidIdentifier(field.name) ||
        byName.has(field.name) || (field.value.kind === "function-expr" && field.value.debugName !== field.name)) return fields;
    byName.set(field.name, field);
  }
  const ordered: TableField[] = [], movable = new Set<TableField>(), names = new Set<string>();
  for (const entry of template.entries) {
    const key = constants[entry.key];
    if (key?.kind !== "string" || !isValidIdentifier(key.value) || names.has(key.value)) return fields;
    names.add(key.value);
    const field = byName.get(key.value);
    if (!field) return fields;
    ordered.push(field);
    const value = constants[entry.value];
    if (field.value.kind !== "literal" || !value) continue;
    const matches = value.kind === "nil" ? field.value.value === null
      : (value.kind === "string" || value.kind === "boolean" || value.kind === "number") &&
        !(value.kind === "number" && Number.isNaN(value.value)) && Object.is(field.value.value, value.value);
    if (matches) movable.add(field);
  }
  if (!movable.size) return fields;
  const before = fields.filter(field => !movable.has(field));
  const after = ordered.filter(field => !movable.has(field));
  if (before.some((field, index) => field !== after[index])) return fields;
  return ordered.some((field, index) => field !== fields[index]) ? ordered : fields;
}
