"use client";

import { useEffect, useState } from "react";
import { Pause, Play, Square } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 逐项目对齐的计时器：默认 15 分钟倒计时，可以改时长；到点不停，继续显示超时多久。
 * 状态存在本机浏览器里，关掉弹窗再打开计时不中断。
 */
type TimerState = { minutes: number; startedAt: number | null; elapsedMs: number };

const KEY = "lifeos:align-timer";
const DEFAULT: TimerState = { minutes: 15, startedAt: null, elapsedMs: 0 };

function readTimer(): TimerState {
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as Partial<TimerState> | null;
    if (!raw) return DEFAULT;
    return {
      minutes: Number.isFinite(raw.minutes) && raw.minutes! > 0 ? raw.minutes! : 15,
      startedAt: typeof raw.startedAt === "number" ? raw.startedAt : null,
      elapsedMs: typeof raw.elapsedMs === "number" && raw.elapsedMs > 0 ? raw.elapsedMs : 0,
    };
  } catch {
    return DEFAULT;
  }
}

function clock(ms: number): string {
  const total = Math.floor(Math.abs(ms) / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function AlignTimer() {
  const [t, setT] = useState<TimerState>(readTimer);
  const [now, setNow] = useState(() => t.startedAt ?? 0);

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(t));
    } catch {
      /* 存不了就只在本次生效 */
    }
  }, [t]);

  useEffect(() => {
    if (t.startedAt == null) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [t.startedAt]);

  const running = t.startedAt != null;
  const elapsed = t.elapsedMs + (running ? Math.max(0, now - t.startedAt!) : 0);
  const remaining = t.minutes * 60_000 - elapsed;
  const over = remaining < 0;
  const started = running || elapsed > 0;

  const start = () => {
    const at = Date.now();
    setNow(at);
    setT((s) => ({ ...s, startedAt: at }));
  };
  const pause = () => setT((s) => ({ ...s, startedAt: null, elapsedMs: s.elapsedMs + (Date.now() - (s.startedAt ?? Date.now())) }));
  const stop = () => setT((s) => ({ ...s, startedAt: null, elapsedMs: 0 }));

  const btn = "inline-flex h-6 items-center gap-1 rounded-md px-2 text-[11px] font-medium";
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-2 py-1",
        over ? "border-rose-200 bg-rose-50" : running ? "border-indigo-200 bg-indigo-50/60" : "border-zinc-200 bg-white"
      )}
    >
      <span
        className={cn("w-16 text-center text-sm font-semibold tabular-nums", over ? "text-rose-600" : "text-zinc-900")}
        title={over ? `已超时 ${clock(remaining)}` : "剩余时间"}
      >
        {over ? `+${clock(remaining)}` : clock(remaining)}
      </span>
      <label className="flex items-center gap-0.5 text-[11px] text-zinc-500" title="时长（分钟），随时可改">
        <input
          type="number"
          min={1}
          max={180}
          value={t.minutes}
          onChange={(e) => {
            const n = Math.round(Number(e.target.value));
            if (Number.isFinite(n) && n >= 1 && n <= 180) setT((s) => ({ ...s, minutes: n }));
          }}
          className="w-10 rounded border border-zinc-200 bg-white px-1 py-0.5 text-right tabular-nums"
        />
        分
      </label>
      {running ? (
        <button type="button" onClick={pause} className={cn(btn, "bg-zinc-100 text-zinc-700 hover:bg-zinc-200")}>
          <Pause className="h-3 w-3" />
          暂停
        </button>
      ) : (
        <button type="button" onClick={start} className={cn(btn, "bg-indigo-600 text-white hover:bg-indigo-700")}>
          <Play className="h-3 w-3" />
          {started ? "继续" : "开始"}
        </button>
      )}
      {started && (
        <button type="button" onClick={stop} className={cn(btn, "text-zinc-500 hover:bg-zinc-100")} title="结束并归零">
          <Square className="h-3 w-3" />
          结束
        </button>
      )}
      {over && <span className="text-[10px] text-rose-600">超时</span>}
    </div>
  );
}
