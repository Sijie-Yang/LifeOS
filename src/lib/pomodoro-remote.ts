// Cross-window pomodoro protocol. The timer lives in exactly one PomodoroProvider
// (the main window); other windows such as /mini mirror its localStorage state and
// send commands back instead of running a second timer.

import { format } from "date-fns";
import type { PomodoroTimerState } from "@/lib/pomodoro-settings";

/** Same key pomodoro-settings saveTimerState writes. */
export const POMODORO_TIMER_KEY = "lifeos-pomodoro-timer";
export const POMODORO_COMMAND_KEY = "lifeos-pomodoro-command";
export const POMODORO_COMMAND_EVENT = "lifeos:pomodoro-command";

export type PomodoroCommandType = "start" | "pause" | "resume" | "stop" | "skipBreak" | "distraction";

export type PomodoroCommand = {
  type: PomodoroCommandType;
  habitId?: string;
  nonce: string;
};

const COMMAND_TYPES: PomodoroCommandType[] = ["start", "pause", "resume", "stop", "skipBreak", "distraction"];

export function parsePomodoroCommand(raw: unknown): PomodoroCommand | null {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const { type, habitId, nonce } = value as Record<string, unknown>;
  if (!COMMAND_TYPES.includes(type as PomodoroCommandType)) return null;
  if (typeof nonce !== "string" || !nonce) return null;
  if (type === "start" && (typeof habitId !== "string" || !habitId)) return null;
  return { type: type as PomodoroCommandType, nonce, ...(typeof habitId === "string" ? { habitId } : {}) };
}

/** Parse a raw timer value the way loadTimerState does (finished breaks count as idle). */
export function parseTimerState(raw: string | null, now = Date.now()): PomodoroTimerState | null {
  if (!raw) return null;
  try {
    const state = JSON.parse(raw) as PomodoroTimerState;
    if (!state || typeof state.endsAt !== "number") return null;
    if (!state.pausedAt && state.endsAt <= now && state.phase !== "work") return null;
    return state;
  } catch {
    return null;
  }
}

/** Remaining seconds for a mirrored timer; 0 once it has run out. */
export function timerRemainingSec(state: PomodoroTimerState, now = Date.now()): number {
  const ms = state.pausedAt ? state.remainingMs : state.endsAt - now;
  return Math.max(0, Math.ceil(ms / 1000));
}

/** YYYY-MM-DD and HH:mm in local time, matching how the rest of LifeOS dates the schedule. */
export function localNow(now: Date = new Date()): { date: string; time: string } {
  return { date: format(now, "yyyy-MM-dd"), time: format(now, "HH:mm") };
}

type TimedBlock = { id: string; startTime: string; endTime: string };

/**
 * Blocks running at `time` (latest start first, so the most specific wins) and the
 * first block starting after it.
 */
export function currentAndNextBlocks<T extends TimedBlock>(
  blocks: T[],
  time: string
): { current: T[]; next: T | null } {
  const sorted = [...blocks].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const current = sorted
    .filter((b) => b.startTime <= time && time < b.endTime)
    .sort((a, b) => b.startTime.localeCompare(a.startTime));
  const next = sorted.find((b) => b.startTime > time) ?? null;
  return { current, next };
}
