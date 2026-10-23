export type HabitSegmentKey = "morning" | "midday" | "afternoon" | "evening" | "anytime";

export const HABIT_SEGMENTS: Array<{ key: HabitSegmentKey; label: string; from: number; to: number }> = [
  { key: "morning", label: "早晨", from: 0, to: 11 * 60 },
  { key: "midday", label: "午间", from: 11 * 60, to: 14 * 60 },
  { key: "afternoon", label: "下午", from: 14 * 60, to: 18 * 60 },
  { key: "evening", label: "晚间", from: 18 * 60, to: 24 * 60 },
  { key: "anytime", label: "全天守则", from: 0, to: 24 * 60 },
];

function toMinutes(hhmm: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm?.trim() ?? "");
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function segmentForMinutes(minutes: number): HabitSegmentKey {
  const hit = HABIT_SEGMENTS.find((s) => s.key !== "anytime" && minutes >= s.from && minutes < s.to);
  return hit?.key ?? "evening";
}

/** Untimed habits fall back to name hints; evening hints win so 早睡 lands at night. */
export function habitSegment(habit: { name: string; startTime?: string | null }): HabitSegmentKey {
  const start = toMinutes(habit.startTime);
  if (start !== null) return segmentForMinutes(start);
  if (/睡|关账|晚|夜/.test(habit.name)) return "evening";
  if (/早|晨|日计划/.test(habit.name)) return "morning";
  return "anytime";
}

export function currentSegment(now: Date = new Date()): HabitSegmentKey {
  return segmentForMinutes(now.getHours() * 60 + now.getMinutes());
}

export type HabitSegmentGroup<T> = {
  key: HabitSegmentKey;
  label: string;
  habits: T[];
  done: number;
};

export function groupHabitsBySegment<T extends { name: string; startTime?: string | null; checked: boolean }>(
  habits: T[]
): HabitSegmentGroup<T>[] {
  return HABIT_SEGMENTS.map((segment) => {
    const list = habits
      .filter((h) => habitSegment(h) === segment.key)
      .sort((a, b) => (toMinutes(a.startTime) ?? 9999) - (toMinutes(b.startTime) ?? 9999));
    return {
      key: segment.key,
      label: segment.label,
      habits: list,
      done: list.filter((h) => h.checked).length,
    };
  }).filter((group) => group.habits.length > 0);
}
