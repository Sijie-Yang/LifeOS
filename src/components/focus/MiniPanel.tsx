"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Pause, Play, SkipForward, Square, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRemaining } from "@/components/focus/PomodoroContext";
import type { PomodoroTimerState } from "@/lib/pomodoro-settings";
import {
  POMODORO_COMMAND_KEY,
  POMODORO_TIMER_KEY,
  currentAndNextBlocks,
  parseTimerState,
  localNow,
  timerRemainingSec,
  type PomodoroCommandType,
} from "@/lib/pomodoro-remote";
import type { DayScheduleBlockDto } from "@/lib/day-schedule";

type PomodoroHabitLite = { id: string; name: string; color: string };

const PHASE_LABEL: Record<PomodoroTimerState["phase"], string> = {
  work: "专注中",
  short_break: "短休息",
  long_break: "长休息",
};

declare global {
  interface Window {
    webkit?: { messageHandlers?: { lifeos?: { postMessage: (msg: unknown) => void } } };
  }
}

/** Send a command to the window that owns the timer (see PomodoroRemoteBridge). */
function sendCommand(type: PomodoroCommandType, habitId?: string) {
  const cmd = { type, habitId, nonce: `${Date.now()}-${Math.random().toString(36).slice(2)}` };
  try {
    localStorage.setItem(POMODORO_COMMAND_KEY, JSON.stringify(cmd));
  } catch {
    // storage unavailable; the native bridge below still works in the macOS shell
  }
  window.webkit?.messageHandlers?.lifeos?.postMessage({ kind: "pomodoro", command: cmd });
}

// Mirror the main window's timer: storage events plus polling in case they are missed.
function subscribeTimer(onChange: () => void) {
  const id = setInterval(onChange, 1000);
  window.addEventListener("storage", onChange);
  return () => {
    clearInterval(id);
    window.removeEventListener("storage", onChange);
  };
}

function readTimerRaw() {
  try {
    return localStorage.getItem(POMODORO_TIMER_KEY);
  } catch {
    return null;
  }
}

// Whole-second clock; 0 during SSR/hydration so server and client markup match.
function subscribeClock(onChange: () => void) {
  const id = setInterval(onChange, 250);
  return () => clearInterval(id);
}

const readClock = () => Math.floor(Date.now() / 1000) * 1000;

export function MiniPanel() {
  const now = useSyncExternalStore(subscribeClock, readClock, () => 0);
  const timerRaw = useSyncExternalStore(subscribeTimer, readTimerRaw, () => null);
  const timer = now ? parseTimerState(timerRaw, now) : null;
  const [blocks, setBlocks] = useState<DayScheduleBlockDto[]>([]);
  const [habits, setHabits] = useState<PomodoroHabitLite[]>([]);
  const { date, time } = now ? localNow(new Date(now)) : { date: "", time: "" };

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    const load = async () => {
      try {
        const [schedRes, habitRes] = await Promise.all([
          fetch(`/api/day-schedule?date=${date}`),
          fetch("/api/pomodoro/habits"),
        ]);
        if (cancelled) return;
        if (schedRes.ok) setBlocks(await schedRes.json());
        if (habitRes.ok) {
          const data = await habitRes.json();
          setHabits([...(data.scheduled ?? []), ...(data.other ?? [])]);
        }
      } catch {
        // server restarting; next refresh will catch up
      }
    };
    void load();
    const id = setInterval(() => void load(), 5 * 60_000);
    window.addEventListener("focus", load);
    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener("focus", load);
    };
  }, [date]);

  const { current, next } = currentAndNextBlocks(blocks, time);
  const focusId = current[0]?.id ?? next?.id ?? null;

  useEffect(() => {
    if (!focusId) return;
    document.querySelector(`[data-block-id="${CSS.escape(focusId)}"]`)?.scrollIntoView({ block: "nearest" });
  }, [focusId]);
  const currentIds = new Set(current.map((b) => b.id));
  const habitIds = new Set(habits.map((h) => h.id));
  const startable = current.find((b) => b.habitId && habitIds.has(b.habitId)) ?? null;

  const remaining = timer ? timerRemainingSec(timer, now) : 0;
  const paused = !!timer?.pausedAt;
  const onBreak = timer?.phase === "short_break" || timer?.phase === "long_break";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-white text-zinc-800 select-none">
      <section
        className="shrink-0 px-4 py-3 text-white"
        style={{ backgroundColor: timer ? (onBreak ? "#64748b" : timer.habitColor || "#ef4444") : "#27272a" }}
      >
        {timer ? (
          <>
            <div className="flex items-center justify-between text-xs opacity-90">
              <span>{paused ? "已暂停" : PHASE_LABEL[timer.phase]}</span>
              <span>今日 {timer.completedWorkCount} 番茄</span>
            </div>
            <p className="mt-0.5 text-4xl font-bold tabular-nums">{formatRemaining(remaining)}</p>
            <p className="truncate text-sm opacity-95">{timer.habitName}</p>
            <div className="mt-2 flex gap-1.5">
              {paused ? (
                <MiniButton onClick={() => sendCommand("resume")} label="继续">
                  <Play className="h-3.5 w-3.5" />
                </MiniButton>
              ) : (
                <MiniButton onClick={() => sendCommand("pause")} label="暂停">
                  <Pause className="h-3.5 w-3.5" />
                </MiniButton>
              )}
              {timer.phase === "work" && (
                <MiniButton onClick={() => sendCommand("distraction")} label={`分心 ${timer.distractions}`} />
              )}
              {onBreak && (
                <MiniButton onClick={() => sendCommand("skipBreak")} label="跳过">
                  <SkipForward className="h-3.5 w-3.5" />
                </MiniButton>
              )}
              <MiniButton onClick={() => sendCommand("stop")} label="停止">
                <Square className="h-3.5 w-3.5" />
              </MiniButton>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <Timer className="h-5 w-5 shrink-0 opacity-80" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">番茄钟空闲</p>
              <p className="truncate text-[11px] opacity-70">
                {startable ? `现在：${startable.title}` : "当前时段没有番茄习惯"}
              </p>
            </div>
            {startable?.habitId && (
              <MiniButton onClick={() => sendCommand("start", startable.habitId!)} label="开始">
                <Play className="h-3.5 w-3.5" />
              </MiniButton>
            )}
          </div>
        )}
      </section>

      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2 text-[11px] text-zinc-500">
        <span>今日 · {date}</span>
        <span className="tabular-nums">{time}</span>
      </div>

      <ol className="flex-1 space-y-1 overflow-y-auto px-2 py-2">
        {blocks.length === 0 && <li className="py-6 text-center text-xs text-zinc-400">今天没有时间块</li>}
        {[...blocks]
          .sort((a, b) => a.startTime.localeCompare(b.startTime))
          .map((b) => {
            const isCurrent = currentIds.has(b.id);
            const isNext = next?.id === b.id;
            const past = b.endTime <= time;
            return (
              <li
                key={b.id}
                data-block-id={b.id}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs",
                  isCurrent && "bg-indigo-50 ring-1 ring-indigo-200",
                  isNext && "bg-amber-50 ring-1 ring-amber-200",
                  past && !isCurrent && "opacity-40"
                )}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: b.color }} />
                <span className="w-[74px] shrink-0 tabular-nums text-zinc-500">
                  {b.startTime}–{b.endTime}
                </span>
                <span className={cn("min-w-0 flex-1 truncate", isCurrent && "font-medium text-zinc-900")}>
                  {b.title}
                </span>
                {isCurrent && <span className="shrink-0 text-[10px] text-indigo-600">进行中</span>}
                {isNext && <span className="shrink-0 text-[10px] text-amber-600">下一个</span>}
              </li>
            );
          })}
      </ol>
    </div>
  );
}

function MiniButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-lg bg-white/20 px-2.5 py-1 text-xs font-medium hover:bg-white/30"
    >
      {children}
      {label}
    </button>
  );
}
