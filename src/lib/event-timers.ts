import { timeFillCategory, type TimeFillCategoryId } from "./time-fills";

export type TimerSegment = { start: string; end: string };
export type EventTimerDto = {
  id: string; eventId: string; eventKind: string; title: string; href: string; projectName: string | null;
  category: TimeFillCategoryId; autoAllocate: boolean; mode: "fixed" | "free";
  durationSeconds: number | null; status: "running" | "paused" | "completed" | "cancelled";
  startedAt: string; runningSince: string | null; endedAt: string | null; segments: TimerSegment[];
};

export function suggestTimerCategory(event: { kind: string; title: string; project?: { name: string } | null }): TimeFillCategoryId {
  const text = `${event.title} ${event.project?.name ?? ""}`.toLowerCase();
  const rules: [TimeFillCategoryId, RegExp][] = [
    ["move", /运动|健身|跑步|骑行|游泳|俯卧撑|workout/], ["rest", /睡眠|睡觉|午休|休息|sleep/],
    ["commute", /通勤|地铁|开车|commute/], ["tidy", /整理|打扫|清洁|收纳|clean/],
    ["startup", /创业|商业|客户|startup/], ["research", /科研|论文|实验|研究|paper|research/],
    ["learning", /学习|阅读|读书|课程|learning|reading/], ["play", /游戏|电影|娱乐|game/],
  ];
  for (const [category, pattern] of rules) if (pattern.test(text)) return category;
  return event.kind === "meeting" || event.kind === "contact" ? "social" : "life";
}

/** Active spans only: paused gaps are excluded; fixed timers stop at their budget even offline. */
export function timerSegments(timer: EventTimerDto, now = Date.now()): TimerSegment[] {
  if (timer.status === "cancelled") return [];
  const candidates = [...timer.segments];
  if (timer.status === "running" && timer.runningSince) candidates.push({ start: timer.runningSince, end: new Date(now).toISOString() });
  let remaining = timer.mode === "fixed" ? Math.max(0, timer.durationSeconds ?? 0) * 1000 : Infinity;
  const result: TimerSegment[] = [];
  let previousEnd = -Infinity;
  for (const span of candidates) {
    const start = Math.max(Date.parse(span.start), previousEnd);
    const end = Math.min(Date.parse(span.end), now, start + remaining);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || remaining <= 0) continue;
    result.push({ start: new Date(start).toISOString(), end: new Date(end).toISOString() });
    remaining -= end - start;
    previousEnd = end;
  }
  return result;
}

export function timerElapsedSeconds(timer: EventTimerDto, now = Date.now()): number {
  return timerSegments(timer, now).reduce((sum, s) => sum + (Date.parse(s.end) - Date.parse(s.start)) / 1000, 0);
}

export function effectiveTimerStatus(timer: EventTimerDto, now = Date.now()): EventTimerDto["status"] {
  return timer.mode === "fixed" && timer.status === "running" && timerElapsedSeconds(timer, now) >= (timer.durationSeconds ?? Infinity)
    ? "completed" : timer.status;
}

export function formatTimerSeconds(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const h = Math.floor(whole / 3600);
  const m = Math.floor(whole / 60) % 60;
  const s = whole % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export type TimerAllocation = { category: TimeFillCategoryId; seconds: number };
export type TimerAllocations = Record<string, TimerAllocation[]>;

/** Split concurrent seconds equally between events. Every wall-clock second is allocated once. */
export function allocateTimerSlots(timers: EventTimerDto[], date: string, now = Date.now()): TimerAllocations {
  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
  const spans = timers.filter((t) => t.autoAllocate && timeFillCategory(t.category)).flatMap((t) =>
    timerSegments(t, now).map((s) => ({ start: Math.max(+dayStart, Date.parse(s.start)), end: Math.min(+dayEnd, Date.parse(s.end)), category: t.category }))
  ).filter((s) => s.end > s.start);
  const result: TimerAllocations = {};
  for (let start = +dayStart; start < +dayEnd; start += 30 * 60_000) {
    const end = Math.min(start + 30 * 60_000, +dayEnd);
    const overlapping = spans.filter((s) => s.start < end && s.end > start);
    if (!overlapping.length) continue;
    const points = [...new Set([start, end, ...overlapping.flatMap((s) => [Math.max(start, s.start), Math.min(end, s.end)])])].sort((a, b) => a - b);
    const totals = new Map<TimeFillCategoryId, number>();
    for (let i = 1; i < points.length; i++) {
      const left = points[i - 1], right = points[i];
      const active = overlapping.filter((s) => s.start < right && s.end > left);
      for (const s of active) totals.set(s.category, (totals.get(s.category) ?? 0) + (right - left) / 1000 / active.length);
    }
    const clock = new Date(start);
    const key = `${String(clock.getHours()).padStart(2, "0")}:${String(clock.getMinutes()).padStart(2, "0")}`;
    const existing = result[key] ?? [];
    for (const a of existing) totals.set(a.category, (totals.get(a.category) ?? 0) + a.seconds);
    result[key] = [...totals].map(([category, seconds]) => ({ category, seconds })).sort((a, b) => b.seconds - a.seconds || a.category.localeCompare(b.category));
  }
  return result;
}

export function allocationBackground(parts: TimerAllocation[]): string | undefined {
  const total = parts.reduce((sum, p) => sum + p.seconds, 0);
  if (!total) return;
  let offset = 0;
  return `linear-gradient(90deg, ${parts.map((p) => {
    const start = offset; offset += p.seconds / total * 100;
    return `${timeFillCategory(p.category)?.color ?? "#71717a"} ${start}% ${offset}%`;
  }).join(", ")})`;
}
