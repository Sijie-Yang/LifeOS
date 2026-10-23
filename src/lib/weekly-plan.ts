import { randomUUID } from "crypto";

export type WeeklyPriority = {
  id: string;
  title: string;
  goalId?: string | null;
  projectId?: string | null;
  completed: boolean;
};

export const MAX_WEEKLY_PRIORITIES = 3;

export function parsePriorities(raw: string | null | undefined): WeeklyPriority[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is WeeklyPriority =>
          x &&
          typeof x === "object" &&
          typeof x.title === "string" &&
          typeof x.id === "string"
      )
      .map((x) => ({
        id: x.id,
        title: x.title,
        goalId: x.goalId ?? null,
        projectId: x.projectId ?? null,
        completed: Boolean(x.completed),
      }))
      .slice(0, MAX_WEEKLY_PRIORITIES);
  } catch {
    return [];
  }
}

export function normalizePriorities(items: WeeklyPriority[]): WeeklyPriority[] {
  return items.slice(0, MAX_WEEKLY_PRIORITIES).map((item) => ({
    id: item.id || randomUUID(),
    title: item.title.trim(),
    goalId: item.goalId || null,
    projectId: item.projectId || null,
    completed: Boolean(item.completed),
  }));
}

export function serializePriorities(items: WeeklyPriority[]): string {
  return JSON.stringify(normalizePriorities(items));
}
