import { describe, expect, it } from "vitest";
import { decodeBytecode } from "../src/decode/Decoder.ts";
import { NameAllocator, parameterNames } from "../src/reconstruct/Naming.ts";
import { reconstructFunction } from "../src/reconstruct/Reconstructor.ts";
import { ad, compile, Opcode, proto, ret } from "./helpers.ts";

function decoded(partial: Parameters<typeof proto>[0]) {
  const { module } = decodeBytecode(compile(proto(partial)), { opcodeEncoding: "official" });
  return { module, prototype: module.prototypes[module.mainProtoId]! };
}

describe("Luau function parameter naming", () => {
  it("uses consecutive arg0, arg1, arg2 for unnamed parameters", () => {
    const { prototype } = decoded({ numParams: 3, instructions: [ret()] });
    expect(parameterNames(prototype, new NameAllocator())).toEqual(["arg0", "arg1", "arg2"]);
  });

  it("uses arg for a single unnamed parameter and no names for none", () => {
    const single = decoded({ numParams: 1, instructions: [ret()] });
    const empty = decoded({ numParams: 0, instructions: [ret()] });
    expect(parameterNames(single.prototype, new NameAllocator())).toEqual(["arg"]);
    expect(parameterNames(empty.prototype, new NameAllocator())).toEqual([]);
  });

  it("does not steal a future local name when a parameter register is reused", () => {
    const { prototype } = decoded({
      numParams: 2,
      instructions: [ad(Opcode.LOADN, 2, 5), ret()],
      locals: [{ name: "unrelated", startPc: 1, endPc: 2, register: 0 }],
    });
    expect(parameterNames(prototype, new NameAllocator())).toEqual(["arg0", "arg1"]);
  });

  it("retains valid entry-live debug names and sanitizes collisions", () => {
    const { prototype } = decoded({
      numParams: 3,
      instructions: [ret()],
      locals: [
        { name: "player", startPc: 0, endPc: 1, register: 0 },
        { name: "player", startPc: 0, endPc: 1, register: 1 },
        { name: "end", startPc: 0, endPc: 1, register: 2 },
      ],
    });
    expect(parameterNames(prototype, new NameAllocator())).toEqual(["player", "player2", "end_"]);
  });

  it("reserves generated names without overwriting names already in use", () => {
    const { prototype } = decoded({ numParams: 2, instructions: [ret()] });
    const allocator = new NameAllocator(["arg0"]);
    expect(parameterNames(prototype, allocator)).toEqual(["arg02", "arg1"]);
  });

  it("uses the shared parameter naming logic during actual reconstruction", () => {
    const { module, prototype } = decoded({
      numParams: 5,
      instructions: [ret()],
    });
    const reconstructed = reconstructFunction(module, prototype);
    expect(reconstructed.params).toEqual(["value", "index", "count", "options", "arg4"]);
  });

  it("keeps entry-live debug names in the reconstructed function", () => {
    const { module, prototype } = decoded({
      numParams: 2,
      instructions: [ret()],
      locals: [
        { name: "first", startPc: 0, endPc: 1, register: 0 },
        { name: "second", startPc: 0, endPc: 1, register: 1 },
      ],
    });
    expect(reconstructFunction(module, prototype).params).toEqual(["first", "second"]);
  });
});
