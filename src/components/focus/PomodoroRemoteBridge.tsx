"use client";

import { useEffect, useRef } from "react";
import { usePomodoro } from "@/components/focus/PomodoroContext";
import {
  POMODORO_COMMAND_EVENT,
  POMODORO_COMMAND_KEY,
  parsePomodoroCommand,
  type PomodoroCommand,
} from "@/lib/pomodoro-remote";

/**
 * Lets other windows (the /mini page, the macOS shell) drive the one running timer.
 * Commands arrive as a localStorage write (other tabs / web views) or a window event
 * (injected by the macOS shell); the nonce makes the two paths idempotent.
 */
export function PomodoroRemoteBridge() {
  const pomodoro = usePomodoro();
  const latest = useRef(pomodoro);
  const seen = useRef(new Set<string>());
  const pendingStart = useRef<string | null>(null);

  useEffect(() => {
    latest.current = pomodoro;
  });

  useEffect(() => {
    const run = (cmd: PomodoroCommand | null) => {
      if (!cmd || seen.current.has(cmd.nonce)) return;
      seen.current.add(cmd.nonce);
      const p = latest.current;
      switch (cmd.type) {
        case "start":
          if (p.phase !== "idle" || p.isRunning || p.isPaused || !cmd.habitId) return;
          // startWork reads selectedHabitId, so select first and start after re-render.
          p.setSelectedHabitId(cmd.habitId);
          pendingStart.current = cmd.habitId;
          return;
        case "pause":
          return p.pause();
        case "resume":
          return p.resume();
        case "stop":
          return void p.stop();
        case "skipBreak":
          return p.skipBreak();
        case "distraction":
          if (p.phase === "work") p.incrementDistraction();
          return;
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === POMODORO_COMMAND_KEY && e.newValue) run(parsePomodoroCommand(e.newValue));
    };
    const onEvent = (e: Event) => run(parsePomodoroCommand((e as CustomEvent).detail));
    window.addEventListener("storage", onStorage);
    window.addEventListener(POMODORO_COMMAND_EVENT, onEvent);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(POMODORO_COMMAND_EVENT, onEvent);
    };
  }, []);

  useEffect(() => {
    const habitId = pendingStart.current;
    if (!habitId || pomodoro.selectedHabitId !== habitId) return;
    if (!pomodoro.habits.some((h) => h.id === habitId)) return;
    pendingStart.current = null;
    void pomodoro.startWork();
  }, [pomodoro]);

  return null;
}
