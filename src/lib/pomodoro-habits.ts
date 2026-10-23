/** Optional local preference. New installs can focus on any active habit. */
export function configuredPomodoroHabits(): string[] {
  return [...new Set((process.env.LIFEOS_POMODORO_HABIT_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean))];
}
export function pomodoroDisplayName(_habitId: string, fallback: string) { return fallback; }
export function isPomodoroHabitId(id: string) {
  const configured = configuredPomodoroHabits();
  return configured.length === 0 || configured.includes(id);
}
