import { LBC_VERSION_TARGET } from "./BytecodeProfile.js";
import { ConstantTag, type Opcode, encodeAbc, encodeAd, encodeE } from "./Opcode.js";

export interface WrittenLocal {
  name: string;
  startPc: number;
  endPc: number;
  register: number;
}

export interface WrittenPrototype {
  maxStackSize: number;
  numParams: number;
  numUpvalues: number;
  isVararg?: boolean;
  flags?: number;
  typeInfo?: Uint8Array;
  instructions: number[];
  constants?: WrittenConstant[];
  children?: WrittenPrototype[];
  lineDefined?: number;
  debugName?: string;
  locals?: WrittenLocal[];
  upvalueNames?: string[];
}

export type WrittenConstant =
  | { kind: "nil" }
  | { kind: "boolean"; value: boolean }
  | { kind: "number"; value: number }
  | { kind: "string"; value: string }
  | { kind: "import"; path: string[] }
  | { kind: "table"; keys: number[] }
  | { kind: "tableWithConstants"; entries: Array<{ key: number; value: number }> }
  | { kind: "closure"; protoId: number }
  | { kind: "vector"; x: number; y: number; z: number; w?: number }
  | { kind: "integer"; value: bigint };

export interface WriteOptions {
  version?: number;
  typesVersion?: number;
}

class ByteSink {
  private readonly chunks: number[] = [];

  get bytes(): Uint8Array {
    return Uint8Array.from(this.chunks);
  }

  u8(value: number): void {
    this.chunks.push(value & 0xff);
  }

  u32(value: number): void {
    this.u8(value);
    this.u8(value >>> 8);
    this.u8(value >>> 16);
    this.u8(value >>> 24);
  }

  i32(value: number): void {
    this.u32(value);
  }

  f32(value: number): void {
    const buffer = new ArrayBuffer(4);
    new DataView(buffer).setFloat32(0, value, true);
    this.chunks.push(...new Uint8Array(buffer));
  }

  f64(value: number): void {
    const buffer = new ArrayBuffer(8);
    new DataView(buffer).setFloat64(0, value, true);
    this.chunks.push(...new Uint8Array(buffer));
  }

  varint(value: number): void {
    let rest = value >>> 0;
    while (rest >= 0x80) {
      this.u8((rest & 0x7f) | 0x80);
      rest >>>= 7;
    }
    this.u8(rest);
  }

  varint64(value: bigint): void {
    let rest = value;
    while (rest >= 0x80n) {
      this.u8(Number(rest & 0x7fn) | 0x80);
      rest >>= 7n;
    }
    this.u8(Number(rest));
  }

  raw(bytes: Uint8Array): void {
    this.chunks.push(...bytes);
  }
}

export function writeBytecode(main: WrittenPrototype, options: WriteOptions = {}): Uint8Array {
  const version = options.version ?? LBC_VERSION_TARGET;
  const typesVersion = options.typesVersion ?? (version >= 4 ? 1 : 0);
  const strings: string[] = [];
  const stringIndex = new Map<string, number>();

  const intern = (value: string): number => {
    const existing = stringIndex.get(value);
    if (existing !== undefined) {
      return existing;
    }
    strings.push(value);
    stringIndex.set(value, strings.length);
    return strings.length;
  };

  const prototypes: WrittenPrototype[] = [];
  const collect = (proto: WrittenPrototype): number => {
    for (const child of proto.children ?? []) {
      collect(child);
    }
    if (proto.debugName) {
      intern(proto.debugName);
    }
    for (const local of proto.locals ?? []) {
      intern(local.name);
    }
    for (const name of proto.upvalueNames ?? []) {
      intern(name);
    }
    for (const constant of proto.constants ?? []) {
      if (constant.kind === "string") {
        intern(constant.value);
      }
      if (constant.kind === "import") {
        for (const part of constant.path) {
          intern(part);
        }
      }
    }
    prototypes.push(proto);
    return prototypes.length - 1;
  };

  const mainId = collect(main);
  const sink = new ByteSink();
  sink.u8(version);
  if (version >= 4) {
    sink.u8(typesVersion);
  }
  sink.varint(strings.length);
  for (const value of strings) {
    const encoded = new TextEncoder().encode(value);
    sink.varint(encoded.length);
    sink.raw(encoded);
  }
  if (typesVersion === 3) {
    sink.u8(0);
  }

  const childIds = new Map<WrittenPrototype, number[]>();
  const assigned = new Map<WrittenPrototype, number>();
  prototypes.forEach((proto, index) => assigned.set(proto, index));
  for (const proto of prototypes) {
    childIds.set(
      proto,
      (proto.children ?? []).map((child) => {
        const id = assigned.get(child);
        if (id === undefined) {
          throw new Error("unassigned child prototype");
        }
        return id;
      }),
    );
  }

  sink.varint(prototypes.length);
  for (const proto of prototypes) {
    writePrototype(sink, proto, intern, childIds.get(proto) ?? [], version, typesVersion);
  }
  sink.varint(mainId);
  return sink.bytes;
}

function writePrototype(
  sink: ByteSink,
  proto: WrittenPrototype,
  intern: (value: string) => number,
  children: number[],
  version: number,
  typesVersion: number,
): void {
  sink.u8(proto.maxStackSize);
  sink.u8(proto.numParams);
  sink.u8(proto.numUpvalues);
  sink.u8(proto.isVararg ? 1 : 0);
  if (version >= 4) {
    sink.u8(proto.flags ?? 0);
    if (typesVersion >= 1) {
      const typeInfo = proto.typeInfo ?? new Uint8Array();
      sink.varint(typeInfo.length);
      sink.raw(typeInfo);
    }
  }
  sink.varint(proto.instructions.length);
  for (const word of proto.instructions) {
    sink.u32(word);
  }
  const constants = proto.constants ?? [];
  sink.varint(constants.length);
  for (const constant of constants) {
    writeConstant(sink, constant, intern, constants);
  }
  sink.varint(children.length);
  for (const child of children) {
    sink.varint(child);
  }
  sink.varint(proto.lineDefined ?? 0);
  sink.varint(proto.debugName ? intern(proto.debugName) : 0);
  sink.u8(0);
  const hasDebug = (proto.locals?.length ?? 0) > 0 || (proto.upvalueNames?.length ?? 0) > 0;
  sink.u8(hasDebug ? 1 : 0);
  if (hasDebug) {
    const locals = proto.locals ?? [];
    sink.varint(locals.length);
    for (const local of locals) {
      sink.varint(intern(local.name));
      sink.varint(local.startPc);
      sink.varint(local.endPc);
      sink.u8(local.register);
    }
    const upvalues = proto.upvalueNames ?? [];
    sink.varint(upvalues.length);
    for (const name of upvalues) {
      sink.varint(intern(name));
    }
  }
}

function writeConstant(
  sink: ByteSink,
  constant: WrittenConstant,
  intern: (value: string) => number,
  all: WrittenConstant[],
): void {
  switch (constant.kind) {
    case "nil":
      sink.u8(ConstantTag.NIL);
      break;
    case "boolean":
      sink.u8(ConstantTag.BOOLEAN);
      sink.u8(constant.value ? 1 : 0);
      break;
    case "number":
      sink.u8(ConstantTag.NUMBER);
      sink.f64(constant.value);
      break;
    case "string":
      sink.u8(ConstantTag.STRING);
      sink.varint(intern(constant.value));
      break;
    case "import": {
      sink.u8(ConstantTag.IMPORT);
      const indexes = constant.path.map((part) => {
        const index = all.findIndex((entry) => entry.kind === "string" && entry.value === part);
        if (index < 0) {
          throw new Error(`import path part "${part}" is not present as a string constant`);
        }
        return index;
      });
      sink.u32(packImport(indexes));
      break;
    }
    case "table":
      sink.u8(ConstantTag.TABLE);
      sink.varint(constant.keys.length);
      for (const key of constant.keys) {
        sink.varint(key);
      }
      break;
    case "tableWithConstants":
      sink.u8(ConstantTag.TABLE_WITH_CONSTANTS);
      sink.varint(constant.entries.length);
      for (const entry of constant.entries) {
        sink.varint(entry.key);
        sink.i32(entry.value);
      }
      break;
    case "closure":
      sink.u8(ConstantTag.CLOSURE);
      sink.varint(constant.protoId);
      break;
    case "vector":
      sink.u8(ConstantTag.VECTOR);
      sink.f32(constant.x);
      sink.f32(constant.y);
      sink.f32(constant.z);
      sink.f32(constant.w ?? 0);
      break;
    case "integer": {
      sink.u8(ConstantTag.INTEGER);
      const negative = constant.value < 0n;
      sink.u8(negative ? 1 : 0);
      sink.varint64(negative ? -constant.value : constant.value);
      break;
    }
  }
}

export function packImport(indexes: number[]): number {
  if (indexes.length < 1 || indexes.length > 3) {
    throw new Error("import path must have 1-3 components");
  }
  let packed = indexes.length << 30;
  packed |= (indexes[0]! & 1023) << 20;
  if (indexes[1] !== undefined) {
    packed |= (indexes[1] & 1023) << 10;
  }
  if (indexes[2] !== undefined) {
    packed |= indexes[2] & 1023;
  }
  return packed >>> 0;
}

export function abc(op: Opcode, a = 0, b = 0, c = 0): number {
  return encodeAbc(op, a, b, c);
}

export function ad(op: Opcode, a = 0, d = 0): number {
  return encodeAd(op, a, d);
}

export function e(op: Opcode, value = 0): number {
  return encodeE(op, value);
}

export function words(...values: number[]): number[] {
  return values;
}
