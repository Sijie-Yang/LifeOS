/** Default target bedtime and planned sleep (24h HH:mm). */
export const DEFAULT_BEDTIME_TARGET = "21:30";
export const DEFAULT_PLANNED_SLEEP = "21:30";

/** Evening wind-down checklist shown on /daily */
export const DEFAULT_WIND_DOWN_CHECKLIST = [
  "收衣服 / 收拾桌面",
  "写下明日 1 件要事",
  "调暗灯光",
  "手机放充电点（卧室外）",
  "4-7-8 呼吸 ×3",
] as const;

/** Default days-before-deadline that trigger an email (0 = due today / overdue). */
export const DEFAULT_EMAIL_REMIND_DAYS = [14, 7, 3, 1, 0] as const;

export function parseEmailRemindDays(value: string | null | undefined): number[] {
  try {
    const parsed = JSON.parse(value || "[]");
    if (!Array.isArray(parsed)) return [...DEFAULT_EMAIL_REMIND_DAYS];
    const days = parsed
      .map((d) => Number(d))
      .filter((d) => Number.isFinite(d) && d >= 0 && d <= 365);
    return days.length > 0 ? [...new Set(days)].sort((a, b) => b - a) : [...DEFAULT_EMAIL_REMIND_DAYS];
  } catch {
    return [...DEFAULT_EMAIL_REMIND_DAYS];
  }
}
