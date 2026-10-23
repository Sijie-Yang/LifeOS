"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { fetchJson, invalidateFetchCache } from "@/components/ui/PageState";
import { useEventTimers } from "@/lib/use-event-timers";
import { allocateTimerSlots, allocationBackground } from "@/lib/event-timers";
import { useAgentActivity } from "@/lib/use-agent-activity";
import { agentGreen, halfHourLabel, localDateKey } from "@/lib/agent-activity";
import { cn } from "@/lib/utils";
import {
  TIME_FILL_CATEGORIES,
  halfHourSlots,
  parseTimeFills,
  timeFillCategory,
  type TimeFillCategoryId,
} from "@/lib/time-fills";

type FillMap = Record<string, TimeFillCategoryId>;

type TimeBlockProps = { date: string; wakeTime?: string | null; endTime?: string | null };
export function TodayTimeBlocks(props: TimeBlockProps) {
  return <TimeBlocksForDate key={props.date} {...props} />;
}

function TimeBlocksForDate({ date, wakeTime = null, endTime = null }: TimeBlockProps) {
  const [fills, setFills] = useState<FillMap>({});
  const [selected, setSelected] = useState<TimeFillCategoryId | null>(null);
  const loaded = useRef(false);
  const [ready, setReady] = useState(false);
  const latestFills = useRef<FillMap>({});
  const pendingWrite = useRef<FillMap | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const saveVersion = useRef(0);
  const [saveStatus, setSaveStatus] = useState<"loading" | "ready" | "saving" | "saved" | "error">("loading");
  const [fillError, setFillError] = useState<string | null>(null);
  const loadId = useRef(0);
  const dirty = useRef(false);
  const paintMode = useRef<"paint" | "erase" | null>(null);
  const { data: agentData, error: agentError } = useAgentActivity(date);
  const agentCounts = agentData?.counts ?? {};
  const { timers, error: timerError, offset } = useEventTimers(date);
  const [timerNow, setTimerNow] = useState(() => Date.now());
  const automatic = useMemo(() => allocateTimerSlots(timers, date, timerNow + offset), [timers, date, timerNow, offset]);
  const [nowSlot, setNowSlot] = useState<string | null>(null);
  const slots = halfHourSlots(wakeTime, endTime);
  const agentSlots = halfHourSlots(wakeTime, "24:00");
  const rangeLabel = slots.length > 0 ? `${slots[0]}–${endLabel(slots.at(-1)!)}` : null;

  const load = useCallback(async () => {
    const id = ++loadId.current;
    dirty.current = false;
    try {
      const data = await fetchJson<{ log: { timeFills?: unknown } | null }>(`/api/daily-log?date=${date}`, {
        force: true,
      });
      if (id !== loadId.current || dirty.current) return;
      const next = parseTimeFills(data.log?.timeFills);
      loaded.current = true;
      setReady(true);
      latestFills.current = next;
      setFills(next);
      setFillError(null);
      setSaveStatus("ready");
    } catch {
      if (id !== loadId.current || dirty.current) return;
      setFillError("时间块加载失败，请重试后编辑。");
      setSaveStatus("error");
    }
  }, [date]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate editable state from the remote daily log
    void load();
  }, [load]);


  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTimerNow(+now);
      setNowSlot(localDateKey(now) === date ? halfHourLabel(now) : null);
    };
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, [date]);

  const flush = useCallback(() => {
    clearTimeout(saveTimer.current);
    const next = pendingWrite.current;
    if (!next) return;
    pendingWrite.current = null;
    const version = ++saveVersion.current;
    setSaveStatus("saving");
    saveQueue.current = saveQueue.current.then(async () => {
      try {
        const response = await fetch("/api/daily-log", {
          method: "POST", keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, timeFills: next }),
        });
        if (!response.ok) throw new Error("时间块保存失败，填色仍保留，请重试。");
        invalidateFetchCache("/api/daily-log");
        if (version === saveVersion.current && !pendingWrite.current) { setFillError(null); setSaveStatus("saved"); }
      } catch (error) {
        if (version === saveVersion.current) {
          setFillError(error instanceof Error ? error.message : "保存失败，请重试。");
          setSaveStatus("error");
        }
      }
    });
  }, [date]);

  // Flush a pending edit when switching dates/pages instead of cancelling the last stroke.
  useEffect(() => () => { flush(); }, [flush]);

  const apply = (slot: string, mode: "paint" | "erase") => {
    if (!loaded.current) return;
    dirty.current = true;
    const next = { ...latestFills.current };
    if (mode === "erase" || !selected) delete next[slot];
    else next[slot] = selected;
    latestFills.current = next;
    setFills(next);
    pendingWrite.current = next;
    clearTimeout(saveTimer.current);
    setSaveStatus("saving");
    saveTimer.current = setTimeout(flush, 400);
  };

  const onSlotDown = (slot: string) => {
    const mode = selected && fills[slot] !== selected ? "paint" : "erase";
    paintMode.current = mode;
    apply(slot, mode);
  };

  return (
    <Card className="self-start w-full">
      <CardHeader className="py-3 px-4 border-b border-zinc-100 shrink-0">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4 text-indigo-600" />
          时间块
          <span role="status" className="ml-auto text-[10px] font-normal text-zinc-400">{saveStatus === "loading" ? "加载中…" : saveStatus === "saving" ? "保存中…" : saveStatus === "saved" ? "已保存" : ""}</span>
          {rangeLabel && <span className="font-normal text-zinc-400">{rangeLabel}</span>}
        </CardTitle>
      </CardHeader>
      <CardContent
        className="p-3 pt-3"
        onPointerUp={() => {
          paintMode.current = null;
        }}
        onPointerLeave={() => {
          paintMode.current = null;
        }}
      >
        {fillError && <div role="alert" className="mb-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">{fillError}<button type="button" className="ml-2 underline" onClick={() => {
          if (!loaded.current) void load();
          else { pendingWrite.current = latestFills.current; flush(); }
        }}>重试</button></div>}
        <div className="flex flex-wrap gap-1 mb-3">
          {TIME_FILL_CATEGORIES.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setSelected((current) => (current === category.id ? null : category.id))}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
                selected === category.id ? "border-zinc-800 bg-zinc-50" : "border-zinc-200 text-zinc-600"
              )}
            >
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: category.color }} />
              {category.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {slots.map((slot) => {
            const manual = timeFillCategory(fills[slot]);
            const allocation = automatic[slot] ?? [];
            const category = manual ?? timeFillCategory(allocation[0]?.category);
            const detail = manual ? `${manual.label} · 手动` : allocation.length ? allocation.map((p) => `${timeFillCategory(p.category)?.label} ${Math.round(p.seconds / 6) / 10} 分钟`).join(" / ") + " · 自动" : "未记录";
            return (
              <button
                key={slot}
                type="button"
                disabled={!ready}
                aria-label={`${slot} ${detail}`}
                title={`${slot} ${detail}`}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSlotDown(slot); paintMode.current = null; } }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  onSlotDown(slot);
                }}
                onPointerEnter={() => {
                  if (paintMode.current) apply(slot, paintMode.current);
                }}
                className={cn(
                  "h-9 rounded-md text-[10px] font-mono tabular-nums",
                  category ? "text-white" : "bg-zinc-200 text-zinc-500 hover:bg-zinc-300"
                )}
                style={manual ? { backgroundColor: manual.color } : allocation.length ? { background: allocationBackground(allocation) } : undefined}
              >
                {slot}{!manual && allocation.length > 0 && <span className="ml-1 opacity-80">· 自</span>}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[10px] text-zinc-400">事件计时自动填色；并行部分按比例分配。手动填色优先，再点同色恢复自动分配。</p>
        {timerError && <p role="status" className="mt-2 text-xs text-amber-700">自动计时未更新：{timerError}</p>}
        <div className="mt-4">
          <p className="mb-1.5 text-[11px] text-zinc-500">
            Agent
            <span className="ml-1 text-zinc-400">0 个是灰色，越多越绿 · 到 24:00</span>
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {agentError && <span role="status" className="text-xs text-amber-700">Agent 数据暂未更新</span>}
            {agentSlots.map((slot) => {
              const count = agentCounts[slot] ?? 0;
              const current = slot === nowSlot;
              return (
                <div
                  key={slot}
                  className={cn(
                    "flex h-9 items-center justify-center rounded-md text-[10px] font-mono tabular-nums text-zinc-600",
                    current && "ring-2 ring-emerald-700 ring-offset-1"
                  )}
                  style={{ backgroundColor: agentGreen(count) }}
                  title={count === 0 ? `${slot} 没有 Agent` : `${slot} ${count} 个 Agent`}
                >
                  {slot}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function endLabel(slot: string) {
  const [hour, minute] = slot.split(":").map(Number);
  const total = (hour * 60 + minute + 30) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
