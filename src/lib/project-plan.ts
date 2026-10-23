import { addDays, format, parseISO, startOfMonth, endOfMonth, isAfter, isBefore } from "date-fns";
import { parseDaysOfWeek } from "@/lib/reminders";

export type ProjectPlanFields = {
  id: string;
  name: string;
  planActive: boolean;
  planWorkdays: string;
  planAnchorDate: string | null;
  planSkipDates: string;
  planExtraDates: string;
  startDate?: Date | null;
  category?: { color: string } | null;
};

export type ProjectPlanStepDto = {
  id: string;
  projectId: string;
  sortOrder: number;
  title: string;
  detail: string | null;
  estMinutes: number | null;
  milestoneId: string | null;
  isMilestone: boolean;
  done: boolean;
  doneDate: string | null;
  scheduledDate?: string | null;
};

export type MappedPlanStep = ProjectPlanStepDto & {
  projectId: string;
  projectName: string;
  projectColor: string;
  mappedDate: string;
  isPinned: boolean;
};

export type PlanMappingResult = {
  byDate: Record<string, MappedPlanStep[]>;
  nextWorkday: string | null;
  nextStep: MappedPlanStep | null;
};

function parseJsonStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function getProjectPlanAnchor(project: ProjectPlanFields, today: string): string {
  if (project.planAnchorDate) return project.planAnchorDate;
  if (project.startDate) return format(project.startDate, "yyyy-MM-dd");
  return today;
}

/** Whether date is a work-day for this project (rule + extra - skip). */
export function isWorkDayForProject(project: ProjectPlanFields, dateStr: string): boolean {
  const skip = new Set(parseJsonStringArray(project.planSkipDates));
  if (skip.has(dateStr)) return false;

  const extra = new Set(parseJsonStringArray(project.planExtraDates));
  if (extra.has(dateStr)) return true;

  const workdays = parseDaysOfWeek(project.planWorkdays);
  const d = parseISO(`${dateStr}T12:00:00`);
  return workdays.includes(d.getDay());
}

/** Enumerate work-days starting from fromDate (inclusive), up to count days. */
export function getWorkDaysFrom(
  project: ProjectPlanFields,
  fromDate: string,
  count: number,
  maxScanDays = 730
): string[] {
  const result: string[] = [];
  let cursor = parseISO(`${fromDate}T12:00:00`);
  let scanned = 0;

  while (result.length < count && scanned < maxScanDays) {
    const dateStr = format(cursor, "yyyy-MM-dd");
    if (isWorkDayForProject(project, dateStr)) {
      result.push(dateStr);
    }
    cursor = addDays(cursor, 1);
    scanned++;
  }

  return result;
}

/**
 * Map ordered steps to calendar dates:
 * - done steps pin to doneDate
 * - open steps pack 1/workday from anchor
 * - dates already used by a done step are occupied (next open step does NOT slide onto that day)
 */
export function mapStepsToDates(
  project: ProjectPlanFields,
  steps: ProjectPlanStepDto[],
  today: string
): PlanMappingResult {
  const sorted = [...steps].sort((a, b) => a.sortOrder - b.sortOrder);
  const byDate: Record<string, MappedPlanStep[]> = {};
  const projectColor = project.category?.color ?? "#6366f1";

  const addToDate = (dateStr: string, step: ProjectPlanStepDto, isPinned: boolean) => {
    const mapped: MappedPlanStep = {
      ...step,
      projectId: project.id,
      projectName: project.name,
      projectColor,
      mappedDate: dateStr,
      isPinned,
    };
    if (!byDate[dateStr]) byDate[dateStr] = [];
    byDate[dateStr].push(mapped);
  };

  const occupiedDates = new Set<string>();
  for (const step of sorted) {
    if (step.done) {
      occupiedDates.add(step.doneDate ?? today);
    }
  }

  const anchor = getProjectPlanAnchor(project, today);
  // 自动顺延：未完成的步骤不留在过去。从今天（或更晚的锚点）起排；
  // 钉在过去日期却没做的步骤，同样回到队列里按顺序顺延。
  const rollFrom = anchor > today ? anchor : today;
  const pinnedAhead = (s: ProjectPlanStepDto) => Boolean(s.scheduledDate && s.scheduledDate >= today);
  const openToPlace = sorted.filter((s) => !s.done && !pinnedAhead(s)).length;
  // Extra headroom: skipped occupied days + buffer
  // 钉在今天及以后的步骤占住那一天：每个项目每天最多一步，积压顺延到下一个空的工作日
  const pinnedDates = new Set(sorted.filter((s) => !s.done && pinnedAhead(s)).map((s) => s.scheduledDate!));
  const workDays = getWorkDaysFrom(
    project,
    rollFrom,
    openToPlace + occupiedDates.size + pinnedDates.size + 30
  ).filter((d) => !occupiedDates.has(d) && !pinnedDates.has(d));

  // Always the earliest unfinished step (by sortOrder) takes the first free slot,
  // so a backlog catches up from today instead of piling up in the past.
  let nextWorkday: string | null = null;
  let nextStep: MappedPlanStep | null = null;
  let openSlot = 0;

  for (const step of sorted) {
    if (step.done) {
      const pinDate = step.doneDate ?? today;
      addToDate(pinDate, step, true);
      continue;
    }

    const pinned = pinnedAhead(step);
    const slotDate = pinned ? step.scheduledDate! : workDays[openSlot++];
    if (!slotDate) continue;

    addToDate(slotDate, step, pinned);

    const mapped: MappedPlanStep = {
      ...step,
      projectId: project.id,
      projectName: project.name,
      projectColor,
      mappedDate: slotDate,
      isPinned: pinned,
    };

    if (!nextStep || slotDate < nextStep.mappedDate) {
      nextWorkday = slotDate;
      nextStep = mapped;
    }
  }

  return { byDate, nextWorkday, nextStep };
}

export function getMonthDateRange(month: string): { start: string; end: string } {
  const base = parseISO(`${month}-01T12:00:00`);
  return {
    start: format(startOfMonth(base), "yyyy-MM-dd"),
    end: format(endOfMonth(base), "yyyy-MM-dd"),
  };
}

export function buildMonthGrid(month: string): Array<Array<{ date: string; inMonth: boolean } | null>> {
  const base = parseISO(`${month}-01T12:00:00`);
  const monthStart = startOfMonth(base);
  const monthEnd = endOfMonth(base);
  const pad = (monthStart.getDay() + 6) % 7;

  const rows: Array<Array<{ date: string; inMonth: boolean } | null>> = [];
  let week: Array<{ date: string; inMonth: boolean } | null> = Array(pad).fill(null);

  let cursor = monthStart;
  while (!isAfter(cursor, monthEnd)) {
    week.push({ date: format(cursor, "yyyy-MM-dd"), inMonth: true });
    if (week.length === 7) {
      rows.push(week);
      week = [];
    }
    cursor = addDays(cursor, 1);
  }

  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    rows.push(week);
  }

  return rows;
}

export function toggleSkipDate(skipDatesJson: string, date: string, skip: boolean): string {
  const set = new Set(parseJsonStringArray(skipDatesJson));
  if (skip) set.add(date);
  else set.delete(date);
  return JSON.stringify([...set].sort());
}

export function toggleExtraDate(extraDatesJson: string, date: string, add: boolean): string {
  const set = new Set(parseJsonStringArray(extraDatesJson));
  if (add) set.add(date);
  else set.delete(date);
  return JSON.stringify([...set].sort());
}

/** Previous calendar work-day strictly before beforeDate. */
export function getPreviousWorkDay(
  project: ProjectPlanFields,
  beforeDate: string,
  maxScanDays = 730
): string | null {
  let cursor = addDays(parseISO(`${beforeDate}T12:00:00`), -1);
  let scanned = 0;

  while (scanned < maxScanDays) {
    const dateStr = format(cursor, "yyyy-MM-dd");
    if (isWorkDayForProject(project, dateStr)) return dateStr;
    cursor = addDays(cursor, -1);
    scanned++;
  }

  return null;
}

/**
 * Next work-day to skip for「往后推一天」.
 * Starts at `fromDate` (inclusive); if that day is already skipped or not a
 * work-day, walks forward so repeated clicks keep advancing the plan.
 */
export function resolvePushBackSkipDate(
  project: ProjectPlanFields,
  fromDate: string,
  maxScanDays = 730
): string | null {
  const skip = new Set(parseJsonStringArray(project.planSkipDates));
  let cursor = parseISO(`${fromDate}T12:00:00`);
  let scanned = 0;

  while (scanned < maxScanDays) {
    const dateStr = format(cursor, "yyyy-MM-dd");
    if (isWorkDayForProject(project, dateStr) && !skip.has(dateStr)) {
      return dateStr;
    }
    cursor = addDays(cursor, 1);
    scanned++;
  }

  return null;
}

/** Skip N successive work-days starting at fromDate (inclusive), shifting unfinished steps later. */
export function applyPushBackN(
  project: ProjectPlanFields,
  fromDate: string,
  n: number
): { planSkipDates: string; skippedDates: string[] } {
  const count = Math.max(0, Math.min(60, Math.floor(n)));
  let skipJson = project.planSkipDates;
  let current: ProjectPlanFields = { ...project };
  const skippedDates: string[] = [];

  for (let i = 0; i < count; i++) {
    const skipDate = resolvePushBackSkipDate(current, fromDate);
    if (!skipDate) break;
    skipJson = toggleSkipDate(skipJson, skipDate, true);
    skippedDates.push(skipDate);
    current = { ...current, planSkipDates: skipJson };
  }

  return { planSkipDates: skipJson, skippedDates };
}

/** First project workday on or after `fromDate` (today if today is a workday). */
export function getNextWorkdayOnOrAfter(
  project: ProjectPlanFields,
  fromDate: string
): string | null {
  return getWorkDaysFrom(project, fromDate, 1)[0] ?? null;
}

/**
 * One-click postpone for unfinished steps:
 * - If next open step is before today / next project workday → land on that floor
 * - If already on/after the floor → push one more project workday (always moves)
 * Done/pinned steps are unchanged.
 */
export function applyCatchUpToToday(
  project: ProjectPlanFields,
  steps: ProjectPlanStepDto[],
  today: string
):
  | { kind: "ok"; planSkipDates: string; skippedDates: string[]; targetDate: string }
  | { kind: "noop"; reason: "no_target" | "no_open" } {
  const floor = getNextWorkdayOnOrAfter(project, today);
  if (!floor) return { kind: "noop", reason: "no_target" };

  const initial = mapStepsToDates(project, steps, today);
  if (!initial.nextStep) return { kind: "noop", reason: "no_open" };

  // Earliest open (unpinned) mapped date — the head of the unfinished block
  let frontier: string | null = null;
  for (const [date, daySteps] of Object.entries(initial.byDate)) {
    for (const s of daySteps) {
      if (!s.done && !s.isPinned) {
        if (!frontier || date < frontier) frontier = date;
      }
    }
  }
  frontier = frontier ?? initial.nextStep.mappedDate;

  // Overdue/behind → snap whole block to floor; already on/after floor → advance one workday
  let landing: string | null;
  if (frontier < floor) {
    landing = floor;
  } else {
    const dayAfter = format(addDays(parseISO(`${frontier}T12:00:00`), 1), "yyyy-MM-dd");
    landing = getNextWorkdayOnOrAfter(project, dayAfter);
  }
  if (!landing) return { kind: "noop", reason: "no_target" };

  let skipJson = project.planSkipDates;
  const skippedDates: string[] = [];

  // Skip every still-active workday in [frontier, landing)
  let cursor = parseISO(`${frontier}T12:00:00`);
  const end = parseISO(`${landing}T12:00:00`);
  while (cursor < end) {
    const dateStr = format(cursor, "yyyy-MM-dd");
    const probe: ProjectPlanFields = { ...project, planSkipDates: skipJson };
    if (isWorkDayForProject(probe, dateStr)) {
      skipJson = toggleSkipDate(skipJson, dateStr, true);
      skippedDates.push(dateStr);
    }
    cursor = addDays(cursor, 1);
  }

  // Safety: keep pushing until next open lands on/after landing
  let current: ProjectPlanFields = { ...project, planSkipDates: skipJson };
  for (let guard = 0; guard < 40; guard++) {
    const { nextStep } = mapStepsToDates(current, steps, today);
    if (!nextStep || nextStep.mappedDate >= landing) break;
    const skipDate = resolvePushBackSkipDate(current, nextStep.mappedDate);
    if (!skipDate || skipDate >= landing) break;
    skipJson = toggleSkipDate(skipJson, skipDate, true);
    skippedDates.push(skipDate);
    current = { ...current, planSkipDates: skipJson };
  }

  if (skippedDates.length === 0) {
    // Landing is the next slot: explicitly skip the frontier workday
    const skipDate = resolvePushBackSkipDate(project, frontier);
    if (skipDate) {
      skipJson = toggleSkipDate(project.planSkipDates, skipDate, true);
      skippedDates.push(skipDate);
    }
  }

  if (skippedDates.length === 0) return { kind: "noop", reason: "no_target" };
  return { kind: "ok", planSkipDates: skipJson, skippedDates, targetDate: landing };
}

/** Latest skipped date strictly before beforeDate (undo target for pushForward). */
export function findLatestSkippedDateBefore(skipDatesJson: string, beforeDate: string): string | null {
  const candidates = parseJsonStringArray(skipDatesJson)
    .filter((d) => d < beforeDate)
    .sort();
  return candidates.length ? candidates[candidates.length - 1] : null;
}

export type PushForwardResult =
  | { kind: "unskip"; date: string; planSkipDates: string }
  | { kind: "anchor"; planAnchorDate: string }
  | { kind: "noop" };

/** Pull plan one work-day earlier: unskip (inverse of pushBack) or advance anchor. */
export function applyPushForward(
  project: ProjectPlanFields,
  date: string,
  today: string
): PushForwardResult {
  const skipDates = parseJsonStringArray(project.planSkipDates);

  if (skipDates.includes(date)) {
    return {
      kind: "unskip",
      date,
      planSkipDates: toggleSkipDate(project.planSkipDates, date, false),
    };
  }

  const skippedBefore = findLatestSkippedDateBefore(project.planSkipDates, date);
  if (skippedBefore) {
    return {
      kind: "unskip",
      date: skippedBefore,
      planSkipDates: toggleSkipDate(project.planSkipDates, skippedBefore, false),
    };
  }

  const anchor = getProjectPlanAnchor(project, today);
  const prev = getPreviousWorkDay(project, anchor);
  if (prev && prev < anchor) {
    return { kind: "anchor", planAnchorDate: prev };
  }

  return { kind: "noop" };
}

export function filterByDateRange(
  byDate: Record<string, MappedPlanStep[]>,
  start: string,
  end: string
): Record<string, MappedPlanStep[]> {
  const out: Record<string, MappedPlanStep[]> = {};
  for (const [date, steps] of Object.entries(byDate)) {
    if (date >= start && date <= end) {
      out[date] = steps;
    }
  }
  return out;
}

export function dateInRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

export function isDateBeforeToday(date: string, today: string): boolean {
  return isBefore(parseISO(`${date}T12:00:00`), parseISO(`${today}T12:00:00`));
}
