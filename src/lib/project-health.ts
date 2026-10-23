import { differenceInCalendarDays, parseISO } from "date-fns";

/**
 * 项目健康度 / 紧急度：给开工「逐项目对齐」下面的项目总览用。
 * - red 告急：预计完成晚于目标日期；或开着排程却 14 天没推进；或里程碑已过期
 * - amber 注意：7 天没推进；目标在 14 天内且还剩 ≥30%；或没有下一步
 * - green 正常
 */
export type HealthLevel = "red" | "amber" | "green";

export type ProjectHealthInput = {
  id: string;
  name: string;
  power: string | null;
  planActive: boolean;
  done: number;
  total: number;
  lastDoneDate: string | null;
  /** 最近一次动过这个项目：完成步骤，或新建 / 修改步骤（刚重新规划的项目不算停滞） */
  lastActivityDate?: string | null;
  /** 下一个未完成步骤的排期 */
  nextStepDate: string | null;
  nextStepTitle: string | null;
  scheduledToday: boolean;
  targetDate: string | null;
  projectedFinish: string | null;
  /** 最近一个未完成里程碑（含步骤里程碑） */
  nextMilestone: { title: string; date: string | null } | null;
};

export type ProjectHealth = ProjectHealthInput & {
  level: HealthLevel;
  reasons: string[];
  /** 距最近一次活动（完成或规划）几天 */
  daysSinceProgress: number | null;
  /** 预计完成比目标晚几天（>0 晚，<0 提前） */
  slipDays: number | null;
  /** 最近的截止日期离今天几天（里程碑或目标，取近的） */
  daysToDeadline: number | null;
};

function days(from: string, to: string): number {
  return differenceInCalendarDays(parseISO(`${to}T12:00:00`), parseISO(`${from}T12:00:00`));
}

export function projectHealth(p: ProjectHealthInput, today: string): ProjectHealth {
  const reasons: { level: HealthLevel; text: string }[] = [];
  const last = [p.lastDoneDate, p.lastActivityDate].filter((d): d is string => Boolean(d)).sort().at(-1) ?? null;
  const daysSinceProgress = last ? days(last, today) : null;
  const slipDays = p.targetDate && p.projectedFinish ? days(p.targetDate, p.projectedFinish) : null;
  const deadlines = [p.nextMilestone?.date, p.targetDate].filter((d): d is string => Boolean(d)).map((d) => days(today, d));
  const daysToDeadline = deadlines.length ? Math.min(...deadlines) : null;
  const remaining = p.total ? (p.total - p.done) / p.total : 1;

  if (slipDays != null && slipDays > 0) reasons.push({ level: "red", text: `预计比目标晚 ${slipDays} 天` });
  if (p.nextMilestone?.date && days(today, p.nextMilestone.date) < 0) reasons.push({ level: "red", text: "里程碑已过期" });
  if (p.planActive && p.total > p.done && daysSinceProgress != null && daysSinceProgress > 14) {
    reasons.push({ level: "red", text: `${daysSinceProgress} 天没推进` });
  } else if (p.planActive && p.total > p.done && (daysSinceProgress == null || daysSinceProgress > 7)) {
    reasons.push({ level: "amber", text: daysSinceProgress == null ? "还没推进过" : `${daysSinceProgress} 天没推进` });
  }
  if (p.targetDate && days(today, p.targetDate) <= 14 && days(today, p.targetDate) >= 0 && remaining >= 0.3) {
    reasons.push({ level: "amber", text: `目标 ${days(today, p.targetDate)} 天后，还剩 ${Math.round(remaining * 100)}%` });
  }
  if (p.total === p.done) reasons.push({ level: "amber", text: p.total ? "步骤做完了，补下一步" : "没有步骤" });

  const level: HealthLevel = reasons.some((r) => r.level === "red") ? "red" : reasons.length ? "amber" : "green";
  return {
    ...p,
    level,
    reasons: reasons.sort((a, b) => (a.level === b.level ? 0 : a.level === "red" ? -1 : 1)).map((r) => r.text),
    daysSinceProgress,
    slipDays,
    daysToDeadline,
  };
}

const RANK: Record<HealthLevel, number> = { red: 0, amber: 1, green: 2 };

/** 告急在前；同档按最近截止日期，再按今天排到的在前 */
export function sortByHealth(list: ProjectHealth[]): ProjectHealth[] {
  return [...list].sort(
    (a, b) =>
      RANK[a.level] - RANK[b.level] ||
      (a.daysToDeadline ?? 9999) - (b.daysToDeadline ?? 9999) ||
      Number(b.scheduledToday) - Number(a.scheduledToday) ||
      a.name.localeCompare(b.name)
  );
}
