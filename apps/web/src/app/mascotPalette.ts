export const MASCOT_COLORS = [
  "#7c3aed",
  "#60a5fa",
  "#34d399",
  "#f472b6",
  "#fb923c",
  "#818cf8",
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