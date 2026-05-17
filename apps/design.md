# Adadex — Design Language

A terminal-inspired orchestration cockpit. The aesthetic blends **Vercel's
restraint**, **Linear's density**, and **Cursor's soft-mint accent** over a
deep zinc canvas. Every surface should feel like a high-fidelity dev tool:
quiet by default, alive in motion, technical in tone.

---

## 1. Foundations

### Color

All color lives in `src/styles.css` as `oklch` tokens. Components never use
raw color classes (`text-white`, `bg-black`); they consume semantic tokens.

| Token                   | Role                               |
| ----------------------- | ---------------------------------- |
| `--background`          | Deep zinc canvas (`oklch(0.16 …)`) |
| `--surface`             | Panels, inspector, toolbars        |
| `--surface-2`           | Raised cards, popovers             |
| `--foreground`          | Primary text, near-white           |
| `--muted-foreground`    | Secondary text, metadata           |
| `--border`              | Hairlines, dividers (low contrast) |
| `--brand` / `--primary` | Cursor-style soft mint/lime accent |
| `--running`             | Live agent status (mint)           |
| `--stopped`             | Halted agent (warm orange)         |
| `--stale`               | Degraded / dashed (amber)          |
| `--idle`                | Dormant (neutral gray)             |
| `--destructive`         | Delete, danger                     |

**Rules**

- Accent (`--brand`) is reserved for live state, focus, and a single CTA per
  view. Never decorative.
- Status colors are semantic — never reuse `--running` for a non-status
  affordance.
- Translucency uses `oklch(from var(--token) l c h / 0.xx)` so opacity reads
  consistently across the palette.

### Typography

- **Sans:** Inter (400 / 500 / 600 / 700)
- **Mono:** JetBrains Mono (400 / 500 / 600) — used for IDs, commits,
  branches, paths, percentages, keyboard hints.

Scale is tight and pixel-precise. Common sizes:

| Use                         | Size        | Weight |
| --------------------------- | ----------- | ------ |
| Section eyebrow / uppercase | `10px`      | 600    |
| Toolbar, body micro         | `12–12.5px` | 500    |
| Nav, default body           | `13px`      | 500    |
| Inspector title, H2         | `15–16px`   | 600    |

Uppercase labels use `tracking-[0.18em]`. Tabular numbers and IDs are mono.

### Spacing & radius

- Density first: header `h-14`, toolbar `h-11`, buttons `h-7`–`h-8`.
- Radius scale derives from `--radius: 0.5rem`. Pills are full radius;
  surfaces use `rounded-md`/`rounded-lg`.
- Borders are 1px, low-chroma. Depth comes from layering surfaces, not
  heavy shadows.

---

## 2. Surfaces & Layering

Three vertical layers, dark to light:

1. `--background` — the canvas
2. `--surface` — chrome (header, toolbar, inspector)
3. `--surface-2` — raised elements

A `.bg-grid` radial-dot pattern and `.scanline` overlay live on the
workspace canvas only. They give the cockpit its "terminal under glass"
texture without polluting chrome.

Glows are restricted to live nodes and focused elements:

```
box-shadow: 0 0 30px oklch(from var(--running) l c h / 0.35);
```

---

## 3. Components

### Navigation header

Vercel-style: brand → breadcrumb → centered tab nav → search → meters →
avatar. The active tab uses a 1px underline in `--foreground`, never a
filled pill. Keyboard hints (`kbd`) sit beside labels at `xl+`.

### Toolbar

Linear-style icon+label buttons at 12.5px. Toggle state uses
`bg-brand/10 text-brand`. Destructive actions use `text-destructive` and
`hover:bg-destructive/10` — never a filled red button.

The primary CTA is a single black-on-white button (`bg-foreground
text-background`). One per view.

### Status pills

Border + 12% tint + solid 1.5px dot. Color comes entirely from the status
token, so adding a new status only requires a new CSS variable.

### Agent graph

- The **lead** node is larger, glows, and uses `.animate-pulse-ring`.
- Edges are 1px `oklch(1 0 0 / 0.12)`; `stale` edges dash.
- Selection scales 1.10 and adds the status glow.
- Nodes are SVG-positioned in percentages so the graph is fluid.

### Inspector

Right-anchored 360px panel on `--surface/40`. Content is grouped into
`Section` blocks with an uppercase eyebrow. Key/value rows are mono on the
right, muted label on the left. Resource bars are 4px tall with the brand
fill.

---

## 4. Motion

Motion is small, technical, and ambient — never showy.

- `animate-pulse-ring` on the lead node (2.4s ease-out)
- `animate-pulse` on running status dots
- 12s auto-refresh indicator pulse in the toolbar
- Hover transitions are `transition-colors` only; no scale on chrome.
- Canvas nodes use `transition-all` with a 1.10 scale on select.

Reserve larger motion for state changes (agent connect / disconnect, log
stream arrival). Idle UI should be quiet.

---

## 5. Voice & Microcopy

- Lowercase environment names (`production`), uppercase state pills
  (`RUNNING`).
- Log levels: `info`, `warn`, `error`, `ok`. Timestamps are `HH:MM:SS`.
- Identifiers stay mono and unabbreviated (`a7f29d1`, not `a7f…`).
- Empty states should read like a CLI hint, not a marketing line.

---

## 6. Rules of thumb

1. **Tokens over values.** If a color isn't in `styles.css`, add it there.
2. **One accent per view.** The mint pulls the eye — don't dilute it.
3. **Density with air.** Tight type, generous internal padding on panels.
4. **Mono = machine.** Anything generated, hashed, or measured is mono.
5. **Borders, not shadows.** Depth is layered surfaces + hairlines.
6. **Motion signals state.** If nothing changed, nothing should move.
