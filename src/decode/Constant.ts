export type LuauConstant =
  | { kind: "nil" }
  | { kind: "boolean"; value: boolean }
  | { kind: "number"; value: number }
  | { kind: "string"; value: string; stringId: number }
  | { kind: "import"; id: number; path: string[] }
  | { kind: "table"; keys: number[] }
  | { kind: "tableWithConstants"; entries: Array<{ key: number; value: number }> }
  | { kind: "closure"; protoId: number }
  | { kind: "vector"; x: number; y: number; z: number; w: number; precise: boolean }
  | { kind: "integer"; value: bigint }
  | { kind: "classShape"; classNameId: number; members: number[] };

export function constantAsLuauLiteral(constant: LuauConstant): string | undefined {
  switch (constant.kind) {
    case "nil":
      return "nil";
    case "boolean":
      return constant.value ? "true" : "false";
    case "number":
      return formatNumber(constant.value);
    case "integer":
      return constant.value.toString();
    case "string":
      return quoteLuauString(constant.value);
    case "vector":
      return `vector.create(${formatNumber(constant.x)}, ${formatNumber(constant.y)}, ${formatNumber(constant.z)})`;
    default:
      return undefined;
  }
}

export function formatNumber(value: number): string {
  if (Number.isNaN(value)) {
    return "(0/0)";
  }
  if (!Number.isFinite(value)) {
    return value > 0 ? "(1/0)" : "(-1/0)";
  }
  if (Object.is(value, -0)) {
    return "-0";
  }
  return Number.isInteger(value) ? value.toString() : value.toString();
}

export function quoteLuauString(value: string): string {
  let out = '"';
  for (const char of value) {
    const code = char.charCodeAt(0);
    switch (char) {
      case "\\":
        out += "\\\\";
        break;
      case '"':
        out += '\\"';
        break;
      case "\n":
        out += "\\n";
        break;
      case "\r":
        out += "\\r";
        break;
      case "\t":
        out += "\\t";
        break;
      case "\0":
        out += "\\0";
        break;
      default:
        if (code < 32 || code === 127) {
          out += `\\${code.toString().padStart(3, "0")}`;
        } else {
          out += char;
        }
    }
  }
  return `${out}"`;
}

export function decodeImportPath(id: number, strings: string[]): string[] {
  const count = id >>> 30;
  const ids = [(id >>> 20) & 1023, (id >>> 10) & 1023, id & 1023];
  const path: string[] = [];
  for (let i = 0; i < count; i++) {
    const index = ids[i]!;
    path.push(strings[index] ?? `k${index}`);
  }
  return path;
}
