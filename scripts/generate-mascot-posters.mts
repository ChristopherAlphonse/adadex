import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CuteMascot, type CuteMascotState } from "../apps/web/src/components/deck/CuteMascot";

// Outside Vite the component is compiled with the classic JSX transform.
// SAFETY: React is imported above, so the global matches the module namespace we just bound.
(globalThis as typeof globalThis & { React: typeof React }).React = React;

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const OUT_DIR = join(REPO_ROOT, "static", "images", "mascots");

const STATES: { state: CuteMascotState; label: string }[] = [
  { state: "sleeping", label: "Sleeping" },
  { state: "idle", label: "Idle" },
  { state: "working", label: "Working" },
  { state: "happy", label: "Happy" },
  { state: "worried", label: "Worried" },
];

const PALETTE = [
  { slug: "violet", name: "Violet", color: "#7c3aed" },
  { slug: "sky", name: "Sky", color: "#60a5fa" },
  { slug: "mint", name: "Mint", color: "#34d399" },
  { slug: "rose", name: "Rose", color: "#f472b6" },
  { slug: "amber", name: "Amber", color: "#fb923c" },
  { slug: "cyan", name: "Cyan", color: "#06b6d4" },
];

const escapeXml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const buildPoster = ({ name, color }: (typeof PALETTE)[number]): string => {
  const cardWidth = 192;
  const gap = 14;
  const margin = 30;
  const width = margin * 2 + STATES.length * cardWidth + (STATES.length - 1) * gap;
  const height = 306;
  const cardY = 74;
  const cardHeight = 202;

  const cards = STATES.map(({ state, label }, index) => {
    const x = margin + index * (cardWidth + gap);

    const mascotMarkup = renderToStaticMarkup(
      React.createElement(CuteMascot, { state, color, size: 128 }),
    )
      // React useId() values contain colons; keep SVG ids and url() refs portable.
      .replace(/:/g, "-")
      .replace("<svg ", `<svg x="${x + 30}" y="${cardY + 10}" `);

    return `
      <g>
        <rect x="${x}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" rx="22"
          fill="#ffffff" fill-opacity="0.82"
          stroke="color-mix(in srgb, ${color} 34%, white)" stroke-width="1.5" />
        ${mascotMarkup}
        <text x="${x + cardWidth / 2}" y="${cardY + cardHeight - 18}" text-anchor="middle"
          font-family="Inter, system-ui, sans-serif" font-size="17" font-weight="600"
          fill="#241b2f">${escapeXml(label)}</text>
      </g>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Adadex mascot moods in ${escapeXml(name)}">
  <defs>
    <linearGradient id="poster-bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="color-mix(in srgb, ${color} 20%, white)" />
      <stop offset="100%" stop-color="color-mix(in srgb, ${color} 7%, white)" />
    </linearGradient>
  </defs>
  <rect x="0.75" y="0.75" width="${width - 1.5}" height="${height - 1.5}" rx="26"
    fill="url(#poster-bg)" stroke="color-mix(in srgb, ${color} 30%, white)" stroke-width="1.5" />
  <circle cx="${margin + 9}" cy="42" r="8" fill="${color}" />
  <text x="${margin + 27}" y="48" font-family="Inter, system-ui, sans-serif" font-size="22"
    font-weight="700" fill="#241b2f">${escapeXml(name)}</text>
  <text x="${margin + 37 + name.length * 13}" y="48"
    font-family="Inter, system-ui, sans-serif" font-size="15" font-weight="500"
    fill="#6b6275">${escapeXml(color.toUpperCase())}</text>
  ${cards}
</svg>
`;
};

mkdirSync(OUT_DIR, { recursive: true });

for (const palette of PALETTE) {
  const file = join(OUT_DIR, `${palette.slug}.svg`);
  writeFileSync(file, buildPoster(palette), "utf8");
  console.log(`wrote ${file}`);
}
