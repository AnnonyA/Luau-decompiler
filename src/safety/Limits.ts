export interface SafetyLimits {
  maxBytecodeBytes: number;
  maxStringCount: number;
  maxStringBytes: number;
  maxSingleStringBytes: number;
  maxPrototypeCount: number;
  maxInstructionsPerPrototype: number;
  maxConstantsPerPrototype: number;
  maxChildPrototypes: number;
  maxLocals: number;
  maxUpvalues: number;
  maxTypeInfoBytes: number;
  maxNestingDepth: number;
  maxAnalysisIterations: number;
  maxUserdataTypes: number;
  maxFeedbackSlots: number;
}

export const DEFAULT_SAFETY_LIMITS: SafetyLimits = {
  maxBytecodeBytes: 16 * 1024 * 1024,
  maxStringCount: 250_000,
  maxStringBytes: 16 * 1024 * 1024,
  maxSingleStringBytes: 4 * 1024 * 1024,
  maxPrototypeCount: 50_000,
  maxInstructionsPerPrototype: 500_000,
  maxConstantsPerPrototype: 100_000,
  maxChildPrototypes: 16_384,
  maxLocals: 16_384,
  maxUpvalues: 200,
  maxTypeInfoBytes: 1_048_576,
  maxNestingDepth: 256,
  maxAnalysisIterations: 100_000,
  maxUserdataTypes: 32,
  maxFeedbackSlots: 65_536,
};

export function mergeLimits(overrides?: Partial<SafetyLimits>): SafetyLimits {
  return { ...DEFAULT_SAFETY_LIMITS, ...overrides };
}
