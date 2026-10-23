import { addDays, format, parseISO, startOfWeek } from "date-fns";
import type { PrismaClient } from "@prisma/client";
import {
  parseDaysOfWeek,
  parseMonthDays,
  type HabitScheduleFields,
} from "./reminders";

export const WEEKLY_BLOCK_ID_PREFIX = "weekly:";

export type DayScheduleBlockDto = {
  id: string;
  date: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  color: string;
  taskId: string | null;
  goalId: string | null;
  habitId: string | null;
  scheduleBlockId: string | null;
  kind: "custom" | "habit";
  materialized: boolean;
  task?: { id: string; title: string } | null;
  goal?: { id: string; title: string } | null;
  habit?: { id: string; name: string } | null;
};

const blockInclude = {
  task: { select: { id: true, title: true } },
  goal: { select: { id: true, title: true } },
  habit: { select: { id: true, name: true } },
} as const;

function mapStored(row: {
  id: string;
  date: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  color: string;
  taskId: string | null;
  goalId: string | null;
  habitId: string | null;
  scheduleBlockId: string | null;
  task?: { id: string; title: string } | null;
  goal?: { id: string; title: string } | null;
  habit?: { id: string; name: string } | null;
}): DayScheduleBlockDto {
  return {
    id: row.id,
    date: row.date,
    title: row.title,
    description: row.description,
    startTime: row.startTime,
    endTime: row.endTime,
    color: row.color,
    taskId: row.taskId,
    goalId: row.goalId,
    habitId: row.habitId,
    scheduleBlockId: row.scheduleBlockId,
    kind: row.scheduleBlockId || row.habitId ? "habit" : "custom",
    materialized: true,
    task: row.task ?? null,
    goal: row.goal ?? null,
    habit: row.habit ?? null,
  };
}

export function isWeeklyVirtualId(id: string) {
  return id.startsWith(WEEKLY_BLOCK_ID_PREFIX);
}

export function weeklyIdFromVirtual(id: string) {
  return id.slice(WEEKLY_BLOCK_ID_PREFIX.length);
}

/** 某次出现所在周期内的默认日期（周习惯→该周 scheduled 日；月习惯→该月 scheduled 日） */
export function getDefaultOccurrenceDate(
  habit: HabitScheduleFields & { scheduleMode: string },
  referenceDate: string
): string | null {
  const ref = parseISO(`${referenceDate}T12:00:00`);

  if (habit.scheduleMode === "monthly") {
    const monthDays = parseMonthDays(habit.monthDays ?? "[1]").sort((a, b) => a - b);
    const year = ref.getFullYear();
    const month = ref.getMonth();
    for (const day of monthDays) {
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) return format(d, "yyyy-MM-dd");
    }
    return null;
  }

  const days = parseDaysOfWeek(habit.daysOfWeek);
  const weekStart = startOfWeek(ref, { weekStartsOn: 1 });
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i);
    if (days.includes(d.getDay())) return format(d, "yyyy-MM-dd");
  }
  return null;
}

export async function fetchMergedDaySchedule(
  prisma: PrismaClient,
  date: string
): Promise<DayScheduleBlockDto[]> {
  const dayOfWeek = parseISO(`${date}T12:00:00`).getDay();

  const [dayBlocks, weeklyBlocks] = await Promise.all([
    prisma.dayScheduleBlock.findMany({
      where: { date },
      include: blockInclude,
      orderBy: [{ startTime: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.scheduleBlock.findMany({
      where: { isActive: true, dayOfWeek, habitId: { not: null } },
      include: { habit: { select: { id: true, name: true } } },
      orderBy: [{ startTime: "asc" }, { sortOrder: "asc" }],
    }),
  ]);

  const overrideByScheduleId = new Map(
    dayBlocks
      .filter((b) => b.scheduleBlockId && !b.skipped)
      .map((b) => [b.scheduleBlockId!, mapStored(b)])
  );

  const skippedScheduleIds = new Set(
    dayBlocks.filter((b) => b.skipped && b.scheduleBlockId).map((b) => b.scheduleBlockId!)
  );

  const habitFromWeekly: DayScheduleBlockDto[] = weeklyBlocks
    .filter((wb) => !skippedScheduleIds.has(wb.id))
    .map((wb) => {
    const override = overrideByScheduleId.get(wb.id);
    if (override) return override;

    return {
      id: `${WEEKLY_BLOCK_ID_PREFIX}${wb.id}`,
      date,
      title: wb.title,
      description: wb.description,
      startTime: wb.startTime,
      endTime: wb.endTime,
      color: wb.color,
      taskId: null,
      goalId: null,
      habitId: wb.habitId,
      scheduleBlockId: wb.id,
      kind: "habit" as const,
      materialized: false,
      habit: wb.habit,
    };
  });

  const customBlocks = dayBlocks
    .filter((b) => !b.scheduleBlockId && !b.skipped)
    .map((b) => mapStored(b));

  const shownScheduleIds = new Set(habitFromWeekly.map((h) => h.scheduleBlockId).filter(Boolean));

  const rescheduledHabits = dayBlocks
    .filter(
      (b) =>
        b.habitId &&
        !b.skipped &&
        b.scheduleBlockId &&
        !shownScheduleIds.has(b.scheduleBlockId)
    )
    .map((b) => mapStored(b));

  return [...habitFromWeekly, ...rescheduledHabits, ...customBlocks].sort((a, b) =>
    a.startTime.localeCompare(b.startTime)
  );
}

export async function materializeHabitDayBlock(
  prisma: PrismaClient,
  date: string,
  scheduleBlockId: string,
  startTime: string,
  endTime: string
) {
  const weekly = await prisma.scheduleBlock.findUnique({
    where: { id: scheduleBlockId },
    include: { habit: true },
  });
  if (!weekly) {
    throw new Error("周习惯时间块不存在");
  }

  const block = await prisma.dayScheduleBlock.upsert({
    where: {
      date_scheduleBlockId: { date, scheduleBlockId },
    },
    create: {
      date,
      title: weekly.title,
      description: weekly.description,
      startTime,
      endTime,
      color: weekly.color,
      habitId: weekly.habitId,
      scheduleBlockId,
      goalId: weekly.goalId,
    },
    update: { startTime, endTime, skipped: false },
    include: blockInclude,
  });

  return mapStored(block);
}

/** 月习惯或无 ScheduleBlock 时：仅按 habitId + date 覆盖当日时间 */
export async function materializeHabitDayOverride(
  prisma: PrismaClient,
  date: string,
  habitId: string,
  startTime: string,
  endTime: string
) {
  const habit = await prisma.habit.findUnique({ where: { id: habitId } });
  if (!habit) {
    throw new Error("习惯不存在");
  }

  const existing = await prisma.dayScheduleBlock.findFirst({
    where: { date, habitId, scheduleBlockId: null },
  });

  const block = existing
    ? await prisma.dayScheduleBlock.update({
        where: { id: existing.id },
        data: { startTime, endTime, skipped: false },
        include: blockInclude,
      })
    : await prisma.dayScheduleBlock.create({
        data: {
          date,
          title: habit.name,
          description: habit.description,
          startTime,
          endTime,
          color: habit.color,
          habitId: habit.id,
        },
        include: blockInclude,
      });

  return mapStored(block);
}

/** 恢复为习惯默认时间（删除当日覆盖） */
export async function resetHabitDayTimeOverride(
  prisma: PrismaClient,
  date: string,
  habitId: string,
  scheduleBlockId?: string | null
) {
  if (scheduleBlockId) {
    await prisma.dayScheduleBlock.deleteMany({ where: { date, scheduleBlockId } });
    return;
  }
  await prisma.dayScheduleBlock.deleteMany({
    where: { date, habitId, scheduleBlockId: null },
  });
}

async function skipHabitOccurrenceByHabitId(
  prisma: PrismaClient,
  date: string,
  habitId: string
) {
  const habit = await prisma.habit.findUnique({ where: { id: habitId } });
  if (!habit) throw new Error("习惯不存在");

  const existing = await prisma.dayScheduleBlock.findFirst({
    where: { date, habitId, scheduleBlockId: null },
  });

  if (existing) {
    await prisma.dayScheduleBlock.update({
      where: { id: existing.id },
      data: { skipped: true },
    });
    return;
  }

  await prisma.dayScheduleBlock.create({
    data: {
      date,
      habitId,
      title: habit.name,
      description: habit.description,
      startTime: habit.startTime ?? "09:00",
      endTime: habit.endTime ?? "10:00",
      color: habit.color,
      skipped: true,
    },
  });
}

/** 跳过某日某次习惯出现（周习惯用 scheduleBlockId，月习惯用 habitId） */
export async function skipHabitOccurrence(
  prisma: PrismaClient,
  params: {
    date: string;
    habitId?: string | null;
    scheduleBlockId?: string | null;
  }
) {
  const { date, habitId, scheduleBlockId } = params;
  if (scheduleBlockId) {
    await skipHabitForDay(prisma, date, scheduleBlockId);
    return;
  }
  if (!habitId) throw new Error("缺少 habitId 或 scheduleBlockId");
  await skipHabitOccurrenceByHabitId(prisma, date, habitId);
}

/** 取消某日跳过（恢复显示为正常出现） */
export async function unskipHabitOccurrence(
  prisma: PrismaClient,
  params: {
    date: string;
    habitId?: string | null;
    scheduleBlockId?: string | null;
  }
) {
  const { date, habitId, scheduleBlockId } = params;
  if (scheduleBlockId) {
    await prisma.dayScheduleBlock.deleteMany({
      where: { date, scheduleBlockId, skipped: true },
    });
    return;
  }
  if (!habitId) throw new Error("缺少 habitId 或 scheduleBlockId");
  await prisma.dayScheduleBlock.deleteMany({
    where: { date, habitId, skipped: true },
  });
}

/** 将某次习惯出现挪到新日期（原日期 skip / 删块，新日期 materialize） */
export async function rescheduleHabitOccurrence(
  prisma: PrismaClient,
  params: {
    habitId: string;
    fromDate: string;
    toDate: string;
    startTime: string;
    endTime: string;
    scheduleBlockId?: string | null;
  }
) {
  const { habitId, fromDate, toDate, startTime, endTime, scheduleBlockId } = params;

  if (fromDate === toDate) {
    if (scheduleBlockId) {
      return materializeHabitDayBlock(prisma, toDate, scheduleBlockId, startTime, endTime);
    }
    return materializeHabitDayOverride(prisma, toDate, habitId, startTime, endTime);
  }

  const habit = await prisma.habit.findUnique({ where: { id: habitId } });
  if (!habit) throw new Error("习惯不存在");

  const defaultFrom = getDefaultOccurrenceDate(habit, fromDate);
  const fromIsDefault = defaultFrom === fromDate;

  if (fromIsDefault && scheduleBlockId) {
    await skipHabitForDay(prisma, fromDate, scheduleBlockId);
  } else if (fromIsDefault) {
    await skipHabitOccurrenceByHabitId(prisma, fromDate, habitId);
  } else {
    await prisma.dayScheduleBlock.deleteMany({
      where: {
        date: fromDate,
        habitId,
        skipped: false,
        ...(scheduleBlockId ? { scheduleBlockId } : { scheduleBlockId: null }),
      },
    });
  }

  if (scheduleBlockId) {
    return materializeHabitDayBlock(prisma, toDate, scheduleBlockId, startTime, endTime);
  }
  return materializeHabitDayOverride(prisma, toDate, habitId, startTime, endTime);
}

/** 恢复默认日期与时间 */
export async function resetHabitOccurrence(
  prisma: PrismaClient,
  occurrenceDate: string,
  habitId: string,
  scheduleBlockId?: string | null
) {
  const habit = await prisma.habit.findUnique({ where: { id: habitId } });
  if (!habit) throw new Error("习惯不存在");

  const defaultDate = getDefaultOccurrenceDate(habit, occurrenceDate);
  const onDefault = defaultDate === occurrenceDate;

  if (onDefault) {
    await resetHabitDayTimeOverride(prisma, occurrenceDate, habitId, scheduleBlockId);
    return;
  }

  await prisma.dayScheduleBlock.deleteMany({
    where: {
      date: occurrenceDate,
      habitId,
      skipped: false,
    },
  });

  if (defaultDate) {
    if (scheduleBlockId) {
      await prisma.dayScheduleBlock.deleteMany({
        where: { date: defaultDate, scheduleBlockId },
      });
    } else {
      await prisma.dayScheduleBlock.deleteMany({
        where: { date: defaultDate, habitId, scheduleBlockId: null },
      });
    }
  }
}

export async function skipHabitForDay(
  prisma: PrismaClient,
  date: string,
  scheduleBlockId: string
) {
  const weekly = await prisma.scheduleBlock.findUnique({
    where: { id: scheduleBlockId },
  });
  if (!weekly) {
    throw new Error("周习惯时间块不存在");
  }

  await prisma.dayScheduleBlock.upsert({
    where: {
      date_scheduleBlockId: { date, scheduleBlockId },
    },
    create: {
      date,
      title: weekly.title,
      description: weekly.description,
      startTime: weekly.startTime,
      endTime: weekly.endTime,
      color: weekly.color,
      habitId: weekly.habitId,
      scheduleBlockId,
      goalId: weekly.goalId,
      skipped: true,
    },
    update: { skipped: true },
  });
}

export { blockInclude };
