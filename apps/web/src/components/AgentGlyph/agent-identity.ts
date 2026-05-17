import type { AgentGlyphVariant, Identity } from "./agent-types";

const hashSeed = (seed: string | number | undefined): number => {
  const input = String(seed ?? "default");
  let hash = 2166136261;

  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
};

const seededValue = (hash: number, salt: number, min: number, max: number): number => {
  const x = Math.sin(hash + salt * 999) * 10000;
  const normalized = x - Math.floor(x);
  return min + normalized * (max - min);
};

export const resolveIdentity = (
  identitySeed: string | number | undefined,
  variant: AgentGlyphVariant,
): Identity => {
  const hash = hashSeed(identitySeed ?? variant);
  return {
    hash,
    armBias: seededValue(hash, 1, -0.18, 0.18),
    nodeBias: seededValue(hash, 2, -0.24, 0.24),
    dotCount: Math.round(seededValue(hash, 3, 3, 6)),
    accessoryOffset: seededValue(hash, 4, -0.18, 0.18),
    accentIntensity: seededValue(hash, 5, 0.72, 1),
  };
};
