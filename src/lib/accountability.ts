import { differenceInDays } from "date-fns";

export type MustDoItem =
  | { type: "habit" | "task"; id: string }
  | { type: "priority"; id: string; title: string; done?: boolean };

const MAX_MUST_DO = 3;

export function parseMustDo(raw: string | null | undefined): MustDoItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x): x is MustDoItem => {
        if (!x || typeof x !== "object" || typeof x.id !== "string") return false;
        if (x.type === "habit" || x.type === "task") return true;
        if (x.type === "priority" && typeof x.title === "string") return true;
        return false;
      })
      .slice(0, MAX_MUST_DO);
  } catch {
    return [];
  }
}

export function normalizeMustDo(items: MustDoItem[]): MustDoItem[] {
  const seen = new Set<string>();
  const out: MustDoItem[] = [];
  for (const item of items) {
    const key = `${item.type}:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (item.type === "priority") {
      out.push({
        type: "priority",
        id: item.id,
        title: item.title.trim(),
        done: Boolean(item.done),
      });
    } else {
      out.push(item);
    }
    if (out.length >= MAX_MUST_DO) break;
  }
  return out;
}

export function isEveningReminderHour(now = new Date()) {
  return now.getHours() >= 18;
}

export function isCloseReminderHour(now = new Date()) {
  return now.getHours() >= 21;
}

export function isStaleGoal(goal: { updatedAt: Date; status: string }) {
  return goal.status === "ACTIVE" && differenceInDays(new Date(), goal.updatedAt) >= 14;
}

export function isMustDoDone(
  item: MustDoItem,
  checkedHabitIds: Set<string>,
  completedTaskIds: Set<string>
) {
  if (item.type === "habit") return checkedHabitIds.has(item.id);
  if (item.type === "task") return completedTaskIds.has(item.id);
  if (item.type === "priority") return Boolean(item.done);
  return false;
}
