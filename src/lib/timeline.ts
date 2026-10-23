import {
  addDays,
  addMonths,
  addYears,
  differenceInDays,
  endOfMonth,
  endOfYear,
  format,
  parseISO,
  startOfMonth,
  startOfYear,
} from "date-fns";
import { zhCN } from "date-fns/locale";
import { isProjectDone } from "@/lib/goal-progress";
import { FORESIGHT_NODES } from "@/lib/foresight-timeline";
import {
  mapStepsToDates,
  type ProjectPlanFields,
  type ProjectPlanStepDto,
} from "@/lib/project-plan";
import { OPPORTUNITY_CLOSED_STATUSES, stripProjectYearPrefix } from "@/lib/utils";

export type TimelineScale = "month" | "year" | "decade";
export type TimelineView = "day" | "powers" | TimelineScale;
export type TimelineKind = "bar" | "point";
export type TimelineLayer = "vision" | "goal" | "event" | "project";
export type TimelineStatus = "done" | "overdue" | "upcoming";

export type TimelineSource =
  | "project"
  | "strategy-phase"
  | "foresight-era"
  | "plan-step"
  | "milestone"
  | "goal"
  | "foresight-prediction"
  | "foresight-vision"
  | "opportunity"
  | "meeting";

export type TimelineItem = {
  id: string;
  kind: TimelineKind;
  layer: TimelineLayer;
  source: TimelineSource;
  sourceId: string;
  title: string;
  detail?: string;
  href: string;
  start: string;
  end?: string;
  rowId: string;
  rowTitle: string;
  projectId?: string;
  color: string;
  status: TimelineStatus;
  computed?: boolean;
};

export type TimelineRow = {
  id: string;
  layer: TimelineLayer;
  title: string;
  href?: string;
  color: string;
  subtitle?: string;
  pinned?: boolean;
};

export type TimelineColumn = {
  key: string;
  label: string;
  start: string;
  end: string;
};

export type TimelinePendingItem = {
  id: string;
  kind: "meeting" | "opportunity" | "project";
  title: string;
  detail?: string;
  href: string;
};

export type TimelinePayload = {
  scale: TimelineScale;
  start: string;
  end: string;
  today: string;
  columns: TimelineColumn[];
  rows: TimelineRow[];
  items: TimelineItem[];
  undatedProjectCount: number;
  pendingReview: TimelinePendingItem[];
};

export const TIMELINE_SCALES: TimelineScale[] = ["month", "year", "decade"];
export const TIMELINE_VIEWS: TimelineView[] = ["month", "day", "year", "decade", "powers"];

export const SCALE_LABELS: Record<TimelineScale, string> = {
  month: "月",
  year: "年",
  decade: "十年",
};

export const VIEW_LABELS: Record<TimelineView, string> = {
  month: "月",
  day: "日",
  year: "年",
  decade: "十年",
  powers: "九力",
};

export const LAYER_LABELS: Record<TimelineLayer, string> = {
  vision: "愿景 / 策略",
  goal: "目标",
  event: "机会 / 会议",
  project: "项目",
};

export const SOURCE_LABELS: Record<TimelineSource, string> = {
  project: "项目",
  "strategy-phase": "策略阶段",
  "foresight-era": "前瞻阶段",
  "plan-step": "步骤",
  milestone: "里程碑",
  goal: "目标",
  "foresight-prediction": "前瞻预测",
  "foresight-vision": "愿景",
  opportunity: "机会",
  meeting: "会议",
};

export const LAYER_ORDER: TimelineLayer[] = ["vision", "goal", "event", "project"];

/** Manual row order for non-project layers lives in TimelineOverride as `row-order:<layer>` with a JSON id list in `detail`. */
export const ROW_ORDER_SOURCE = "row-order";
export const ORDERABLE_LAYERS: TimelineLayer[] = ["vision", "goal", "event"];

export type TimelineRowOrder = Partial<Record<TimelineLayer, string[]>>;

export function parseRowOrder(overrides: Array<{ source: string; sourceId: string; detail: string | null }>): TimelineRowOrder {
  const order: TimelineRowOrder = {};
  for (const o of overrides) {
    if (o.source !== ROW_ORDER_SOURCE || !ORDERABLE_LAYERS.includes(o.sourceId as TimelineLayer)) continue;
    try {
      const ids = JSON.parse(o.detail ?? "[]");
      if (Array.isArray(ids)) order[o.sourceId as TimelineLayer] = ids.filter((id) => typeof id === "string");
    } catch {
      // ignore malformed order
    }
  }
  return order;
}

/** New visible order first, then previously ranked rows that are outside the current window. */
export function mergeRowOrder(existing: string[], visible: string[]): string[] {
  const seen = new Set(visible);
  return [...visible, ...existing.filter((id) => !seen.has(id))];
}

export function moveRow<T extends { id: string }>(rows: T[], fromId: string, toId: string): T[] {
  const fromIdx = rows.findIndex((r) => r.id === fromId);
  const toIdx = rows.findIndex((r) => r.id === toId);
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return rows;
  const next = [...rows];
  const [item] = next.splice(fromIdx, 1);
  next.splice(toIdx, 0, item!);
  return next;
}

export const GOAL_AREA_HEX: Record<string, string> = {
  career: "#4f46e5",
  health: "#059669",
  finance: "#d97706",
  relationship: "#db2777",
  creation: "#7c3aed",
  learning: "#2563eb",
};

const YEAR_RANGE_RE = /^(\d{4})\s*[–—-]\s*(\d{4})$/;
const YEAR_RE = /^(\d{4})$/;
const YEAR_MONTH_RE = /^(\d{4})-(\d{2})$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

const SKIPPED_OPP_STATUSES = new Set<string>(
  OPPORTUNITY_CLOSED_STATUSES.filter((s) => s !== "Won")
);

export function parseScale(value: string | null | undefined): TimelineScale {
  if (value === "year" || value === "decade" || value === "month") return value;
  return "month";
}

export function parseView(value: string | null | undefined): TimelineView {
  // 周视图已去掉，旧的 scale=week 链接落到今日
  if (value === "week") return "day";
  if (
    value === "day" ||
    value === "powers" ||
    value === "year" ||
    value === "decade" ||
    value === "month"
  ) {
    return value;
  }
  return "month";
}

export function isGanttView(view: TimelineView): view is TimelineScale {
  return view === "month" || view === "year" || view === "decade";
}

export function showsStepPoints(scale: TimelineScale): boolean {
  return scale !== "decade";
}

export function todayKey(date: Date = new Date()): string {
  return format(date, "yyyy-MM-dd");
}

function atNoon(dateStr: string): Date {
  return parseISO(`${dateStr}T12:00:00`);
}

function lastDayOfMonth(year: number, month: number): string {
  return format(endOfMonth(parseISO(`${year}-${String(month).padStart(2, "0")}-01T12:00:00`)), "yyyy-MM-dd");
}

/** Normalize DateTime / YYYY-MM-DD / YYYY-MM / year / year-range into YYYY-MM-DD. */
export function normalizeDateKey(
  value: Date | string | number | null | undefined,
  bound: "start" | "end" = "start"
): string | null {
  if (value == null || value === "") return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return format(value, "yyyy-MM-dd");
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    const year = Math.trunc(value);
    return bound === "end" ? `${year}-12-31` : `${year}-01-01`;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const range = raw.match(YEAR_RANGE_RE);
  if (range) {
    const year = Number(bound === "end" ? range[2] : range[1]);
    return bound === "end" ? `${year}-12-31` : `${year}-01-01`;
  }

  if (DATE_RE.test(raw)) return raw;
  if (YEAR_MONTH_RE.test(raw)) {
    const [, y, m] = raw.match(YEAR_MONTH_RE)!;
    const year = Number(y);
    const month = Number(m);
    return bound === "end" ? lastDayOfMonth(year, month) : `${y}-${m}-01`;
  }
  if (YEAR_RE.test(raw)) {
    return bound === "end" ? `${raw}-12-31` : `${raw}-01-01`;
  }

  const parsed = parseISO(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return format(parsed, "yyyy-MM-dd");
}

export function dateInWindow(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

export function barOverlapsWindow(start: string, end: string, windowStart: string, windowEnd: string): boolean {
  return start <= windowEnd && end >= windowStart;
}

export function clipBar(
  start: string,
  end: string,
  windowStart: string,
  windowEnd: string
): { start: string; end: string } | null {
  if (!barOverlapsWindow(start, end, windowStart, windowEnd)) return null;
  return {
    start: start < windowStart ? windowStart : start,
    end: end > windowEnd ? windowEnd : end,
  };
}

export function daysBetween(start: string, end: string): number {
  return differenceInDays(atNoon(end), atNoon(start));
}

export function rangeToPercent(
  start: string,
  end: string,
  windowStart: string,
  windowEnd: string
): { left: number; width: number } | null {
  const clipped = clipBar(start, end, windowStart, windowEnd);
  if (!clipped) return null;
  const total = Math.max(1, daysBetween(windowStart, windowEnd) + 1);
  const leftDays = Math.max(0, daysBetween(windowStart, clipped.start));
  const span = Math.max(1, daysBetween(clipped.start, clipped.end) + 1);
  return {
    left: (leftDays / total) * 100,
    width: (span / total) * 100,
  };
}

export function dateToPercent(date: string, windowStart: string, windowEnd: string): number | null {
  if (!dateInWindow(date, windowStart, windowEnd)) return null;
  const total = Math.max(1, daysBetween(windowStart, windowEnd) + 1);
  const offset = daysBetween(windowStart, date) + 0.5;
  return (offset / total) * 100;
}

export function defaultWindow(scale: TimelineScale, today: string = todayKey()): { start: string; end: string } {
  const day = atNoon(today);
  if (scale === "decade") {
    const year = day.getFullYear();
    return { start: `${year}-01-01`, end: `${year + 9}-12-31` };
  }
  if (scale === "year") {
    return {
      start: format(startOfYear(day), "yyyy-MM-dd"),
      end: format(endOfYear(day), "yyyy-MM-dd"),
    };
  }
  return {
    start: format(startOfMonth(day), "yyyy-MM-dd"),
    end: format(endOfMonth(day), "yyyy-MM-dd"),
  };
}

export function shiftWindow(
  scale: TimelineScale,
  start: string,
  end: string,
  delta: number
): { start: string; end: string } {
  const from = atNoon(start);
  const to = atNoon(end);
  if (scale === "decade") {
    return {
      start: format(startOfYear(addYears(from, delta * 10)), "yyyy-MM-dd"),
      end: format(endOfYear(addYears(to, delta * 10)), "yyyy-MM-dd"),
    };
  }
  if (scale === "year") {
    return {
      start: format(startOfYear(addYears(from, delta)), "yyyy-MM-dd"),
      end: format(endOfYear(addYears(to, delta)), "yyyy-MM-dd"),
    };
  }
  return {
    start: format(startOfMonth(addMonths(from, delta)), "yyyy-MM-dd"),
    end: format(endOfMonth(addMonths(to, delta)), "yyyy-MM-dd"),
  };
}

export function resolveWindow(
  scale: TimelineScale,
  start: string | null | undefined,
  end: string | null | undefined,
  today: string = todayKey()
): { start: string; end: string } {
  const fallback = defaultWindow(scale, today);
  const resolvedStart = normalizeDateKey(start, "start") ?? fallback.start;
  const resolvedEnd = normalizeDateKey(end, "end") ?? fallback.end;
  if (resolvedStart > resolvedEnd) return fallback;
  return { start: resolvedStart, end: resolvedEnd };
}

export function buildColumns(scale: TimelineScale, start: string, end: string): TimelineColumn[] {
  const columns: TimelineColumn[] = [];
  if (scale === "decade") {
    let year = atNoon(start).getFullYear();
    const last = atNoon(end).getFullYear();
    while (year <= last) {
      columns.push({
        key: String(year),
        label: `${year}`,
        start: `${year}-01-01`,
        end: `${year}-12-31`,
      });
      year += 1;
    }
    return columns;
  }
  if (scale === "year") {
    let cursor = startOfMonth(atNoon(start));
    const last = startOfMonth(atNoon(end));
    while (cursor <= last) {
      const key = format(cursor, "yyyy-MM");
      columns.push({
        key,
        label: format(cursor, "M月", { locale: zhCN }),
        start: format(cursor, "yyyy-MM-dd"),
        end: format(endOfMonth(cursor), "yyyy-MM-dd"),
      });
      cursor = addMonths(cursor, 1);
    }
    return columns;
  }
  let cursor = atNoon(start);
  const last = atNoon(end);
  while (cursor <= last) {
    const key = format(cursor, "yyyy-MM-dd");
    columns.push({
      key,
      label: format(cursor, "d", { locale: zhCN }),
      start: key,
      end: key,
    });
    cursor = addDays(cursor, 1);
  }
  return columns;
}

export function columnWidth(scale: TimelineScale): number {
  if (scale === "decade") return 96;
  if (scale === "year") return 72;
  return 36;
}

export function itemStatus(done: boolean, date: string, today: string): TimelineStatus {
  if (done) return "done";
  if (date < today) return "overdue";
  return "upcoming";
}

export function dedupeBySourceId<T extends { sourceId: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (seen.has(item.sourceId)) continue;
    seen.add(item.sourceId);
    out.push(item);
  }
  return out;
}

export type SameDayCluster = {
  date: string;
  items: TimelineItem[];
};

export function clusterSameDayPoints(points: TimelineItem[]): SameDayCluster[] {
  const byDate = new Map<string, TimelineItem[]>();
  for (const item of points) {
    const list = byDate.get(item.start) ?? [];
    list.push(item);
    byDate.set(item.start, list);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({ date, items }));
}

/** Month: same day. Year: same month. Decade: same year. */
export function clusterPointsForScale(points: TimelineItem[], scale: TimelineScale): SameDayCluster[] {
  const keyLen = scale === "decade" ? 4 : scale === "year" ? 7 : 10;
  const byKey = new Map<string, TimelineItem[]>();
  for (const item of points) {
    const key = item.start.slice(0, keyLen);
    const list = byKey.get(key) ?? [];
    list.push(item);
    byKey.set(key, list);
  }
  return [...byKey.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, items]) => ({
      date: items[0]!.start,
      items,
    }));
}

export function timelineQuery(scale: TimelineScale, start?: string | null, end?: string | null) {
  const params = new URLSearchParams();
  params.set("scale", scale);
  if (start) params.set("start", start);
  if (end) params.set("end", end);
  return params.toString();
}

export function timelineViewQuery(
  view: TimelineView,
  extra?: { start?: string | null; end?: string | null; date?: string | null }
) {
  const params = new URLSearchParams();
  params.set("scale", view);
  if (view === "day") {
    if (extra?.date) params.set("date", extra.date);
    return params.toString();
  }
  if (view === "powers") {
    return params.toString();
  }
  if (extra?.start) params.set("start", extra.start);
  if (extra?.end) params.set("end", extra.end);
  return params.toString();
}

export type ProjectTimelineInput = ProjectPlanFields & {
  status: string;
  progress: number;
  sortOrder?: number;
  pinned?: boolean;
  archiveDate?: Date | string | null;
  targetDate?: Date | string | null;
  completedAt?: Date | string | null;
  planSteps: ProjectPlanStepDto[];
  milestones: Array<{
    id: string;
    title: string;
    dueDate: Date | string | null;
    completed: boolean;
    sortOrder: number;
  }>;
};

export type GoalTimelineInput = {
  id: string;
  title: string;
  area: string;
  status: string;
  targetDate: Date | string | null;
};

export type PhaseTimelineInput = {
  id: string;
  title: string;
  summary: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  sortOrder: number;
};

export type OpportunityTimelineInput = {
  id: string;
  title: string;
  status: string;
  deadline: string | null;
  nextAction: string | null;
  projectId: string | null;
  goalId: string | null;
};

export type MeetingTimelineInput = {
  id: string;
  title: string;
  status: string;
  meetingDate: string;
  meetingTime?: string | null;
  projectId: string | null;
};

export type TimelineOverrideInput = {
  source: string;
  sourceId: string;
  title: string | null;
  detail: string | null;
  startDate: string | null;
  endDate: string | null;
};

function pushItem(items: TimelineItem[], item: TimelineItem, windowStart: string, windowEnd: string) {
  if (item.kind === "bar") {
    const end = item.end ?? item.start;
    if (!clipBar(item.start, end, windowStart, windowEnd)) return;
  } else if (!dateInWindow(item.start, windowStart, windowEnd)) {
    return;
  }
  items.push(item);
}

function projectEndDate(project: ProjectTimelineInput): string | null {
  return (
    normalizeDateKey(project.targetDate, "end") ??
    normalizeDateKey(project.completedAt, "end") ??
    normalizeDateKey(project.archiveDate, "end")
  );
}

function applyTimelineOverride(
  item: TimelineItem,
  overrides: Map<string, TimelineOverrideInput>
): TimelineItem {
  const override = overrides.get(`${item.source}:${item.sourceId}`);
  if (!override) return item;
  return {
    ...item,
    title: override.title ?? item.title,
    detail: override.detail ?? item.detail,
    start: override.startDate ?? item.start,
    end: override.endDate ?? item.end,
    rowTitle:
      item.source === "foresight-era" && override.title ? override.title : item.rowTitle,
  };
}

function collectForesightItems(
  today: string,
  start: string,
  end: string,
  items: TimelineItem[],
  overrides: Map<string, TimelineOverrideInput>
) {
  for (const node of FORESIGHT_NODES) {
    const rowId = `foresight:${node.id}`;
    const barStart = `${node.yearStart}-01-01`;
    const barEnd = `${node.yearEnd}-12-31`;
    const href = `/foresight?id=${node.id}`;
    const eraDone = node.yearEnd < Number(today.slice(0, 4));
    pushItem(
      items,
      applyTimelineOverride({
        id: `foresight-era:${node.id}`,
        kind: "bar",
        layer: "vision",
        source: "foresight-era",
        sourceId: node.id,
        title: node.phase,
        detail: node.era,
        href,
        start: barStart,
        end: barEnd,
        rowId,
        rowTitle: node.phase,
        color: "#d97706",
        status: eraDone ? "done" : itemStatus(false, barEnd, today),
      }, overrides),
      start,
      end
    );
    pushItem(
      items,
      applyTimelineOverride({
        id: `foresight-vision:${node.id}`,
        kind: "point",
        layer: "vision",
        source: "foresight-vision",
        sourceId: node.id,
        title: node.you.vision,
        detail: `${node.era} · ${node.phase}`,
        href,
        start: barStart,
        rowId,
        rowTitle: node.phase,
        color: "#f59e0b",
        status: eraDone ? "done" : itemStatus(false, barStart, today),
      }, overrides),
      start,
      end
    );
    node.predictions.forEach((prediction, index) => {
      const predStart = normalizeDateKey(prediction.year, "start");
      if (!predStart) return;
      pushItem(
        items,
        applyTimelineOverride({
          id: `foresight-pred:${node.id}:${index}`,
          kind: "point",
          layer: "vision",
          source: "foresight-prediction",
          sourceId: `${node.id}:${prediction.year}:${index}`,
          title: prediction.text,
          detail: `${prediction.year} · ${prediction.area}`,
          href,
          start: predStart,
          rowId,
          rowTitle: node.phase,
          color: "#f59e0b",
          status: itemStatus(predStart < today, predStart, today),
        }, overrides),
        start,
        end
      );
    });
  }
}

function meetingDateKey(value: Date | string | null | undefined): string | null {
  return normalizeDateKey(value, "start");
}

export function collectTimelinePayload(input: {
  today?: string;
  scale: TimelineScale;
  start?: string | null;
  end?: string | null;
  projects: ProjectTimelineInput[];
  goals: GoalTimelineInput[];
  phases: PhaseTimelineInput[];
  opportunities: OpportunityTimelineInput[];
  meetings?: MeetingTimelineInput[];
  overrides?: TimelineOverrideInput[];
  rowOrder?: TimelineRowOrder;
}): TimelinePayload {
  const today = input.today ?? todayKey();
  const { start, end } = resolveWindow(input.scale, input.start, input.end, today);
  const items: TimelineItem[] = [];
  const pendingReview: TimelinePendingItem[] = [];
  let undatedProjectCount = 0;
  const projectNameById = new Map(
    input.projects.map((project) => [project.id, stripProjectYearPrefix(project.name)])
  );
  const goalTitleById = new Map(input.goals.map((goal) => [goal.id, goal.title]));
  const overrideMap = new Map(
    (input.overrides ?? []).map((override) => [
      `${override.source}:${override.sourceId}`,
      override,
    ])
  );

  const sortedPhases = [...input.phases].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const phase of sortedPhases) {
    const phaseStart = normalizeDateKey(phase.startDate, "start");
    const phaseEnd = normalizeDateKey(phase.endDate, "end");
    const rowId = `strategy:${phase.id}`;
    const href = `/strategy?id=${phase.id}`;
    const done = phase.status === "completed";
    if (phaseStart && phaseEnd) {
      pushItem(
        items,
        {
          id: `strategy-bar:${phase.id}`,
          kind: "bar",
          layer: "vision",
          source: "strategy-phase",
          sourceId: phase.id,
          title: phase.title,
          detail: phase.summary ?? undefined,
          href,
          start: phaseStart,
          end: phaseEnd,
          rowId,
          rowTitle: phase.title,
          color: "#6366f1",
          status: itemStatus(done, phaseEnd, today),
        },
        start,
        end
      );
    } else {
      const only = phaseStart ?? phaseEnd;
      if (!only) continue;
      pushItem(
        items,
        {
          id: `strategy-point:${phase.id}`,
          kind: "point",
          layer: "vision",
          source: "strategy-phase",
          sourceId: phase.id,
          title: phase.title,
          detail: phase.summary ?? undefined,
          href,
          start: only,
          rowId,
          rowTitle: phase.title,
          color: "#6366f1",
          status: itemStatus(done, only, today),
        },
        start,
        end
      );
    }
  }

  collectForesightItems(today, start, end, items, overrideMap);

  for (const goal of input.goals) {
    if (goal.status === "ARCHIVED") continue;
    const date = normalizeDateKey(goal.targetDate, "start");
    if (!date) continue;
    const color = GOAL_AREA_HEX[goal.area] ?? "#d97706";
    pushItem(
      items,
      {
        id: `goal:${goal.id}`,
        kind: "point",
        layer: "goal",
        source: "goal",
        sourceId: goal.id,
        title: goal.title,
        detail: "人生目标",
        href: `/goals/${goal.id}`,
        start: date,
        rowId: `goal:${goal.id}`,
        rowTitle: goal.title,
        color,
        status: itemStatus(goal.status === "COMPLETED", date, today),
      },
      start,
      end
    );
  }

  for (const project of input.projects) {
    const name = stripProjectYearPrefix(project.name);
    const color = project.category?.color ?? "#6366f1";
    const rowId = `project:${project.id}`;
    const href = `/projects?id=${project.id}`;
    const startDate = normalizeDateKey(project.startDate, "start");
    const endDate = projectEndDate(project);
    const done = isProjectDone(project);
    const before = items.length;

    if (startDate && endDate) {
      pushItem(
        items,
        {
          id: `project-bar:${project.id}`,
          kind: "bar",
          layer: "project",
          source: "project",
          sourceId: project.id,
          title: name,
          href,
          start: startDate,
          end: endDate,
          rowId,
          rowTitle: name,
          projectId: project.id,
          color,
          status: itemStatus(done, endDate, today),
        },
        start,
        end
      );
    } else if (endDate) {
      pushItem(
        items,
        {
          id: `project-point:${project.id}`,
          kind: "point",
          layer: "project",
          source: "project",
          sourceId: project.id,
          title: name,
          detail: "项目截止日",
          href,
          start: endDate,
          rowId,
          rowTitle: name,
          projectId: project.id,
          color,
          status: itemStatus(done, endDate, today),
        },
        start,
        end
      );
    }

    const milestoneCandidates: TimelineItem[] = [];
    for (const milestone of project.milestones) {
      const due = normalizeDateKey(milestone.dueDate, "start");
      if (!due) continue;
      milestoneCandidates.push({
        id: `milestone:${milestone.id}`,
        kind: "point",
        layer: "project",
        source: "milestone",
        sourceId: milestone.id,
        title: milestone.title,
        detail: name,
        href,
        start: due,
        rowId,
        rowTitle: name,
        projectId: project.id,
        color,
        status: itemStatus(milestone.completed, due, today),
      });
    }

    if (showsStepPoints(input.scale) && project.planActive && project.planSteps.length > 0) {
      const mapped = mapStepsToDates(project, project.planSteps, today);
      for (const daySteps of Object.values(mapped.byDate)) {
        for (const step of daySteps) {
          milestoneCandidates.push({
            id: `step:${step.id}`,
            kind: "point",
            layer: "project",
            source: "plan-step",
            sourceId: step.id,
            title: step.title,
            detail: step.detail ?? name,
            href,
            start: step.mappedDate,
            rowId,
            rowTitle: name,
            projectId: project.id,
            color,
            status: itemStatus(step.done, step.mappedDate, today),
            computed: !step.isPinned,
          });
        }
      }
    }

    const unique = dedupeBySourceId(milestoneCandidates);
    for (const item of unique) {
      pushItem(items, item, start, end);
    }

    if (items.length === before && !startDate && !endDate) {
      undatedProjectCount += 1;
    }
  }

  for (const opp of input.opportunities) {
    if (SKIPPED_OPP_STATUSES.has(opp.status)) continue;
    const related =
      (opp.projectId && projectNameById.get(opp.projectId)
        ? projectNameById.get(opp.projectId)
        : undefined) ??
      (opp.goalId ? goalTitleById.get(opp.goalId) : undefined);
    const href = `/opportunities?id=${opp.id}`;
    const date = normalizeDateKey(opp.deadline, "start");
    if (!date) {
      if (opp.status !== "Won") {
        pendingReview.push({
          id: `opportunity:${opp.id}`,
          kind: "opportunity",
          title: opp.title,
          detail: related ? `未排期 · ${related}` : "未排期",
          href,
        });
      }
      continue;
    }
    const color = "#d97706";
    pushItem(
      items,
      {
        id: `opportunity:${opp.id}`,
        kind: "point",
        layer: "event",
        source: "opportunity",
        sourceId: opp.id,
        title: opp.title,
        detail: [related, opp.nextAction ?? "机会截止"].filter(Boolean).join(" · "),
        href,
        start: date,
        rowId: `opportunity:${opp.id}`,
        rowTitle: opp.title,
        projectId: opp.projectId ?? undefined,
        color,
        status: itemStatus(opp.status === "Won", date, today),
      },
      start,
      end
    );
  }

  for (const meeting of input.meetings ?? []) {
    if (meeting.status === "Cancelled") continue;
    const href = `/meetings?id=${meeting.id}`;
    const related = meeting.projectId ? projectNameById.get(meeting.projectId) : undefined;
    const date = meetingDateKey(meeting.meetingDate);
    const timeLabel = meeting.meetingTime?.trim() || "";
    const detail = [timeLabel, meeting.status, related].filter(Boolean).join(" · ");
    const meetingDone = meeting.status === "Completed" || meeting.status === "FollowUp";
    if (!meetingDone && (meeting.status === "NeedsReview" || !date)) {
      pendingReview.push({
        id: `meeting:${meeting.id}`,
        kind: "meeting",
        title: meeting.title,
        detail: date ? `${date}${detail ? ` · ${detail}` : ""}` : detail || "待确认",
        href,
      });
      if (!date) continue;
    }
    pushItem(
      items,
      {
        id: `meeting:${meeting.id}`,
        kind: "point",
        layer: "event",
        source: "meeting",
        sourceId: meeting.id,
        title: meeting.title,
        detail,
        href,
        start: date!,
        rowId: `meeting:${meeting.id}`,
        rowTitle: meeting.title,
        projectId: meeting.projectId ?? undefined,
        color: "#0ea5e9",
        status: itemStatus(
          meeting.status === "Completed" || meeting.status === "FollowUp",
          date!,
          today
        ),
      },
      start,
      end
    );
  }

  const projectOrder = new Map(
    [...input.projects]
      .sort((a, b) => {
        if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
        return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      })
      .map((project, index) => [`project:${project.id}`, index])
  );

  const rowMap = new Map<string, TimelineRow>();
  const ensureRow = (row: TimelineRow) => {
    if (rowMap.has(row.id)) return;
    rowMap.set(row.id, row);
  };
  for (const item of items) {
    ensureRow({
      id: item.rowId,
      layer: item.layer,
      title: item.rowTitle,
      href: item.href,
      color: item.color,
      subtitle: SOURCE_LABELS[item.source],
    });
  }
  for (const project of input.projects) {
    const rowId = `project:${project.id}`;
    const name = stripProjectYearPrefix(project.name);
    const hasWindowItem = items.some((item) => item.rowId === rowId);
    const startDate = normalizeDateKey(project.startDate, "start");
    const endDate = projectEndDate(project);
    if (!hasWindowItem) {
      ensureRow({
        id: rowId,
        layer: "project",
        title: name,
        href: `/projects?id=${project.id}`,
        color: project.category?.color ?? "#6366f1",
        subtitle: startDate || endDate ? "当前窗口无日期" : "未排期",
      });
    }
  }

  const pinnedProjects = new Set(
    input.projects.filter((project) => project.pinned).map((project) => `project:${project.id}`)
  );
  for (const row of rowMap.values()) {
    if (pinnedProjects.has(row.id)) row.pinned = true;
  }
  const manualRank = new Map<string, number>();
  for (const ids of Object.values(input.rowOrder ?? {})) {
    ids?.forEach((id, index) => manualRank.set(id, index));
  }

  const rows = [...rowMap.values()].sort((a, b) => {
    const layerDiff = LAYER_ORDER.indexOf(a.layer) - LAYER_ORDER.indexOf(b.layer);
    if (layerDiff !== 0) return layerDiff;
    if (a.layer === "project") {
      return (projectOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (projectOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER);
    }
    const rankA = manualRank.get(a.id);
    const rankB = manualRank.get(b.id);
    if (rankA !== undefined || rankB !== undefined) {
      return (rankA ?? Number.MAX_SAFE_INTEGER) - (rankB ?? Number.MAX_SAFE_INTEGER);
    }
    return a.title.localeCompare(b.title, "zh");
  });

  items.sort((a, b) => {
    const layerDiff = LAYER_ORDER.indexOf(a.layer) - LAYER_ORDER.indexOf(b.layer);
    if (layerDiff !== 0) return layerDiff;
    if (a.rowId !== b.rowId) {
      if (a.layer === "project" && b.layer === "project") {
        return (projectOrder.get(a.rowId) ?? 0) - (projectOrder.get(b.rowId) ?? 0);
      }
      return a.rowTitle.localeCompare(b.rowTitle, "zh");
    }
    if (a.kind !== b.kind) return a.kind === "bar" ? -1 : 1;
    return a.start.localeCompare(b.start);
  });

  return {
    scale: input.scale,
    start,
    end,
    today,
    columns: buildColumns(input.scale, start, end),
    rows,
    items,
    undatedProjectCount,
    pendingReview,
  };
}
