export function clockMinutes(time: string): number {
  const [hour, minute] = time.slice(0, 5).split(":").map(Number);
  return hour * 60 + minute;
}

/** Hours asleep from a bedtime clock to the next wake clock. Equal clocks are 0. */
export function sleepDurationHours(bedtime: string | null, wakeTime: string | null): number | null {
  if (!bedtime || !wakeTime) return null;
  let minutes = clockMinutes(wakeTime) - clockMinutes(bedtime);
  if (minutes < 0) minutes += 24 * 60;
  return Math.round((minutes / 60) * 10) / 10;
}

/** Hours typed for 睡眠时间. Empty clears it. Incomplete text (like "7.") waits. */
export function parseSleepHours(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (!/^\d{1,2}(\.\d)?$/.test(trimmed)) return undefined;
  const hours = Number(trimmed);
  if (!Number.isFinite(hours) || hours < 0 || hours > 24) return undefined;
  return Math.round(hours * 10) / 10;
}

export function formatSleepDuration(hours: number | null): string | null {
  if (hours == null) return null;
  const text = Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
  return `${text} 小时`;
}

/**
 * Minutes the actual bedtime is after the planned sleep time.
 * Negative means earlier. A clock that looks 12+ hours earlier is after midnight.
 */
export function bedtimeDelayMinutes(planned: string | null, actual: string | null): number | null {
  if (!planned || !actual) return null;
  let delta = clockMinutes(actual) - clockMinutes(planned);
  if (delta <= -12 * 60) delta += 24 * 60;
  if (delta > 12 * 60) delta -= 24 * 60;
  return delta;
}

export function formatBedtimeDelay(minutes: number | null): string | null {
  if (minutes == null) return null;
  if (minutes === 0) return "按计划就寝";
  const late = minutes > 0;
  const abs = Math.abs(minutes);
  const hours = Math.floor(abs / 60);
  const mins = abs % 60;
  const span =
    hours > 0 && mins > 0 ? `${hours} 小时 ${mins} 分钟` : hours > 0 ? `${hours} 小时` : `${mins} 分钟`;
  return late ? `晚于计划 ${span}就寝` : `早于计划 ${span}就寝`;
}

/** End of the day window: actual bedtime wins over the morning plan. */
export function sleepWindowEnd(plannedSleepTime: string | null, sleepTime: string | null): string | null {
  return sleepTime || plannedSleepTime;
}

/**
 * A block stays visible when it overlaps the marked window.
 * No marks means the whole day. A bedtime earlier than wake is treated as after midnight.
 */
export function blockWithinSleepRange(
  startTime: string,
  endTime: string,
  wakeTime: string | null,
  endClock: string | null
): boolean {
  if (!wakeTime && !endClock) return true;
  const start = clockMinutes(startTime);
  let end = clockMinutes(endTime);
  if (end <= start) end += 24 * 60;
  const from = wakeTime ? clockMinutes(wakeTime) : 0;
  let to = endClock ? clockMinutes(endClock) : 24 * 60;
  if (endClock && wakeTime && to <= from) to += 24 * 60;
  return end > from && start <= to;
}
