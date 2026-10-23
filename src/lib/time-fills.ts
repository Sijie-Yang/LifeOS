import { clockMinutes } from "./sleep-window";

export const TIME_FILL_CATEGORIES = [
  { id: "research", label: "科研", color: "#4f46e5" },
  { id: "startup", label: "创业", color: "#ea580c" },
  { id: "learning", label: "学习", color: "#0284c7" },
  { id: "move", label: "运动", color: "#059669" },
  { id: "tidy", label: "整理", color: "#0f766e" },
  { id: "social", label: "社交", color: "#db2777" },
  { id: "life", label: "生活", color: "#a16207" },
  { id: "commute", label: "通勤", color: "#0891b2" },
  { id: "play", label: "娱乐", color: "#7c3aed" },
  { id: "rest", label: "休息", color: "#57534e" },
] as const;

export type TimeFillCategoryId = (typeof TIME_FILL_CATEGORIES)[number]["id"];

const CATEGORY_IDS = new Set<string>(TIME_FILL_CATEGORIES.map((item) => item.id));

export function timeFillCategory(id: string | null | undefined) {
  return TIME_FILL_CATEGORIES.find((item) => item.id === id) ?? null;
}

export function parseTimeFills(value: unknown): Record<string, TimeFillCategoryId> {
  let raw: unknown = value;
  if (typeof value === "string") {
    if (!value.trim()) return {};
    try {
      raw = JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const fills: Record<string, TimeFillCategoryId> = {};
  for (const [slot, category] of Object.entries(raw)) {
    if (!/^\d{2}:\d{2}$/.test(slot) || typeof category !== "string" || !CATEGORY_IDS.has(category)) continue;
    fills[slot] = category as TimeFillCategoryId;
  }
  return fills;
}

function slotLabel(totalMinutes: number) {
  const wrapped = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour = Math.floor(wrapped / 60);
  const minute = wrapped % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Half-hour starts. Wake sets the first slot; bedtime sets the last. Otherwise 06:00–23:00. */
export function halfHourSlots(wakeTime: string | null, endTime: string | null): string[] {
  const start = wakeTime ? Math.floor(clockMinutes(wakeTime) / 30) * 30 : 6 * 60;
  let end = endTime ? clockMinutes(endTime) : 23 * 60;
  if (endTime && wakeTime && end <= clockMinutes(wakeTime)) end += 24 * 60;
  const slots: string[] = [];
  for (let minute = start; minute < end; minute += 30) slots.push(slotLabel(minute));
  return slots;
}
