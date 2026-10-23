import { subDays, format } from "date-fns";
import { isHabitScheduledOnDateForHabit, type HabitScheduleFields } from "@/lib/reminders";

export function computeHabitStreak(
  habit: HabitScheduleFields,
  checkInDates: Set<string>,
  maxDays = 60
): number {
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < maxDays; i++) {
    const d = subDays(today, i);
    const dateStr = format(d, "yyyy-MM-dd");
    if (!isHabitScheduledOnDateForHabit(habit, dateStr)) continue;
    if (checkInDates.has(dateStr)) streak++;
    else break;
  }
  return streak;
}
