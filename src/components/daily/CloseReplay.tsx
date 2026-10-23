"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { IRON_LAW_RHYTHM } from "@/lib/lifeos-iron-laws";
import { bedtimeDelayMinutes, formatBedtimeDelay } from "@/lib/sleep-window";
import { cn } from "@/lib/utils";
import { ChevronRight, X } from "lucide-react";

export type CloseReplayInput = {
  date: string;
  focus: string | null;
  mustDoDone: number;
  mustDoTotal: number;
  mustDoTitles: string[];
  habitsDone: number;
  habitsTotal: number;
  tasksDone: number;
  tasksTotal: number;
  energyMorning: number | null;
  drainMorning: number | null;
  sleepHours: number | null;
  wakeTime?: string | null;
  plannedSleepTime?: string | null;
  sleepTime?: string | null;
  energyEvening: number | null;
  drainEvening: number | null;
  reflection: string | null;
};

type Slide = {
  eyebrow: string;
  title: string;
  body?: string;
  accent: "amber" | "emerald" | "indigo" | "rose" | "zinc";
};

const ACCENT: Record<Slide["accent"], string> = {
  amber: "from-amber-500/90 to-orange-600/90",
  emerald: "from-emerald-500/90 to-teal-700/90",
  indigo: "from-indigo-500/90 to-violet-700/90",
  rose: "from-rose-500/90 to-pink-700/90",
  zinc: "from-zinc-700/95 to-zinc-900/95",
};

function buildSlides(input: CloseReplayInput): Slide[] {
  const slides: Slide[] = [
    {
      eyebrow: input.date,
      title: "今日回放",
      body: "三十秒看清：焦点 · 进展 · 节奏",
      accent: "zinc",
    },
  ];

  if (input.focus) {
    slides.push({
      eyebrow: "今天专注",
      title: input.focus,
      body: "主线优先于别人的紧急",
      accent: "amber",
    });
  }

  const mustLine =
    input.mustDoTotal > 0
      ? `必做 ${input.mustDoDone}/${input.mustDoTotal}`
      : null;
  const habitLine =
    input.habitsTotal > 0
      ? `习惯 ${input.habitsDone}/${input.habitsTotal}`
      : null;
  const taskLine =
    input.tasksTotal > 0
      ? `任务 ${input.tasksDone}/${input.tasksTotal}`
      : null;
  const stats = [mustLine, habitLine, taskLine].filter(Boolean).join(" · ");
  if (stats) {
    slides.push({
      eyebrow: "今天进展",
      title: stats,
      body:
        input.mustDoTitles.length > 0
          ? input.mustDoTitles.slice(0, 3).join(" · ")
          : "闭环比完美重要",
      accent: "emerald",
    });
  }

  const morningBits = [
    input.energyMorning != null ? `精力 ${input.energyMorning}` : null,
    input.drainMorning != null ? `内耗 ${input.drainMorning}` : null,
    input.sleepHours != null ? `睡眠 ${input.sleepHours} 小时` : null,
    input.wakeTime ? `起床 ${input.wakeTime}` : null,
    input.plannedSleepTime ? `计划 ${input.plannedSleepTime}` : null,
    input.sleepTime ? `就寝 ${input.sleepTime}` : null,
    formatBedtimeDelay(bedtimeDelayMinutes(input.plannedSleepTime ?? null, input.sleepTime ?? null)),
  ].filter(Boolean);
  const eveningBits = [
    input.energyEvening != null ? `精力 ${input.energyEvening}` : null,
    input.drainEvening != null ? `内耗 ${input.drainEvening}` : null,
  ].filter(Boolean);
  if (morningBits.length > 0 || eveningBits.length > 0) {
    const bits = [
      morningBits.length > 0 ? `早上 ${morningBits.join(" ")}` : null,
      eveningBits.length > 0 ? `晚上 ${eveningBits.join(" ")}` : null,
    ].filter(Boolean);
    slides.push({
      eyebrow: "身心快照",
      title: bits.join(" · "),
      body: "身体优先 · 明天按时起床先动起来",
      accent: "indigo",
    });
  }

  slides.push({
    eyebrow: "铁律③",
    title: IRON_LAW_RHYTHM.title,
    body: "不被别人影响 · 过好自己的提升节奏",
    accent: "rose",
  });

  if (input.reflection?.trim()) {
    slides.push({
      eyebrow: "今日一句话",
      title: input.reflection.trim(),
      accent: "zinc",
    });
  } else {
    slides.push({
      eyebrow: "收工",
      title: "节奏在自己手里",
      body: "早睡。明天继续。",
      accent: "zinc",
    });
  }

  return slides;
}

/** Parse `## 今日焦点` block from daily journal markdown. */
export function extractTodayFocus(content: string | null | undefined): string | null {
  if (!content?.trim()) return null;
  const m = content.match(/##\s*今日焦点\s*\n+([^\n#]+)/);
  return m?.[1]?.trim() || null;
}

type Props = {
  open: boolean;
  onClose: () => void;
  input: CloseReplayInput;
};

export function CloseReplay({ open, onClose, input }: Props) {
  const slides = useMemo(() => buildSlides(input), [input]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!open) return;
    setIdx(0);
  }, [open, input.date]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        setIdx((i) => Math.min(i + 1, slides.length - 1));
      }
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, slides.length]);

  useEffect(() => {
    if (!open) return;
    if (idx >= slides.length - 1) return;
    const t = window.setTimeout(() => setIdx((i) => i + 1), 2800);
    return () => window.clearTimeout(t);
  }, [open, idx, slides.length]);

  if (!open) return null;

  const slide = slides[idx]!;
  const last = idx >= slides.length - 1;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="今日回放"
      onClick={onClose}
    >
      <div
        className={cn(
          "relative w-full max-w-lg overflow-hidden rounded-3xl shadow-2xl",
          "bg-gradient-to-br text-white",
          ACCENT[slide.accent]
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full bg-white/15 p-1.5 hover:bg-white/25"
          aria-label="关闭"
        >
          <X className="h-4 w-4" />
        </button>

        <button
          type="button"
          className="block w-full min-h-[280px] px-8 py-12 text-left"
          onClick={() => (last ? onClose() : setIdx((i) => i + 1))}
        >
          <p
            key={`e-${idx}`}
            className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70 animate-in fade-in duration-500"
          >
            {slide.eyebrow}
          </p>
          <p
            key={`t-${idx}`}
            className="mt-4 text-2xl sm:text-3xl font-bold leading-snug tracking-tight animate-in fade-in slide-in-from-bottom-2 duration-500"
          >
            {slide.title}
          </p>
          {slide.body && (
            <p
              key={`b-${idx}`}
              className="mt-4 text-sm sm:text-base text-white/85 leading-relaxed animate-in fade-in duration-700"
            >
              {slide.body}
            </p>
          )}
        </button>

        <div className="flex items-center justify-between gap-3 px-6 pb-5">
          <div className="flex gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`第 ${i + 1} 屏`}
                onClick={() => setIdx(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === idx ? "w-6 bg-white" : "w-1.5 bg-white/40"
                )}
              />
            ))}
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="bg-white/95 text-zinc-900 hover:bg-white border-0"
            onClick={() => (last ? onClose() : setIdx((i) => i + 1))}
          >
            {last ? "收工" : "下一屏"}
            {!last && <ChevronRight className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
