"use client";

import { Timer, Pause, Play, Square, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatRemaining, usePomodoro } from "@/components/focus/PomodoroContext";
import { BREAK_SUGGESTIONS } from "@/lib/pomodoro-settings";

const PHASE_LABEL: Record<string, string> = {
  work: "专注中",
  short_break: "短休息",
  long_break: "长休息",
};

export function PomodoroFullscreen() {
  const {
    fullscreen,
    setFullscreen,
    phase,
    remainingSec,
    selectedHabitId,
    habits,
    isRunning,
    isPaused,
    distractions,
    incrementDistraction,
    pause,
    resume,
    stop,
    pendingBreakQuality,
    submitBreakQuality,
    workMinutesUsed,
  } = usePomodoro();

  if (!fullscreen) return null;

  const habit = habits.find((h) => h.id === selectedHabitId);
  const onBreak = phase === "short_break" || phase === "long_break";
  const suggestion = BREAK_SUGGESTIONS[Math.floor(Date.now() / 30000) % BREAK_SUGGESTIONS.length];

  return (
    <div className="fixed inset-0 z-[200] bg-zinc-950 text-white flex flex-col items-center justify-center p-6">
      <button
        type="button"
        onClick={() => setFullscreen(false)}
        className="absolute top-4 right-4 text-sm text-zinc-500 hover:text-zinc-300"
      >
        退出全屏
      </button>

      {pendingBreakQuality ? (
        <div className="text-center space-y-6 max-w-sm">
          <p className="text-lg font-medium">休息质量如何？</p>
          <div className="flex gap-2 justify-center">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => void submitBreakQuality(n)}
                className="h-12 w-12 rounded-xl bg-zinc-800 hover:bg-indigo-600 text-lg font-medium"
              >
                {n}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => void submitBreakQuality(null)} className="text-sm text-zinc-500">
            跳过
          </button>
        </div>
      ) : (
        <>
          <p className="text-sm text-zinc-400 mb-2">{PHASE_LABEL[phase] ?? "准备专注"}</p>
          <p className="text-7xl font-bold tabular-nums mb-4">{formatRemaining(remainingSec)}</p>
          {habit && <p className="text-lg text-zinc-300 mb-2">{habit.name}</p>}
          {phase === "work" && (
            <p className="text-xs text-zinc-500 mb-6">{workMinutesUsed} 分钟番茄 · 分心 {distractions} 次</p>
          )}
          {onBreak && (
            <div className="rounded-xl bg-zinc-900 border border-zinc-800 px-6 py-4 mb-6 max-w-sm text-center">
              <Smartphone className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm text-zinc-300">{suggestion}</p>
            </div>
          )}

          <div className="flex items-center gap-3">
            {phase === "work" && (
              <Button
                variant="secondary"
                onClick={incrementDistraction}
                className="bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700"
              >
                分心 +1
              </Button>
            )}
            {isRunning && !isPaused && (
              <Button variant="secondary" onClick={pause} className="bg-zinc-800 border-zinc-700">
                <Pause className="h-4 w-4" /> 暂停
              </Button>
            )}
            {isPaused && (
              <Button onClick={resume} className="bg-red-600 hover:bg-red-700">
                <Play className="h-4 w-4" /> 继续
              </Button>
            )}
            {(isRunning || isPaused) && (
              <Button variant="secondary" onClick={() => void stop()} className="bg-zinc-800 border-zinc-700">
                <Square className="h-4 w-4" />
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
