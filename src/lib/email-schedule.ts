import { localNow } from "@/lib/pomodoro-remote";

// Deadline digest at 07:00 and evening close at 20:00 (server local time), run inside the
// server instead of a Terminal-opening LaunchAgent. Each sender already records a
// per-day NudgeLog row, so a slot can't double-send across restarts.

export type EmailSlot = "morning" | "evening";

const SLOTS: { slot: EmailSlot; start: string; end: string }[] = [
  { slot: "morning", start: "07:00", end: "07:30" },
  { slot: "evening", start: "20:00", end: "20:30" },
];

/** Slot due at HH:mm. The 30-minute window covers a restart, not a whole missed day. */
export function dueEmailSlot(time: string): EmailSlot | null {
  return SLOTS.find((s) => s.start <= time && time < s.end)?.slot ?? null;
}

export async function runEmailTick(now = new Date(), attempted: Set<string> = new Set()) {
  const { date, time } = localNow(now);
  const slot = dueEmailSlot(time);
  if (!slot) return null;
  // One try per slot per process: the NudgeLog check handles restarts, this avoids
  // re-collecting every minute when there is nothing to send or Resend fails.
  const key = `${date}:${slot}`;
  if (attempted.has(key)) return null;
  attempted.add(key);
  // Imported lazily so the slot logic stays testable without Prisma.
  const { sendDeadlineReminders, sendEveningCloseEmail } = await import("@/lib/email-reminders");
  const result = slot === "morning" ? await sendDeadlineReminders() : await sendEveningCloseEmail();
  console.log(`[email:${slot}]`, JSON.stringify(result));
  return result;
}

/** Started from instrumentation; repeated calls keep a single loop. */
export function startEmailSchedule() {
  const g = globalThis as unknown as { __lifeosEmailLoop?: ReturnType<typeof setInterval> };
  if (g.__lifeosEmailLoop) return;
  const attempted = new Set<string>();
  const tick = () =>
    runEmailTick(new Date(), attempted).catch((e) => console.error("[email]", e instanceof Error ? e.message : e));
  g.__lifeosEmailLoop = setInterval(tick, 60_000);
  setTimeout(tick, 10_000);
}
