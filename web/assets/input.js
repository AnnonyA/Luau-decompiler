export const MAX_BYTES = 16 * 1024 * 1024;

export function validateSize(size) {
  if (!Number.isSafeInteger(size) || size <= 0) throw new Error("The bytecode is empty.");
  if (size > MAX_BYTES) throw new Error("Choose bytecode smaller than or equal to 16 MiB.");
}

export function decodeBase64(text) {
  // Bound the original text as well as the decoded bytes, including whitespace.
  const maxEncoded = Math.ceil(MAX_BYTES / 3) * 4;
  if (text.length > maxEncoded + 1024 * 1024) throw new Error("Base64 input exceeds the 16 MiB bytecode limit.");
  const encoded = text.replace(/\s/g, "");
  if (encoded.length > maxEncoded) throw new Error("Base64 input exceeds the 16 MiB bytecode limit.");
  if (!encoded || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 === 1 ||
      (encoded.includes("=") && encoded.length % 4 !== 0)) {
    throw new Error("Paste valid Base64 bytecode, or choose a binary file.");
  }
  let binary;
  try { binary = atob(encoded); }
  catch { throw new Error("Paste valid Base64 bytecode, or choose a binary file."); }
  validateSize(binary.length);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
