"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { useEventTimers, mutateEventTimer } from "@/lib/use-event-timers";
import { effectiveTimerStatus, timerSegments, timerElapsedSeconds, formatTimerSeconds, type EventTimerDto } from "@/lib/event-timers";
import { TIME_FILL_CATEGORIES, timeFillCategory } from "@/lib/time-fills";
import { localDateKey } from "@/lib/agent-activity";

export function EventTimerTracks() {
  const [now, setNow] = useState(() => Date.now());
  const [history, setHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string[]>([]);
  const { timers, loading, error: loadError, offset } = useEventTimers(localDateKey(new Date(now)));
  useEffect(() => {
    const tick = () => { if (document.visibilityState !== "hidden") setNow(Date.now()); };
    const interval = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(interval); document.removeEventListener("visibilitychange", tick); };
  }, []);
  const clock = now + offset;
  const active = timers.filter((t) => ["running", "paused"].includes(effectiveTimerStatus(t, clock)));
  const completed = timers.filter((t) => effectiveTimerStatus(t, clock) === "completed");
  const visible = history ? [...active, ...completed] : active;
  const start = Math.min(clock - 60_000, ...visible.map((t) => Date.parse(t.startedAt)));
  const duration = Math.max(60_000, clock - start);
  const position = (time: string) => Math.max(0, Math.min(100, (Date.parse(time) - start) / duration * 100));
  const change = async (timer: EventTimerDto, body: Record<string, unknown>) => {
    if (busy.includes(timer.id)) return;
    setBusy((v) => [...v, timer.id]); setError(null);
    try { await mutateEventTimer(`/api/event-timers/${timer.id}`, body); }
    catch (e) { setError(e instanceof Error ? e.message : "保存失败，请重试"); }
    finally { setBusy((v) => v.filter((id) => id !== timer.id)); }
  };
  const runningCount = active.filter((t) => effectiveTimerStatus(t, clock) === "running").length;
  return <section id="event-timer-tracks" aria-label="并行事件计时" className="mb-6 scroll-mt-4 rounded-2xl border border-rose-100 bg-white p-4 shadow-sm">
    <div className="flex flex-wrap items-center gap-2">
      <Timer className="h-4 w-4 text-rose-600" /><h2 className="text-sm font-semibold text-zinc-900">并行计时</h2>
      <span role="status" className="text-xs text-rose-600">{loading ? "加载中…" : `${runningCount} 个进行中${active.length > runningCount ? ` · ${active.length - runningCount} 个暂停` : ""}`}</span>
      <Link href="/timeline?scale=day" className="ml-auto text-xs text-indigo-600 hover:underline">查看时间块 →</Link>
    </div>
    <p className="mt-2 text-xs text-zinc-500">每条轨道按实际起点延伸到此刻；空隙表示暂停。定时到点自动结束，自由计时需手动结束。</p>
    {(error || loadError) && <p role="alert" className="mt-2 text-xs text-red-600">{error || loadError}</p>}
    {!loading && !visible.length && <p className="py-5 text-sm text-zinc-400">点击下方事件的「计时」，开始一段专注。</p>}
    {visible.length > 0 && <>
      <div className="mt-4 flex justify-between text-[10px] tabular-nums text-zinc-400"><span>{new Date(start).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}</span><span className="text-rose-600">此刻 {new Date(clock).toLocaleTimeString("zh-CN", { hour12: false })}</span></div>
      <div className="mt-2 space-y-3 border-r-2 border-rose-400 pr-3">
        {visible.map((timer) => {
          const status = effectiveTimerStatus(timer, clock);
          const elapsed = timerElapsedSeconds(timer, clock);
          const spans = timerSegments(timer, clock);
          const color = timeFillCategory(timer.category)?.color ?? "#71717a";
          const disabled = busy.includes(timer.id);
          return <div key={timer.id} data-timer-id={timer.id} className="rounded-xl bg-zinc-50 p-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
              <Link href={timer.href} className="min-w-0 flex-1 truncate font-medium text-zinc-800 hover:underline">{timer.title}</Link>
              <span className="font-mono tabular-nums text-zinc-700">{formatTimerSeconds(elapsed)}</span>
              <span className="text-zinc-400">{status === "paused" ? "已暂停" : status === "completed" ? "已结束" : timer.mode === "fixed" ? `剩余 ${formatTimerSeconds((timer.durationSeconds ?? 0) - elapsed)}` : "自由计时"}</span>
            </div>
            <div role="img" aria-label={`${timer.title}，${formatTimerSeconds(elapsed)}，${spans.length} 段计时`} className="relative my-2 h-5 rounded bg-zinc-200/70">
              {spans.map((span, i) => <span key={i} className="absolute inset-y-0 rounded-sm" title={`${new Date(span.start).toLocaleTimeString()} – ${new Date(span.end).toLocaleTimeString()}`} style={{ left: `${position(span.start)}%`, width: `${Math.max(0.25, position(span.end) - position(span.start))}%`, maxWidth: `${100 - position(span.start)}%`, backgroundColor: color, opacity: status === "completed" ? 0.55 : 0.9 }} />)}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
              <select aria-label={`${timer.title}的时间分类`} disabled={disabled} value={timer.category} onChange={(e) => void change(timer, { action: "settings", category: e.target.value })} className="max-w-24 rounded border border-zinc-200 bg-white px-1 py-1">{TIME_FILL_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>
              <label className="flex items-center gap-1"><input type="checkbox" disabled={disabled} checked={timer.autoAllocate} onChange={(e) => void change(timer, { action: "settings", autoAllocate: e.target.checked })} />分配时间块</label>
              <span className="flex-1" />
              {(status === "running" || status === "paused") && <>
                <button disabled={disabled} onClick={() => void change(timer, { action: status === "paused" ? "resume" : "pause" })} className="rounded px-2 py-1 hover:bg-white disabled:opacity-40">{status === "paused" ? "继续" : "暂停"}</button>
                <button disabled={disabled} onClick={() => void change(timer, { action: "stop" })} className="rounded bg-zinc-800 px-2 py-1 text-white disabled:opacity-40">结束</button>
                <button disabled={disabled} aria-label={`放弃计时：${timer.title}`} onClick={() => { if (confirm("放弃这段计时？对应的自动分配也会撤销，手动时间块保持不变。")) void change(timer, { action: "cancel" }); }} className="rounded px-1 py-1 text-zinc-400">放弃</button>
              </>}
            </div>
          </div>;
        })}
      </div>
    </>}
    {completed.length > 0 && <button onClick={() => setHistory(!history)} className="mt-3 text-xs text-zinc-500 hover:text-zinc-900">{history ? "收起" : "展开"}今日已结束 · {completed.length}</button>}
  </section>;
}
