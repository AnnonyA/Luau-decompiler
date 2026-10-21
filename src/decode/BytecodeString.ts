/** Luau strings are byte sequences. Valid UTF-8 remains ordinary JavaScript
 * text; invalid bytes use unpaired U+DC80..U+DCFF surrogate escapes. Those code
 * points cannot occur in valid UTF-8, so the mapping is unambiguous. Printers
 * must emit these escapes as decimal byte literals, never as replacement text. */
export function decodeByteString(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    const parts: string[] = [];
    for (let i = 0; i < bytes.length;) {
      const first = bytes[i]!;
      if (first < 0x80) {
        parts.push(String.fromCharCode(first));
        i++;
        continue;
      }
      const width = first >= 0xc2 && first <= 0xdf ? 2
        : first >= 0xe0 && first <= 0xef ? 3
        : first >= 0xf0 && first <= 0xf4 ? 4 : 0;
      let valid = width > 0 && i + width <= bytes.length;
      let point = first & (0x7f >> width);
      for (let j = 1; valid && j < width; j++) {
        const next = bytes[i + j]!;
        valid = (next & 0xc0) === 0x80;
        point = (point << 6) | (next & 0x3f);
      }
      const minimum = width === 2 ? 0x80 : width === 3 ? 0x800 : 0x10000;
      valid = valid && point >= minimum && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff);
      if (valid) {
        parts.push(String.fromCodePoint(point));
        i += width;
      } else {
        parts.push(String.fromCharCode(0xdc00 + first));
        i++;
      }
    }
    return parts.join("");
  }
}

export function escapedByte(character: string): number | undefined {
  const code = character.charCodeAt(0);
  return character.length === 1 && code >= 0xdc80 && code <= 0xdcff ? code - 0xdc00 : undefined;
}

export function encodeByteString(value: string): Uint8Array {
  const encoder = new TextEncoder();
  // Unicode mode matches unpaired surrogates, not halves of valid pairs.
  if (!/[\udc80-\udcff]/u.test(value)) return encoder.encode(value);
  const bytes: number[] = [];
  for (const character of value) {
    const raw = escapedByte(character);
    if (raw !== undefined) bytes.push(raw);
    else for (const byte of encoder.encode(character)) bytes.push(byte);
  }
  return Uint8Array.from(bytes);
}
