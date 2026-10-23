/** Circle map for contacts. A circle is a ContactCategory. */

export const UNCIRCLED_ID = "__uncircled__";
export const UNCIRCLED_NAME = "未分圈";

const NAMED_COLORS: Record<string, string> = {
  家人: "#db2777",
  朋友: "#059669",
  同事: "#4f46e5",
  客户: "#d97706",
  Academia: "#4338ca",
  大厂: "#0284c7",
  教授: "#7c3aed",
  公务员: "#b45309",
  事业单位: "#0f766e",
  建筑事务所: "#be123c",
  [UNCIRCLED_NAME]: "#71717a",
};

const FALLBACK = ["#0ea5e9", "#e11d48", "#65a30d", "#c026d3", "#ea580c", "#0891b2"];

export function circleColor(name: string, index = 0): string {
  return NAMED_COLORS[name] ?? FALLBACK[index % FALLBACK.length];
}

/** 回应积极度 5 及以上视为对方主动。 */
export function isProactive(responseLevel: number | null | undefined): boolean {
  return responseLevel != null && responseLevel >= 5;
}

export function closeness(input: {
  importance: number;
  contactFrequencyDays: number;
  lastContactAt: string | null;
  now?: number;
}): number {
  const importance = Math.min(5, Math.max(1, input.importance)) / 5;
  const days = input.contactFrequencyDays;
  const frequency = days <= 7 ? 1 : days <= 14 ? 0.82 : days <= 30 ? 0.58 : days <= 90 ? 0.36 : 0.18;
  let recent = 0.16;
  if (input.lastContactAt) {
    const elapsed = ((input.now ?? Date.now()) - new Date(input.lastContactAt).getTime()) / 86_400_000;
    recent = elapsed <= days ? 1 : elapsed <= days * 2 ? 0.52 : 0.28;
  }
  return importance * 0.5 + frequency * 0.3 + recent * 0.2;
}

/** Mix circle color toward white. t=1 is the full color. */
export function shadeColor(hex: string, t: number): string {
  const raw = hex.replace("#", "");
  const n = Number.parseInt(raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const k = 0.28 + Math.min(1, Math.max(0, t)) * 0.72;
  const mix = (channel: number) => Math.round(255 - (255 - channel) * k);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

export type CircleNode = { id: string; angle: number; ring: number };
export type PlacedCircle = {
  id: string;
  name: string;
  color: string;
  cx: number;
  cy: number;
  r: number;
  nodes: Array<CircleNode & { x: number; y: number }>;
};

const NODE_GAP = 46;

function ringCounts(n: number): number[] {
  if (n <= 0) return [];
  const counts: number[] = [];
  let left = n;
  let ring = 0;
  while (left > 0) {
    const radius = 56 + ring * 44;
    const fit = Math.max(6, Math.floor((2 * Math.PI * radius) / NODE_GAP));
    const take = Math.min(left, fit);
    counts.push(take);
    left -= take;
    ring += 1;
  }
  return counts;
}

export function circleRadius(n: number): number {
  const counts = ringCounts(n);
  if (counts.length === 0) return 54;
  const last = counts.length - 1;
  return 56 + last * 44 + 30;
}

export function placeCircles(
  groups: Array<{ id: string; name: string; color: string; memberIds: string[] }>
): PlacedCircle[] {
  const specs = groups
    .map((g) => ({ ...g, r: circleRadius(g.memberIds.length) }))
    .sort((a, b) => b.r - a.r || a.name.localeCompare(b.name));

  const anchors: Array<{ x: number; y: number; r: number }> = [];
  const placed: PlacedCircle[] = [];

  for (const spec of specs) {
    let x = 0;
    let y = 0;
    if (anchors.length > 0) {
      let found = false;
      for (let dist = spec.r + anchors[0].r + 36; dist < 4000 && !found; dist += 10) {
        const steps = Math.max(16, Math.floor((2 * Math.PI * dist) / 20));
        for (let i = 0; i < steps && !found; i += 1) {
          const angle = (i / steps) * Math.PI * 2;
          const cx = Math.cos(angle) * dist;
          const cy = Math.sin(angle) * dist;
          const clear = anchors.every(
            (p) => Math.hypot(p.x - cx, p.y - cy) >= p.r + spec.r + 36
          );
          if (clear) {
            x = cx;
            y = cy;
            found = true;
          }
        }
      }
    }
    anchors.push({ x, y, r: spec.r });

    const counts = ringCounts(spec.memberIds.length);
    const nodes: PlacedCircle["nodes"] = [];
    let cursor = 0;
    counts.forEach((count, ring) => {
      const radius = 56 + ring * 44;
      for (let i = 0; i < count; i += 1) {
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2 + ring * 0.35;
        nodes.push({
          id: spec.memberIds[cursor],
          angle,
          ring,
          x: x + Math.cos(angle) * radius,
          y: y + Math.sin(angle) * radius,
        });
        cursor += 1;
      }
    });
    placed.push({
      id: spec.id,
      name: spec.name,
      color: spec.color,
      cx: x,
      cy: y,
      r: spec.r,
      nodes,
    });
  }

  if (placed.length === 0) return [];
  const minX = Math.min(...placed.map((c) => c.cx - c.r));
  const minY = Math.min(...placed.map((c) => c.cy - c.r));
  const pad = 28;
  return placed.map((c) => ({
    ...c,
    cx: c.cx - minX + pad,
    cy: c.cy - minY + pad,
    nodes: c.nodes.map((n) => ({ ...n, x: n.x - minX + pad, y: n.y - minY + pad })),
  }));
}

export function shortContactName(name: string): string {
  const head = name.split(/\s+/)[0] ?? name;
  return head.length > 6 ? `${head.slice(0, 5)}…` : head;
}
