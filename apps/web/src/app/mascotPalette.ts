/**
 * Coordination / mascot body colors. Mid-chroma accents that read clearly on dark UI
 * (avoids pale mints like #d9f99d for labels and graph chips).
 */
export const MASCOT_COLORS = [
  "#a3e635",
  "#eab308",
  "#22c55e",
  "#ef4444",
  "#f97316",
  "#38bdf8",
] as const;

export type MascotPaletteColor = (typeof MASCOT_COLORS)[number];

export function formatColorForDisplay(hex: string): string {
  const raw = hex.trim().replace(/^#/, "");
  if (raw.length !== 6 || !/^[0-9a-fA-F]+$/.test(raw)) {
    return hex;
  }
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  return `#${raw.toUpperCase()} · rgb(${r}, ${g}, ${b})`;
}
