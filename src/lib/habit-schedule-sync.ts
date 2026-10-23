import type { PrismaClient } from "@prisma/client";
import { parseDaysOfWeek } from "./reminders";

export type ScheduleMode = "none" | "weekly" | "monthly";

export function normalizeScheduleMode(value: unknown): ScheduleMode {
  if (value === "weekly" || value === "monthly") return value;
  return "none";
}

export function inferScheduleMode(input: {
  scheduleMode?: unknown;
  startTime?: string | null;
  endTime?: string | null;
  frequency?: string;
}): ScheduleMode {
  if (input.scheduleMode !== undefined) {
    return normalizeScheduleMode(input.scheduleMode);
  }
  if (input.startTime && input.endTime) {
    return input.frequency === "MONTHLY" ? "monthly" : "weekly";
  }
  return "none";
}

export async function clearHabitScheduleBlocks(prisma: PrismaClient, habitId: string) {
  await prisma.scheduleBlock.deleteMany({ where: { habitId } });
}

/** 根据习惯的 daysOfWeek + 时间，同步周时间表中的 ScheduleBlock */
export async function syncHabitWeeklyBlocks(prisma: PrismaClient, habitId: string) {
  const habit = await prisma.habit.findUnique({ where: { id: habitId } });
  if (!habit || habit.scheduleMode !== "weekly") return;

  const { startTime, endTime } = habit;
  if (!startTime || !endTime) return;

  const days = parseDaysOfWeek(habit.daysOfWeek);

  await prisma.$transaction(async (tx) => {
    await tx.scheduleBlock.deleteMany({ where: { habitId } });
    if (days.length === 0) return;
    await tx.scheduleBlock.createMany({
      data: days.map((dayOfWeek, i) => ({
        title: habit.name,
        description: habit.description,
        dayOfWeek,
        startTime,
        endTime,
        color: habit.color,
        habitId: habit.id,
        sortOrder: i,
      })),
    });
  });
}

export async function applyHabitScheduleSync(
  prisma: PrismaClient,
  habitId: string,
  scheduleMode: string
) {
  if (scheduleMode === "weekly") {
    await syncHabitWeeklyBlocks(prisma, habitId);
  } else {
    await clearHabitScheduleBlocks(prisma, habitId);
  }
}
