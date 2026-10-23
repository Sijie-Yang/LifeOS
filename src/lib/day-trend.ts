import { format, parseISO, startOfWeek, subDays } from "date-fns";

/** 状态变化图：周 = 近 7 天，月 = 近 30 天（按天），年 = 近 52 周（按周平均） */
export type TrendRange = "week" | "month" | "year";

export const TREND_METRICS = [
  "sleepHours",
  "energyMorning",
  "energyEvening",
  "drainMorning",
  "drainEvening",
  "habitRate",
  "planScore",
  "bedtime",
  "wakeTime",
  "weightKg",
  "exerciseStart",
  "exerciseMinutes",
  "exerciseCalories",
  "urgeMorning",
  "urgeCount",
  "transferRate",
  "keptRate",
  "focusMinutes",
] as const;
export type TrendMetric = (typeof TREND_METRICS)[number];

export type TrendDay = { date: string } & Record<TrendMetric, number | null>;
export type TrendPoint = { key: string; label: string; from: string; to: string } & Record<TrendMetric, number | null>;

export function parseTrendRange(value: unknown): TrendRange {
  return value === "month" || value === "year" ? value : "week";
}

export function trendDates(range: TrendRange, end: string): string[] {
  const days = range === "week" ? 7 : range === "month" ? 30 : 364;
  const last = parseISO(`${end}T12:00:00`);
  return Array.from({ length: days }, (_, i) => format(subDays(last, days - 1 - i), "yyyy-MM-dd"));
}

function mean(values: Array<number | null>): number | null {
  const nums = values.filter((v): v is number => v != null);
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

/** 周 / 月：每天一个点；年：按周一分组取平均（空值不计入平均） */
export function bucketTrend(range: TrendRange, days: TrendDay[]): TrendPoint[] {
  if (range !== "year") {
    return days.map((d) => ({ ...d, key: d.date, label: d.date.slice(5).replace("-", "/"), from: d.date, to: d.date }));
  }
  const groups = new Map<string, TrendDay[]>();
  for (const d of days) {
    const week = format(startOfWeek(parseISO(`${d.date}T12:00:00`), { weekStartsOn: 1 }), "yyyy-MM-dd");
    groups.set(week, [...(groups.get(week) ?? []), d]);
  }
  return [...groups.entries()].map(([week, list]) => {
    const point = { key: week, label: week.slice(5).replace("-", "/"), from: list[0]!.date, to: list.at(-1)!.date } as TrendPoint;
    for (const m of TREND_METRICS) point[m] = mean(list.map((d) => d[m]));
    return point;
  });
}

/**
 * HH:mm → 小时数，方便画在同一条轴上。就寝时间过了午夜记成 24+（01:30 → 25.5），
 * 这样 23:30 和 01:30 在图上是挨着的。
 */
export function clockHours(value: string | null | undefined, overnight: boolean): number | null {
  const m = value?.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]) + Number(m[2]) / 60;
  return Math.round((overnight && h < 12 ? h + 24 : h) * 100) / 100;
}

/** 小时数 → HH:mm（25.5 → 01:30） */
export function formatClockHours(value: number): string {
  const total = Math.round(value * 60) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
