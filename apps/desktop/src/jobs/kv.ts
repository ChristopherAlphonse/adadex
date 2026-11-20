/** Read the `KEY: value` lines a stage document carries (for example `STATUS: READY`). */
export const parseKv = (text: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const m = /^([A-Z][A-Z0-9_]*):\s*(.*)$/.exec(line.trim());
    if (m?.[1] !== undefined && !(m[1] in out)) out[m[1]] = (m[2] ?? "").trim();
  }
  return out;
};
