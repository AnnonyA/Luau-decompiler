import type { SafetyLimits } from "../safety/Limits.js";
import { BytecodeError } from "./BytecodeError.js";

export class BytecodeReader {
  readonly bytes: Uint8Array;
  readonly limits: SafetyLimits;
  offset = 0;

  constructor(bytes: Uint8Array, limits: SafetyLimits) {
    this.bytes = bytes;
    this.limits = limits;
  }

  get remaining(): number {
    return this.bytes.length - this.offset;
  }

  get atEnd(): boolean {
    return this.offset >= this.bytes.length;
  }

  private ensure(count: number): void {
    if (count < 0 || this.offset + count > this.bytes.length) {
      throw new BytecodeError("truncated", `expected ${count} more byte(s), ${this.remaining} remaining`, this.offset);
    }
  }

  u8(): number {
    this.ensure(1);
    return this.bytes[this.offset++]!;
  }

  u32(): number {
    this.ensure(4);
    const view = new DataView(this.bytes.buffer, this.bytes.byteOffset + this.offset, 4);
    const value = view.getUint32(0, true);
    this.offset += 4;
    return value;
  }

  i32(): number {
    this.ensure(4);
    const view = new DataView(this.bytes.buffer, this.bytes.byteOffset + this.offset, 4);
    const value = view.getInt32(0, true);
    this.offset += 4;
    return value;
  }

  f32(): number {
    this.ensure(4);
    const view = new DataView(this.bytes.buffer, this.bytes.byteOffset + this.offset, 4);
    const value = view.getFloat32(0, true);
    this.offset += 4;
    return value;
  }

  f64(): number {
    this.ensure(8);
    const view = new DataView(this.bytes.buffer, this.bytes.byteOffset + this.offset, 8);
    const value = view.getFloat64(0, true);
    this.offset += 8;
    return value;
  }

  varint(): number {
    let result = 0;
    let shift = 0;
    for (let i = 0; i < 5; i++) {
      const byte = this.u8();
      result |= (byte & 0x7f) << shift;
      if ((byte & 0x80) === 0) {
        return result >>> 0;
      }
      shift += 7;
    }
    throw new BytecodeError("varint", "varint exceeded 5 bytes", this.offset);
  }

  varint64(): bigint {
    let result = 0n;
    let shift = 0n;
    for (let i = 0; i < 10; i++) {
      const byte = BigInt(this.u8());
      result |= (byte & 0x7fn) << shift;
      if ((byte & 0x80n) === 0n) {
        return result;
      }
      shift += 7n;
    }
    throw new BytecodeError("varint64", "varint64 exceeded 10 bytes", this.offset);
  }

  boundedVarint(max: number, label: string): number {
    const value = this.varint();
    if (value > max) {
      throw new BytecodeError("limit", `${label} ${value} exceeds limit ${max}`, this.offset);
    }
    return value;
  }

  bytesOf(length: number): Uint8Array {
    if (length < 0 || length > this.limits.maxSingleStringBytes) {
      throw new BytecodeError("limit", `blob length ${length} exceeds limit`, this.offset);
    }
    this.ensure(length);
    const slice = this.bytes.subarray(this.offset, this.offset + length);
    this.offset += length;
    return slice;
  }

  utf8(length: number): string {
    const raw = this.bytesOf(length);
    return new TextDecoder("utf-8", { fatal: false }).decode(raw);
  }

  skipTo(absolute: number): void {
    if (absolute < this.offset || absolute > this.bytes.length) {
      throw new BytecodeError("seek", `cannot skip to ${absolute}`, this.offset);
    }
    this.offset = absolute;
  }
}
