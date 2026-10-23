"use client";

import { useEffect, useRef } from "react";
import { Timer, Play, Pause, Square, X, ChevronDown, SkipForward, Maximize2, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { formatRemaining, usePomodoro } from "@/components/focus/PomodoroContext";
import { BREAK_SUGGESTIONS } from "@/lib/pomodoro-settings";

const PHASE_LABEL: Record<string, string> = {
  idle: "选择番茄钟",
  work: "专注中",
  short_break: "短休息",
  long_break: "长休息",
};

export function PomodoroWidget() {
  const {
    habits,
    scheduledIds,
    selectedHabitId,
    setSelectedHabitId,
    phase,
    remainingSec,
    completedWorkCount,
    isRunning,
    isPaused,
    expanded,
    setExpanded,
    startWork,
    pause,
    resume,
    skipBreak,
    stop,
    distractions,
    incrementDistraction,
    setFullscreen,
    pendingBreakQuality,
    submitBreakQuality,
    workMinutesUsed,
  } = usePomodoro();

  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        if (phase === "idle" && !isRunning) setExpanded(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [expanded, phase, isRunning, setExpanded]);

  const selectedHabit = habits.find((h) => h.id === selectedHabitId);
  const canStart = !!selectedHabitId && phase === "idle" && !isRunning;
  const onBreak = phase === "short_break" || phase === "long_break";
  const suggestion = BREAK_SUGGESTIONS[Math.floor(Date.now() / 30000) % BREAK_SUGGESTIONS.length];

  return (
    <div ref={panelRef} className="fixed bottom-6 left-6 z-40 flex flex-col items-start gap-2">
      {expanded && (
        <div className="w-72 rounded-2xl border border-zinc-200 bg-white shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div
            className="px-4 py-3 text-white"
            style={{
              backgroundColor: selectedHabit?.color || (onBreak ? "#64748b" : "#ef4444"),
            }}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium opacity-90">{PHASE_LABEL[phase]}</p>
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="p-1 rounded-md hover:bg-white/20"
                aria-label="收起"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
            <p className="text-3xl font-bold tabular-nums mt-1">{formatRemaining(remainingSec)}</p>
            {selectedHabit && (
              <p className="text-sm mt-1 truncate opacity-95">{selectedHabit.name}</p>
            )}
            {completedWorkCount > 0 && (
              <p className="text-[11px] mt-1 opacity-80">今日已完成 {completedWorkCount} 番茄</p>
            )}
            {phase === "work" && (isRunning || isPaused) && (
              <p className="text-[11px] mt-0.5 opacity-75">{workMinutesUsed} 分钟 · 分心 {distractions}</p>
            )}
          </div>

          <div className="p-3 space-y-3">
            {pendingBreakQuality && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-zinc-600 text-center">休息质量？</p>
                <div className="flex gap-1 justify-center">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => void submitBreakQuality(n)}
                      className="h-8 w-8 rounded-lg bg-zinc-100 hover:bg-indigo-100 text-sm"
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => void submitBreakQuality(null)} className="text-xs text-zinc-400 w-full text-center">
                  跳过
                </button>
              </div>
            )}

            {!pendingBreakQuality && phase === "idle" && !isRunning && (
              <div>
                <p className="text-[11px] font-medium text-zinc-500 mb-1.5">研究 / 创业 / 整理</p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {habits.length === 0 ? (
                    <p className="text-xs text-zinc-400 py-2 text-center leading-relaxed">
                      暂无番茄钟
                    </p>
                  ) : (
                    habits.map((h) => {
                      const isScheduled = scheduledIds.has(h.id);
                      const active = selectedHabitId === h.id;
                      return (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => setSelectedHabitId(h.id)}
                          className={cn(
                            "w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                            active ? "bg-red-50 ring-1 ring-red-200" : "hover:bg-zinc-50"
                          )}
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: h.color }}
                          />
                          <span className="flex-1 min-w-0">
                            <span className="block truncate text-zinc-800">{h.name}</span>
                            {h.startTime && h.endTime && (
                              <span className="text-[10px] text-zinc-400">{h.startTime}–{h.endTime}</span>
                            )}
                          </span>
                          {!isScheduled && (
                            <span className="text-[10px] text-zinc-400 shrink-0">非今日</span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {!pendingBreakQuality && (
            <div className="flex items-center gap-2 flex-wrap">
              {canStart && (
                <Button
                  size="sm"
                  className="flex-1 bg-red-500 hover:bg-red-600"
                  onClick={() => void startWork()}
                  disabled={!selectedHabitId}
                >
                  <Play className="h-3.5 w-3.5" /> 开始
                </Button>
              )}
              {phase === "work" && (isRunning || isPaused) && (
                <>
                  <Button size="sm" variant="secondary" onClick={incrementDistraction} title="分心 +1">
                    分心 +1
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setFullscreen(true)} title="全屏专注">
                    <Maximize2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
              {isRunning && !isPaused && (
                <Button size="sm" variant="secondary" className="flex-1" onClick={pause}>
                  <Pause className="h-3.5 w-3.5" /> 暂停
                </Button>
              )}
              {isPaused && (
                <Button size="sm" className="flex-1 bg-red-500 hover:bg-red-600" onClick={resume}>
                  <Play className="h-3.5 w-3.5" /> 继续
                </Button>
              )}
              {onBreak && isRunning && (
                <Button size="sm" variant="secondary" className="flex-1" onClick={skipBreak}>
                  <SkipForward className="h-3.5 w-3.5" /> 跳过休息
                </Button>
              )}
              {(isRunning || isPaused || phase !== "idle") && (
                <Button size="sm" variant="secondary" onClick={() => void stop()}>
                  <Square className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            )}

            {onBreak && isRunning && !pendingBreakQuality && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-center">
                <Smartphone className="h-4 w-4 text-emerald-600 mx-auto mb-1" />
                <p className="text-[11px] text-emerald-800">{suggestion}</p>
              </div>
            )}

            {onBreak && isRunning && !pendingBreakQuality && (
              <p className="text-[11px] text-zinc-500 text-center">休息结束后可开始下一番茄</p>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "relative flex items-center gap-2 rounded-full shadow-lg transition-all",
          isRunning || isPaused
            ? "h-12 pl-4 pr-5 text-white"
            : "h-12 w-12 justify-center text-white"
        )}
        style={{
          backgroundColor: selectedHabit?.color || "#ef4444",
        }}
        title="番茄钟"
      >
        {isRunning || isPaused ? (
          <>
            <Timer className="h-4 w-4" />
            <span className="text-sm font-semibold tabular-nums">{formatRemaining(remainingSec)}</span>
          </>
        ) : (
          <Timer className="h-5 w-5" />
        )}
        {expanded && phase === "idle" && !isRunning && (
          <span
            role="button"
            tabIndex={0}
            className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-zinc-800/80 flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(false);
            }}
            onKeyDown={(e) => e.key === "Enter" && setExpanded(false)}
          >
            <X className="h-3 w-3" />
          </span>
        )}
      </button>
    </div>
  );
}
