export class BytecodeError extends Error {
  readonly code: string;
  readonly offset?: number;

  constructor(code: string, message: string, offset?: number) {
    super(offset === undefined ? message : `${message} (offset ${offset})`);
    this.name = "BytecodeError";
    this.code = code;
    this.offset = offset;
  }
}
