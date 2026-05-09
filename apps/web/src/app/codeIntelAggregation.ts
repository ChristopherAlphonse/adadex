export type CodeIntelEvent = {
  ts: string;
  sessionId: string;
  tool: string;
  file: string;
};

/* ── Treemap ────────────────────────────────────────── */

export type TreemapNode = {
  name: string;
  path: string;
  value: number;
  children: TreemapNode[];
};

export type TreemapRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  path: string;
  value: number;
  depth: number;
};

/** Build a flat list of files with edit counts, wrapped in a root node for the treemap layout. */
export const buildTreemapTree = (events: CodeIntelEvent[], workspaceCwd: string): TreemapNode => {
  const counts = new Map<string, number>();
  for (const e of events) {
    const relative = e.file.startsWith(workspaceCwd)
      ? e.file.slice(workspaceCwd.length + 1)
      : e.file;
    counts.set(relative, (counts.get(relative) ?? 0) + 1);
  }

  const children: TreemapNode[] = [...counts.entries()]
    .map(([path, count]) => ({
      name: path.split("/").pop() ?? path,
      path,
      value: count,
      children: [],
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 50);

  const total = children.reduce((acc, c) => acc + c.value, 0);

  return { name: "root", path: "", value: total, children };
};

/** Squarified treemap layout — returns flat array of positioned rectangles. */
export const layoutTreemap = (root: TreemapNode, width: number, height: number): TreemapRect[] => {
  const rects: TreemapRect[] = [];
  if (root.value === 0 || root.children.length === 0) return rects;

  // Normalize values to areas
  const totalArea = width * height;
  const items = [...root.children]
    .sort((a, b) => b.value - a.value)
    .map((c) => ({ node: c, area: (c.value / root.value) * totalArea }));

  squarify(items, { x: 0, y: 0, w: width, h: height }, rects);
  return rects;
};

type LayoutItem = { node: TreemapNode; area: number };
type Rect = { x: number; y: number; w: number; h: number };

const squarify = (items: LayoutItem[], rect: Rect, out: TreemapRect[]) => {
  if (items.length === 0) return;
  if (items.length === 1) {
    const [item] = items;
    if (item) {
      pushRect(item, rect, out);
    }
    return;
  }

  const { x, y, w, h } = rect;
  const shortSide = Math.min(w, h);
  const horizontal = w >= h; // lay row along the short side

  let row: LayoutItem[] = [];
  let rowArea = 0;
  let best = Number.POSITIVE_INFINITY;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) continue;
    const nextArea = rowArea + item.area;
    const nextRow = [...row, item];
    const worst = worstRatio(nextRow, nextArea, shortSide);

    if (worst <= best) {
      row = nextRow;
      rowArea = nextArea;
      best = worst;
    } else {
      // Lay out current row, recurse on remainder
      const rowThickness = rowArea / shortSide;
      let offset = 0;

      for (const r of row) {
        const cellLen = r.area / rowThickness;
        if (horizontal) {
          pushRect(r, { x, y: y + offset, w: rowThickness, h: cellLen }, out);
        } else {
          pushRect(r, { x: x + offset, y, w: cellLen, h: rowThickness }, out);
        }
        offset += cellLen;
      }

      const remaining = items.slice(i);
      if (horizontal) {
        squarify(remaining, { x: x + rowThickness, y, w: w - rowThickness, h }, out);
      } else {
        squarify(remaining, { x, y: y + rowThickness, w, h: h - rowThickness }, out);
      }
      return;
    }
  }

  // Lay out final row
  const rowThickness = rowArea / shortSide;
  let offset = 0;
  for (const r of row) {
    const cellLen = r.area / rowThickness;
    if (horizontal) {
      pushRect(r, { x, y: y + offset, w: rowThickness, h: cellLen }, out);
    } else {
      pushRect(r, { x: x + offset, y, w: cellLen, h: rowThickness }, out);
    }
    offset += cellLen;
  }
};

const pushRect = (item: LayoutItem, rect: Rect, out: TreemapRect[]) => {
  out.push({
    x: rect.x,
    y: rect.y,
    width: rect.w,
    height: rect.h,
    name: item.node.name,
    path: item.node.path,
    value: item.node.value,
    depth: 1,
  });
};

const worstRatio = (row: LayoutItem[], totalArea: number, shortSide: number): number => {
  const rowLen = totalArea / shortSide; // thickness of the row
  let worst = 0;
  for (const r of row) {
    const cellLen = r.area / rowLen;
    const aspect = rowLen > cellLen ? rowLen / cellLen : cellLen / rowLen;
    if (aspect > worst) worst = aspect;
  }
  return worst;
};

/* ── Coupling (Arc Diagram) ─────────────────────────── */

export type CouplingPair = {
  fileA: string;
  fileB: string;
  coSessions: number;
  totalSessions: number;
  strength: number;
};

export type CouplingFile = {
  file: string;
  edits: number;
  sessions: number;
};

export type CouplingData = {
  files: CouplingFile[];
  pairs: CouplingPair[];
};

/** Find files that co-occur in the same session. */
export const buildCouplingData = (events: CodeIntelEvent[], workspaceCwd: string): CouplingData => {
  // Group files by session
  const sessionFiles = new Map<string, Set<string>>();
  const fileEdits = new Map<string, number>();
  const fileSessions = new Map<string, Set<string>>();

  for (const e of events) {
    const relative = e.file.startsWith(workspaceCwd)
      ? e.file.slice(workspaceCwd.length + 1)
      : e.file;

    if (!sessionFiles.has(e.sessionId)) sessionFiles.set(e.sessionId, new Set());
    sessionFiles.get(e.sessionId)?.add(relative);

    fileEdits.set(relative, (fileEdits.get(relative) ?? 0) + 1);

    if (!fileSessions.has(relative)) fileSessions.set(relative, new Set());
    fileSessions.get(relative)?.add(e.sessionId);
  }

  // Build coupling pairs
  const pairKey = (a: string, b: string) => (a < b ? `${a}\0${b}` : `${b}\0${a}`);
  const pairCounts = new Map<string, { fileA: string; fileB: string; count: number }>();

  for (const files of sessionFiles.values()) {
    const fileList = [...files];
    for (let i = 0; i < fileList.length; i++) {
      for (let j = i + 1; j < fileList.length; j++) {
        const a = fileList[i];
        const b = fileList[j];
        if (!a || !b) continue;
        const key = pairKey(a, b);
        const existing = pairCounts.get(key);
        if (existing) {
          existing.count++;
        } else {
          pairCounts.set(key, { fileA: a < b ? a : b, fileB: a < b ? b : a, count: 1 });
        }
      }
    }
  }

  const totalSessionCount = sessionFiles.size;

  const files: CouplingFile[] = [...fileEdits.entries()]
    .map(([file, edits]) => ({
      file,
      edits,
      sessions: fileSessions.get(file)?.size ?? 0,
    }))
    .sort((a, b) => b.edits - a.edits);

  const pairs: CouplingPair[] = [...pairCounts.values()]
    .map(({ fileA, fileB, count }) => ({
      fileA,
      fileB,
      coSessions: count,
      totalSessions: totalSessionCount,
      strength: totalSessionCount > 0 ? count / totalSessionCount : 0,
    }))
    .filter((p) => p.coSessions >= 1)
    .sort((a, b) => b.coSessions - a.coSessions);

  return { files, pairs };
};

/* ── Heat color scale (thermal MRI gradient) ────────── */

// smolder → accent → fire red
const MRI_STOPS: [number, number, number][] = [
  [0x2a, 0x18, 0x04], // dark ember
  [0x6e, 0x32, 0x06], // deep burn
  [0xa8, 0x58, 0x08], // warm amber
  [0xd4, 0xa0, 0x17], // primary accent
  [0xe0, 0x7a, 0x0a], // orange fire
  [0xe8, 0x44, 0x08], // hot orange
  [0xd0, 0x18, 0x06], // deep red
  [0xf0, 0x22, 0x06], // fire red
];

export const heatColor = (value: number, maxValue: number): string => {
  if (maxValue === 0) return "rgb(10,10,46)";
  const ratio = Math.min(value / maxValue, 1);
  const segment = ratio * (MRI_STOPS.length - 1);
  const i = Math.min(Math.floor(segment), MRI_STOPS.length - 2);
  const t = segment - i;
  const a = MRI_STOPS[i];
  const b = MRI_STOPS[i + 1];
  if (!a || !b) return "rgb(10,10,46)";
  const r = Math.round(a[0] + t * (b[0] - a[0]));
  const g = Math.round(a[1] + t * (b[1] - a[1]));
  const bl = Math.round(a[2] + t * (b[2] - a[2]));
  return `rgb(${r},${g},${bl})`;
};
