import { differenceInDays, addDays, startOfWeek, format, parseISO } from "date-fns";

export function daysUntilBirthday(birthday: Date, from: Date = new Date()): number {
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let next = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate());
  if (next < today) {
    next = new Date(today.getFullYear() + 1, birthday.getMonth(), birthday.getDate());
  }
  return differenceInDays(next, today);
}

export function getWeekStart(date: Date = new Date()): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

export function getWeekRange(date: Date = new Date()) {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = addDays(start, 6);
  return { start: format(start, "yyyy-MM-dd"), end: format(end, "yyyy-MM-dd") };
}

export function parseDaysOfWeek(value: string): number[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [1, 2, 3, 4, 5, 6, 0];
  } catch {
    return [1, 2, 3, 4, 5, 6, 0];
  }
}

export function parseMonthDays(value: string): number[] {
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [1];
    return parsed.filter((d): d is number => typeof d === "number" && d >= 1 && d <= 31);
  } catch {
    return [1];
  }
}

export type HabitScheduleFields = {
  scheduleMode?: string;
  frequency?: string;
  daysOfWeek: string;
  monthDays?: string;
};

/** 日历只展示周习惯 / 月习惯，排除每日习惯（含 scheduleMode=weekly 但 frequency=DAILY 的） */
export function isHabitForCalendar(habit: {
  scheduleMode?: string;
  frequency?: string;
}): boolean {
  if (habit.scheduleMode === "monthly") return true;
  if (habit.scheduleMode === "weekly" && habit.frequency === "WEEKLY") return true;
  return false;
}

/** 判断某习惯在指定日期是否应执行（date: yyyy-MM-dd） */
export function isHabitScheduledOnDate(daysOfWeek: number[] | string, dateStr: string): boolean {
  const days = typeof daysOfWeek === "string" ? parseDaysOfWeek(daysOfWeek) : daysOfWeek;
  const d = parseISO(`${dateStr}T12:00:00`);
  return days.includes(d.getDay());
}

/** 综合 scheduleMode：weekly/none 用 daysOfWeek，monthly 用 monthDays */
export function isHabitScheduledOnDateForHabit(
  habit: HabitScheduleFields,
  dateStr: string
): boolean {
  if (habit.scheduleMode === "monthly") {
    const monthDays = parseMonthDays(habit.monthDays ?? "[1]");
    const d = parseISO(`${dateStr}T12:00:00`);
    return monthDays.includes(d.getDate());
  }
  return isHabitScheduledOnDate(habit.daysOfWeek, dateStr);
}

/** 与日历展示一致：默认执行日（未 skip）或改期到该日的 override 均可打卡 */
export function isHabitCheckInAllowedOnDate(
  habit: HabitScheduleFields,
  dateStr: string,
  dayBlock?: { skipped: boolean } | null
): boolean {
  if (dayBlock?.skipped) return false;

  const isScheduledDay = isHabitScheduledOnDateForHabit(habit, dateStr);
  if (isScheduledDay) return true;

  // 改期到非默认执行日：日历上有 dayScheduleBlock 且未 skip
  return Boolean(dayBlock && !dayBlock.skipped);
}

/** 本周内该习惯应执行且已过的日期（不含未来） */
export function getScheduledDatesInWeek(
  daysOfWeek: number[],
  weekStart: string,
  today: string = format(new Date(), "yyyy-MM-dd")
): string[] {
  const start = parseISO(weekStart);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    const dateStr = format(d, "yyyy-MM-dd");
    if (dateStr > today) continue;
    if (daysOfWeek.includes(d.getDay())) dates.push(dateStr);
  }
  return dates;
}

/** 本周内该习惯的全部计划执行日（含未来） */
export function getAllScheduledDatesInWeek(
  daysOfWeek: number[],
  weekStart: string
): string[] {
  const start = parseISO(weekStart);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    if (daysOfWeek.includes(d.getDay())) dates.push(format(d, "yyyy-MM-dd"));
  }
  return dates;
}

export function getScheduledDatesInWeekForHabit(
  habit: HabitScheduleFields,
  weekStart: string,
  today: string = format(new Date(), "yyyy-MM-dd")
): string[] {
  if (habit.scheduleMode === "monthly") {
    const monthDays = parseMonthDays(habit.monthDays ?? "[1]");
    const start = parseISO(weekStart);
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i);
      const dateStr = format(d, "yyyy-MM-dd");
      if (dateStr > today) continue;
      if (monthDays.includes(d.getDate())) dates.push(dateStr);
    }
    return dates;
  }
  return getScheduledDatesInWeek(parseDaysOfWeek(habit.daysOfWeek), weekStart, today);
}

export function getAllScheduledDatesInWeekForHabit(
  habit: HabitScheduleFields,
  weekStart: string
): string[] {
  if (habit.scheduleMode === "monthly") {
    const monthDays = parseMonthDays(habit.monthDays ?? "[1]");
    const start = parseISO(weekStart);
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i);
      if (monthDays.includes(d.getDate())) dates.push(format(d, "yyyy-MM-dd"));
    }
    return dates;
  }
  return getAllScheduledDatesInWeek(parseDaysOfWeek(habit.daysOfWeek), weekStart);
}

export function getWeekDates(weekStart: string): string[] {
  const start = parseISO(weekStart);
  return Array.from({ length: 7 }, (_, i) => format(addDays(start, i), "yyyy-MM-dd"));
}

import { PrismaClient } from "@prisma/client";

export async function syncProjectProgress(prisma: PrismaClient, projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      status: true,
      milestones: { include: { childProject: { select: { status: true } } } },
      planSteps: { select: { done: true, isMilestone: true } },
    },
  });
  if (!project) return;
  if (project.status === "COMPLETED") {
    await prisma.project.update({ where: { id: projectId }, data: { progress: 100 } });
    return;
  }

  const milestoneUnits = [
    ...project.milestones.map((m) => m.completed || m.childProject?.status === "COMPLETED"),
    ...project.planSteps.filter((s) => s.isMilestone).map((s) => s.done),
  ];
  if (milestoneUnits.length > 0) {
    const progress = Math.round(
      (milestoneUnits.filter(Boolean).length / milestoneUnits.length) * 100
    );
    await prisma.project.update({ where: { id: projectId }, data: { progress } });
    return;
  }

  if (project.planSteps.length === 0) return;
  const progress = Math.round(
    (project.planSteps.filter((s) => s.done).length / project.planSteps.length) * 100
  );
  await prisma.project.update({ where: { id: projectId }, data: { progress } });
}

const WEEKDAY_SHORT = ["日", "一", "二", "三", "四", "五", "六"];

/** 习惯执行日的简短说明：每天 / 工作日 / 周末 / 每周二、四、日 / 每月 1、15 号 */
export function habitScheduleLabel(habit: HabitScheduleFields): string {
  if (habit.scheduleMode === "monthly") {
    return `每月 ${parseMonthDays(habit.monthDays ?? "[1]").sort((a, b) => a - b).join("、")} 号`;
  }
  const days = new Set(parseDaysOfWeek(habit.daysOfWeek));
  if (days.size === 7) return "每天";
  if (days.size === 5 && [1, 2, 3, 4, 5].every((d) => days.has(d))) return "工作日";
  if (days.size === 2 && days.has(0) && days.has(6)) return "周末";
  // 周一开头排序
  const ordered = [1, 2, 3, 4, 5, 6, 0].filter((d) => days.has(d));
  return `每周${ordered.map((d) => WEEKDAY_SHORT[d]).join("、")}`;
}
