"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input, Select, Textarea } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { fetchJson, invalidateFetchCache } from "@/components/ui/PageState";
import { Plus, Trash2, CheckCircle2, Circle, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_WEEKLY_PRIORITIES, type WeeklyPriority } from "@/lib/weekly-plan";

type GoalOption = { id: string; title: string; area: string };
type ProjectOption = { id: string; name: string; status: string };

type PlanData = {
  weekStart?: string;
  date?: string;
  weekLabel?: string;
  intention: string | null;
  priorities: Array<
    WeeklyPriority & {
      goal: GoalOption | null;
      project: ProjectOption | null;
    }
  >;
  goals: GoalOption[];
  projects: ProjectOption[];
};

const emptyPriority = (): WeeklyPriority => ({
  id: crypto.randomUUID(),
  title: "",
  goalId: null,
  projectId: null,
  completed: false,
});

type Props = {
  weekStart?: string;
  date?: string;
  className?: string;
};

/** Compact intention + priorities editor. Week and day use the same layout. */
export function WeekPlanStrip({ weekStart, date, className }: Props) {
  const isDay = Boolean(date);
  const anchor = date || weekStart || "";
  const [data, setData] = useState<PlanData | null>(null);
  const [intention, setIntention] = useState("");
  const [priorities, setPriorities] = useState<WeeklyPriority[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const cachePrefix = isDay ? "/api/plan/day" : "/api/plan/week";
  const loadUrl = isDay
    ? `/api/plan/day?date=${encodeURIComponent(anchor)}`
    : `/api/plan/week?weekStart=${encodeURIComponent(anchor)}`;

  const load = useCallback(
    async (force = false) => {
      if (!anchor) return;
      if (force) invalidateFetchCache(cachePrefix);
      try {
        const d = await fetchJson<PlanData>(loadUrl, { force });
        setData(d);
        setIntention(d.intention || "");
        setPriorities(
          d.priorities.length > 0
            ? d.priorities.map(({ id, title, goalId, projectId, completed }) => ({
                id,
                title,
                goalId,
                projectId,
                completed,
              }))
            : [emptyPriority()]
        );
      } catch {
        /* keep previous */
      }
    },
    [anchor, cachePrefix, loadUrl]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!data) return;
    setSaving(true);
    const filtered = priorities.filter((p) => p.title.trim()).slice(0, MAX_WEEKLY_PRIORITIES);
    await fetch(cachePrefix, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(isDay ? { date: data.date || anchor } : { weekStart: data.weekStart || anchor }),
        intention: intention.trim() || null,
        priorities: filtered,
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    invalidateFetchCache(cachePrefix);
    invalidateFetchCache(`/api/daily-log`);
    void load(true);
  };

  const updatePriority = (idx: number, patch: Partial<WeeklyPriority>) => {
    setPriorities((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };

  const filled = priorities.filter((p) => p.title.trim());
  const summary =
    intention.trim() ||
    (filled.length > 0
      ? filled.map((p) => (p.completed ? `✓ ${p.title}` : p.title)).join(" · ")
      : isDay
        ? "尚未设定今日一句话 / 优先级"
        : "尚未设定本周意图 / 优先级");

  return (
    <Card className={cn("mb-4 border-amber-100 bg-amber-50/30", className)}>
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex flex-1 min-w-0 items-center gap-2 text-left"
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-800/70 shrink-0">
            {isDay ? "今日计划" : "本周计划"}
          </span>
          {!expanded && (
            <span className="text-sm text-zinc-700 truncate">{summary}</span>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-zinc-400 shrink-0 ml-auto" />
          ) : (
            <ChevronDown className="h-4 w-4 text-zinc-400 shrink-0 ml-auto" />
          )}
        </button>
        <div className="flex items-center gap-2 shrink-0">
          {saved && <span className="text-xs text-emerald-600">已保存</span>}
          <Button size="sm" variant="secondary" onClick={() => void save()} disabled={saving || !data}>
            {saving ? "…" : "保存"}
          </Button>
        </div>
      </div>

      {expanded && (
        <CardContent className="pt-0 space-y-4">
          <Textarea
            value={intention}
            onChange={(e) => setIntention(e.target.value)}
            placeholder={isDay ? "今日：一句话…" : "本周意图：一句话聚焦…"}
            className="min-h-[56px] bg-white"
          />

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-zinc-500">
                优先级（最多 {MAX_WEEKLY_PRIORITIES}）
              </p>
              {priorities.length < MAX_WEEKLY_PRIORITIES && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPriorities((prev) => [...prev, emptyPriority()])}
                >
                  <Plus className="h-3.5 w-3.5" /> 添加
                </Button>
              )}
            </div>
            {priorities.map((p, idx) => (
              <div
                key={p.id}
                className="rounded-lg border border-zinc-200 bg-white p-3 flex gap-2 items-start"
              >
                <button
                  type="button"
                  onClick={() => updatePriority(idx, { completed: !p.completed })}
                  className="mt-2 shrink-0"
                >
                  {p.completed ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Circle className="h-4 w-4 text-zinc-300" />
                  )}
                </button>
                <div className="flex-1 space-y-2 min-w-0">
                  <Input
                    value={p.title}
                    onChange={(e) => updatePriority(idx, { title: e.target.value })}
                    placeholder={`优先级 ${idx + 1}`}
                    className={p.completed ? "line-through text-zinc-400" : ""}
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Select
                      value={p.goalId || ""}
                      onChange={(e) =>
                        updatePriority(idx, {
                          goalId: e.target.value || null,
                          projectId: null,
                        })
                      }
                    >
                      <option value="">关联目标</option>
                      {data?.goals.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.title}
                        </option>
                      ))}
                    </Select>
                    <Select
                      value={p.projectId || ""}
                      onChange={(e) =>
                        updatePriority(idx, { projectId: e.target.value || null })
                      }
                    >
                      <option value="">关联项目</option>
                      {data?.projects.map((proj) => (
                        <option key={proj.id} value={proj.id}>
                          {proj.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  {(p.goalId || p.projectId) && (
                    <div className="flex gap-1.5 flex-wrap">
                      {p.goalId && (
                        <Badge className="bg-violet-50 text-violet-700 text-[10px]">
                          {data?.goals.find((g) => g.id === p.goalId)?.title}
                        </Badge>
                      )}
                      {p.projectId && (
                        <Badge className="bg-indigo-50 text-indigo-700 text-[10px]">
                          {data?.projects.find((pr) => pr.id === p.projectId)?.name}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                {priorities.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setPriorities((prev) => prev.filter((_, i) => i !== idx))}
                    className="p-1.5 text-zinc-400 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-zinc-400">
            {isDay
              ? "和本周一样：一句话，优先级最多 3 条。"
              : "保存后可在「今日」一键设为必做；下方周日程安排时间。"}
          </p>
        </CardContent>
      )}
    </Card>
  );
}
