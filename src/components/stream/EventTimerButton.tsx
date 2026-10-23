"use client";

import { useState } from "react";
import { Timer } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { type StreamEvent } from "@/lib/event-stream";
import { effectiveTimerStatus, suggestTimerCategory } from "@/lib/event-timers";
import { useEventTimers, mutateEventTimer } from "@/lib/use-event-timers";
import { TIME_FILL_CATEGORIES, type TimeFillCategoryId } from "@/lib/time-fills";
import { localDateKey } from "@/lib/agent-activity";

export function EventTimerButton({ event }: { event: StreamEvent }) {
  const { timers, clock } = useEventTimers(localDateKey(new Date()));
  const [open, setOpen] = useState(false);
  const active = timers.find((t) => t.eventId === event.id && ["running", "paused"].includes(effectiveTimerStatus(t, clock)));
  return <>
    <button type="button" aria-label={`${active ? "查看计时" : "开始计时"}：${event.title}`} onClick={() => {
      if (active) document.getElementById("event-timer-tracks")?.scrollIntoView({ behavior: "smooth", block: "start" });
      else setOpen(true);
    }} className={`inline-flex items-center gap-1 rounded-md px-2 py-1 ${active ? "bg-rose-50 text-rose-700" : "text-zinc-500 hover:bg-rose-50 hover:text-rose-700"}`}>
      <Timer className="h-3.5 w-3.5" />{active ? active.status === "paused" ? "已暂停" : "计时中" : "计时"}
    </button>
    {open && <StartTimer event={event} onClose={() => setOpen(false)} />}
  </>;
}

function StartTimer({ event, onClose }: { event: StreamEvent; onClose: () => void }) {
  const [mode, setMode] = useState<"fixed" | "free">("fixed");
  const [minutes, setMinutes] = useState("25");
  const [category, setCategory] = useState<TimeFillCategoryId>(() => suggestTimerCategory(event));
  const [autoAllocate, setAutoAllocate] = useState(true);
  const [requestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      await mutateEventTimer("/api/event-timers", { eventId: event.id, requestId, mode, minutes: Number(minutes), category, autoAllocate }, "POST");
      onClose();
      document.getElementById("event-timer-tracks")?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (e) { setError(e instanceof Error ? e.message : "启动失败，请重试"); }
    finally { setBusy(false); }
  };
  return <Modal open title="开始事件计时" onClose={() => { if (!busy) onClose(); }}>
    <div className="space-y-4">
      <p className="font-medium text-zinc-900">{event.title}</p>
      <p className="text-xs text-zinc-500">从现在开始记录；可以与其他事件并行。结束计时不会自动完成事件。</p>
      <fieldset className="flex gap-4 text-sm"><legend className="mb-2 text-zinc-600">计时方式</legend>
        <label><input type="radio" name="event-timer-mode" checked={mode === "fixed"} onChange={() => setMode("fixed")} /> 定时番茄钟</label>
        <label><input type="radio" name="event-timer-mode" checked={mode === "free"} onChange={() => setMode("free")} /> 自由计时</label>
      </fieldset>
      {mode === "fixed" && <label className="block text-sm">时长（分钟）<input type="number" min="1" max="240" value={minutes} onChange={(e) => setMinutes(e.target.value)} className="ml-3 w-24 rounded-lg border border-zinc-200 px-3 py-2" /></label>}
      <label className="block text-sm">时间块分类 <select value={category} onChange={(e) => setCategory(e.target.value as TimeFillCategoryId)} className="ml-3 rounded-lg border border-zinc-200 px-3 py-2">
        {TIME_FILL_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={autoAllocate} onChange={(e) => setAutoAllocate(e.target.checked)} /> 自动分配到实际时间块</label>
      <p className="text-xs text-zinc-500">分类是建议，可随时修改。并行时间按事件均分，手动填色优先。</p>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <Button onClick={() => void start()} disabled={busy || (mode === "fixed" && (!Number.isInteger(Number(minutes)) || Number(minutes) < 1 || Number(minutes) > 240))}>{busy ? "启动中…" : "开始计时"}</Button>
    </div>
  </Modal>;
}

/** 事件流顶部：不挂任何事件，随时给自己开一个计时（「洗衣服 45 分钟」）；到点会推到手机 */
export function FreeTimerStart() {
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState("25");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const free = minutes.trim() === "";
  const valid = title.trim().length > 0 && (free || (Number.isInteger(Number(minutes)) && Number(minutes) >= 1 && Number(minutes) <= 240));
  const start = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    const requestId = crypto.randomUUID();
    const t = title.trim();
    try {
      await mutateEventTimer(
        "/api/event-timers",
        {
          eventId: `free:${requestId}`,
          requestId,
          title: t,
          mode: free ? "free" : "fixed",
          minutes: free ? undefined : Number(minutes),
          category: suggestTimerCategory({ kind: "free", title: t }),
          autoAllocate: true,
        },
        "POST"
      );
      setTitle("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "启动失败，请重试");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-rose-100 bg-rose-50/40 px-3 py-2"
      onSubmit={(e) => {
        e.preventDefault();
        void start();
      }}
    >
      <Timer className="h-4 w-4 text-rose-600" />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="随时开始计时：在做什么？（洗衣服、写论文、午饭…）"
        className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm"
      />
      <label className="flex items-center gap-1 text-xs text-zinc-500">
        <input
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          inputMode="numeric"
          className="w-14 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-right text-sm"
          title="分钟；空着 = 自由计时（不设结束）"
        />
        分钟
      </label>
      {[25, 45, 60].map((m) => (
        <button key={m} type="button" onClick={() => setMinutes(String(m))} className="rounded-md bg-white px-2 py-1 text-xs text-zinc-600 hover:bg-rose-100">
          {m}
        </button>
      ))}
      <button type="button" onClick={() => setMinutes("")} className="rounded-md bg-white px-2 py-1 text-xs text-zinc-600 hover:bg-rose-100" title="不设结束时间">
        不限
      </button>
      <Button type="submit" size="sm" disabled={!valid || busy}>
        {busy ? "启动中…" : "开始"}
      </Button>
      <p className="w-full text-[11px] text-zinc-400">定时的到点会推到手机 / 手表；时间自动记进当天的时间块。{error && <span className="ml-1 text-red-600">{error}</span>}</p>
    </form>
  );
}
