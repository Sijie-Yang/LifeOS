import { addDays, format, parseISO } from "date-fns";

export const PORTFOLIO_DAILY_CAP = 3;
export const PORTFOLIO_CUTOFF = "2026-09-02";

const PRIORITY_RANK: Record<string, number> = {
  HIGH: 0,
  MEDIUM: 1,
  LOW: 2,
};

export type PortfolioStepInput = {
  id: string;
  sortOrder: number;
  done: boolean;
  scheduledDate?: string | null;
};

export type PortfolioProjectInput = {
  id: string;
  name: string;
  pinned?: boolean;
  priority?: string;
  sortOrder?: number;
  deadlineRisk?: number;
  steps: PortfolioStepInput[];
};

export type PortfolioAssignment = {
  stepId: string;
  projectId: string;
  date: string;
};

export type PortfolioScheduleResult = {
  assignments: PortfolioAssignment[];
  daysUsed: number;
  openCount: number;
};

function nextCalendarDay(date: string): string {
  return format(addDays(parseISO(`${date}T12:00:00`), 1), "yyyy-MM-dd");
}

function projectRank(project: PortfolioProjectInput) {
  return {
    risk: -(project.deadlineRisk ?? 0),
    pinned: project.pinned ? 0 : 1,
    priority: PRIORITY_RANK[project.priority ?? "MEDIUM"] ?? 1,
    sort: project.sortOrder ?? 0,
  };
}

function compareProjects(a: PortfolioProjectInput, b: PortfolioProjectInput) {
  const ra = projectRank(a);
  const rb = projectRank(b);
  return ra.risk - rb.risk || ra.pinned - rb.pinned || ra.priority - rb.priority || ra.sort - rb.sort;
}

/**
 * Round-robin open steps across ACTIVE projects so one long project cannot fill the calendar.
 * Constraints: dailyCap open steps/day globally; 1 open step/project/day.
 */
export function schedulePortfolio(
  projects: PortfolioProjectInput[],
  startDate: string,
  dailyCap = PORTFOLIO_DAILY_CAP
): PortfolioScheduleResult {
  const queues = projects
    .map((project) => ({
      project,
      open: project.steps
        .filter((step) => !step.done)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((step) => step.id),
    }))
    .filter((queue) => queue.open.length > 0)
    .sort((a, b) => compareProjects(a.project, b.project));

  const assignments: PortfolioAssignment[] = [];
  let date = startDate;
  let guard = 0;
  let cursor = 0;

  while (queues.some((queue) => queue.open.length > 0) && guard < 20000) {
    const usedProjects = new Set<string>();
    let placed = 0;
    let progressed = false;
    let scanned = 0;

    while (scanned < queues.length && placed < dailyCap) {
      const queue = queues[(cursor + scanned) % queues.length]!;
      scanned += 1;
      if (!queue.open.length || usedProjects.has(queue.project.id)) continue;
      const stepId = queue.open.shift();
      if (!stepId) continue;
      assignments.push({ stepId, projectId: queue.project.id, date });
      usedProjects.add(queue.project.id);
      placed += 1;
      progressed = true;
    }

    if (!progressed) break;
    cursor = (cursor + scanned) % queues.length;
    if (queues.some((queue) => queue.open.length > 0)) date = nextCalendarDay(date);
    guard += 1;
  }

  return {
    assignments,
    daysUsed: assignments.length ? 1 + Math.floor((assignments.length - 1) / dailyCap) : 0,
    openCount: assignments.length,
  };
}

export function assignmentsByDay(assignments: PortfolioAssignment[]) {
  const map = new Map<string, PortfolioAssignment[]>();
  for (const item of assignments) {
    const list = map.get(item.date) ?? [];
    list.push(item);
    map.set(item.date, list);
  }
  return map;
}

export function assertDailyCap(assignments: PortfolioAssignment[], dailyCap = PORTFOLIO_DAILY_CAP) {
  for (const [, items] of assignmentsByDay(assignments)) {
    if (items.length > dailyCap) return false;
    const projects = new Set(items.map((item) => item.projectId));
    if (projects.size !== items.length) return false;
  }
  return true;
}
