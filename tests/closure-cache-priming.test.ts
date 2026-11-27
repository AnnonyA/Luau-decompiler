import { describe, expect, it } from "vitest";
import { decode } from "./helpers.ts";
import { abc, ad, CaptureType, Opcode, proto, ret } from "./helpers.ts";
import {
  analyzeClosureCachePriming,
  captureIdentityForConstant,
  closureCacheKey,
  sameCaptureIdentity,
} from "../src/reconstruct/ClosureCachePriming.ts";

function conditionalFactory(first: boolean | "unknown", second = false) {
  const a = proto({ instructions: [ad(Opcode.LOADN, 0, 1), abc(Opcode.RETURN, 0, 2)] });
  const b = proto({ instructions: [ad(Opcode.LOADN, 0, 2), abc(Opcode.RETURN, 0, 2)] });
  const bound = proto({ numUpvalues: 1, instructions: [abc(Opcode.GETUPVAL, 0, 0), abc(Opcode.RETURN, 0, 2)] });
  const factory = proto({
    numParams: 1,
    isVararg: true,
    constants: [
      { kind: "closure", protoId: 0 },
      { kind: "closure", protoId: 2 },
      { kind: "closure", protoId: 1 },
    ],
    instructions: [
      // A numeric loop visits either capture A or B twice per activation.
      abc(Opcode.NEWTABLE, 1), 0,
      ad(Opcode.LOADN, 4, 1), ad(Opcode.LOADN, 2, 2), ad(Opcode.LOADN, 3, 1),
      ad(Opcode.FORNPREP, 2, 11), ad(Opcode.JUMPIFNOT, 0, 5),
      ad(Opcode.DUPCLOSURE, 5, 0), ad(Opcode.DUPCLOSURE, 6, 1), abc(Opcode.CAPTURE, CaptureType.VAL, 5),
      abc(Opcode.SETTABLE, 6, 1, 4), ad(Opcode.JUMP, 0, 4),
      ad(Opcode.DUPCLOSURE, 5, 2), ad(Opcode.DUPCLOSURE, 6, 1), abc(Opcode.CAPTURE, CaptureType.VAL, 5),
      abc(Opcode.SETTABLE, 6, 1, 4), ad(Opcode.FORNLOOP, 2, -11), abc(Opcode.RETURN, 1, 2),
    ],
  });
  return decode(proto({
    isVararg: true,
    children: [a, b, bound, factory],
    constants: [{ kind: "closure", protoId: 3 }],
    instructions: [
      ad(Opcode.DUPCLOSURE, 0, 0), abc(Opcode.MOVE, 1, 0),
      first === "unknown" ? abc(Opcode.GETVARARGS, 2, 2) : abc(Opcode.LOADB, 2, Number(first)),
      abc(Opcode.CALL, 1, 2, 2), abc(Opcode.MOVE, 1, 0), abc(Opcode.LOADB, 2, Number(second)),
      abc(Opcode.CALL, 1, 2, 2), ret(),
    ],
  })).module;
}

describe("closure constant priming prefix", () => {
  it("follows fixed local calls and numeric loops; a later miss does not replace the first capture", () => {
    const primes = analyzeClosureCachePriming(conditionalFactory(true, false));
    expect(primes.get(closureCacheKey(3, 1))).toEqual([captureIdentityForConstant(3, 0)]);
  });

  it("uses the actual first caller, including the reverse branch order", () => {
    const primes = analyzeClosureCachePriming(conditionalFactory(false, true));
    expect(primes.get(closureCacheKey(3, 1))).toEqual([captureIdentityForConstant(3, 2)]);
  });

  it("does not guess an unknown main argument or enter its unknown branch", () => {
    expect(analyzeClosureCachePriming(conditionalFactory("unknown")).has(closureCacheKey(3, 1))).toBe(false);
  });

  it("stops before environment/global reads and unknown calls", () => {
    const child = proto({ instructions: [ret()] });
    const module = decode(proto({
      children: [child],
      constants: [{ kind: "string", value: "opaque" }, { kind: "closure", protoId: 0 }],
      instructions: [abc(Opcode.GETGLOBAL, 0), 0, abc(Opcode.CALL, 0, 1, 1), ad(Opcode.DUPCLOSURE, 1, 1), ret()],
    })).module;
    expect(analyzeClosureCachePriming(module).size).toBe(0);
  });

  it("does not infer a constant capture identity for a fresh NEWCLOSURE of the same child", () => {
    const child = proto({ instructions: [ret()] });
    const bound = proto({ numUpvalues: 1, instructions: [ret()] });
    const module = decode(proto({
      children: [child, bound],
      constants: [{ kind: "closure", protoId: 1 }],
      instructions: [ad(Opcode.NEWCLOSURE, 0, 0), ad(Opcode.DUPCLOSURE, 1, 0), abc(Opcode.CAPTURE, CaptureType.VAL, 0), ret()],
    })).module;
    expect(analyzeClosureCachePriming(module).has(closureCacheKey(module.mainProtoId, 0))).toBe(false);
  });

  it("keeps equal constant keys equal across MOVE/register definitions", () => {
    const child = proto({ instructions: [ret()] });
    const bound = proto({ numUpvalues: 1, instructions: [ret()] });
    const module = decode(proto({
      children: [child, bound],
      constants: [{ kind: "closure", protoId: 0 }, { kind: "closure", protoId: 1 }],
      instructions: [
        ad(Opcode.DUPCLOSURE, 0, 0), abc(Opcode.MOVE, 1, 0),
        ad(Opcode.DUPCLOSURE, 2, 1), abc(Opcode.CAPTURE, CaptureType.VAL, 1),
        ad(Opcode.DUPCLOSURE, 3, 0), ad(Opcode.DUPCLOSURE, 4, 1), abc(Opcode.CAPTURE, CaptureType.VAL, 3), ret(),
      ],
    })).module;
    expect(analyzeClosureCachePriming(module).get(closureCacheKey(module.mainProtoId, 1)))
      .toEqual([captureIdentityForConstant(module.mainProtoId, 0)]);
    expect(sameCaptureIdentity(captureIdentityForConstant(1, 0), captureIdentityForConstant(2, 0))).toBe(false);
  });

  it("uses the written destination for a self capture", () => {
    const self = proto({ numUpvalues: 1, instructions: [abc(Opcode.GETUPVAL, 0, 0), abc(Opcode.RETURN, 0, 2)] });
    const module = decode(proto({
      children: [self], constants: [{ kind: "closure", protoId: 0 }],
      instructions: [ad(Opcode.DUPCLOSURE, 0, 0), abc(Opcode.CAPTURE, CaptureType.VAL, 0), ret()],
    })).module;
    expect(analyzeClosureCachePriming(module).get(closureCacheKey(module.mainProtoId, 0)))
      .toEqual([captureIdentityForConstant(module.mainProtoId, 0)]);
  });

  it("does not classify NaN as a reflexive cached capture", () => {
    const child = proto({ numUpvalues: 1, instructions: [ret()] });
    const module = decode(proto({
      children: [child], constants: [{ kind: "number", value: NaN }, { kind: "closure", protoId: 0 }],
      instructions: [ad(Opcode.LOADK, 0, 0), ad(Opcode.DUPCLOSURE, 1, 1), abc(Opcode.CAPTURE, CaptureType.VAL, 0), ret()],
    })).module;
    expect(analyzeClosureCachePriming(module).size).toBe(0);
  });

  it("excludes mutable upvalue slots", () => {
    const writer = proto({ numUpvalues: 1, instructions: [abc(Opcode.LOADNIL, 0), abc(Opcode.SETUPVAL, 0, 0), ret()] });
    const module = decode(proto({
      children: [writer], constants: [{ kind: "closure", protoId: 0 }],
      instructions: [ad(Opcode.LOADN, 0, 1), ad(Opcode.DUPCLOSURE, 1, 0), abc(Opcode.CAPTURE, CaptureType.VAL, 0), ret()],
    })).module;
    expect(analyzeClosureCachePriming(module).size).toBe(0);
  });

  it("stops at a REF cell instead of treating its current content as a VAL identity", () => {
    const reader = proto({ numUpvalues: 1, instructions: [abc(Opcode.GETUPVAL, 0, 0), abc(Opcode.RETURN, 0, 2)] });
    const leaf = proto({ instructions: [ret()] });
    const module = decode(proto({
      children: [reader, leaf], constants: [{ kind: "closure", protoId: 1 }],
      instructions: [
        ad(Opcode.LOADN, 0, 1), ad(Opcode.NEWCLOSURE, 1, 0), abc(Opcode.CAPTURE, CaptureType.REF, 0),
        ad(Opcode.DUPCLOSURE, 2, 0), ret(),
      ],
    })).module;
    expect(analyzeClosureCachePriming(module).size).toBe(0);
  });

  it("does not select a truthiness edge for an unknown parameter", () => {
    const child = proto({ instructions: [ret()] });
    const module = decode(proto({
      numParams: 1, children: [child], constants: [{ kind: "closure", protoId: 0 }],
      instructions: [ad(Opcode.JUMPIFNOT, 0, 1), ad(Opcode.DUPCLOSURE, 1, 0), ret()],
    })).module;
    expect(analyzeClosureCachePriming(module).size).toBe(0);
  });

  it("bounds recursive local calls without reporting unreachable later priming", () => {
    const recursive = proto({
      numUpvalues: 1,
      instructions: [abc(Opcode.GETUPVAL, 0, 0), abc(Opcode.CALL, 0, 1, 1), ret()],
    });
    const leaf = proto({ instructions: [ret()] });
    const module = decode(proto({
      children: [recursive, leaf], constants: [{ kind: "closure", protoId: 0 }, { kind: "closure", protoId: 1 }],
      instructions: [
        ad(Opcode.DUPCLOSURE, 0, 0), abc(Opcode.CAPTURE, CaptureType.VAL, 0), abc(Opcode.CALL, 0, 1, 1),
        ad(Opcode.DUPCLOSURE, 1, 1), ret(),
      ],
    })).module;
    const primes = analyzeClosureCachePriming(module);
    expect(primes.get(closureCacheKey(module.mainProtoId, 0))).toEqual([captureIdentityForConstant(module.mainProtoId, 0)]);
    expect(primes.has(closureCacheKey(module.mainProtoId, 1))).toBe(false);
  });

  it("bounds a known infinite loop without guessing evidence after it", () => {
    const child = proto({ instructions: [ret()] });
    const module = decode(proto({
      children: [child], constants: [{ kind: "closure", protoId: 0 }],
      instructions: [ad(Opcode.JUMPBACK, 0, -1), ad(Opcode.DUPCLOSURE, 0, 0), ret()],
    })).module;
    expect(analyzeClosureCachePriming(module).size).toBe(0);
  });
});
