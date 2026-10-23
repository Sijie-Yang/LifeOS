"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, ProgressBar } from "@/components/ui/Badge";
import { Textarea, Label, Field } from "@/components/ui/Input";
import { GOAL_AREAS } from "@/lib/utils";
import { BarChart3, CheckCircle2, Users, Repeat, Target, ListChecks, Circle } from "lucide-react";
import { DateNav } from "@/components/ui/DateNav";
import { InsightCards, type InsightItem } from "@/components/insights/InsightCards";
import Link from "next/link";
import {
  CachedContent,
  fetchJson,
  peekFetchCache,
  shouldShowPageLoading,
} from "@/components/ui/PageState";

type GoalReflection = { goalId: string; note: string; goalTitle?: string };

type ReviewData = {
  weekStart: string;
  weekLabel: string;
  prev: string;
  next: string;
  stats: {
    habitRate: number;
    habitCheckIns: number;
    habitExpected?: number;
    activeProjects: number;
    avgProgress: number;
    contactedThisWeek: number;
    totalContacts: number;
    contentPublished?: number;
  };
  perHabit: Array<{ id: string; name: string; done: number; expected: number; rate: number; schedule: string }>;
  activeGoals: Array<{ id: string; title: string; area: string; progress: number }>;
  goalReflections: GoalReflection[];
  review: {
    wins: string | null;
    improvements: string | null;
    nextFocus: string | null;
    goalReflections: GoalReflection[];
  } | null;
  pastReviews: Array<{
    weekStart: string;
    wins: string | null;
    improvements: string | null;
    nextFocus: string | null;
    goalReflections: GoalReflection[];
  }>;
  weeklyPlan: {
    intention: string | null;
    priorities: Array<{ id: string; title: string; completed: boolean }>;
    completedCount: number;
    totalCount: number;
  } | null;
};

function ReviewEntry({
  review,
  label,
}: {
  review: {
    wins: string | null;
    improvements: string | null;
    nextFocus: string | null;
    goalReflections?: GoalReflection[];
  };
  label?: string;
}) {
  const hasContent =
    review.wins || review.improvements || review.nextFocus || (review.goalReflections?.length ?? 0) > 0;
  if (!hasContent) return <p className="text-sm text-zinc-400">（空）</p>;
  return (
    <>
      {label && <p className="text-xs text-zinc-500 mb-2">{label}</p>}
      {review.wins && (
        <p className="text-sm text-zinc-700">
          <span className="text-zinc-500">做得好：</span>
          {review.wins}
        </p>
      )}
      {review.improvements && (
        <p className="text-sm text-zinc-700 mt-1">
          <span className="text-zinc-500">需改进：</span>
          {review.improvements}
        </p>
      )}
      {review.nextFocus && (
        <p className="text-sm text-zinc-700 mt-1">
          <span className="text-zinc-500">下周重点：</span>
          {review.nextFocus}
        </p>
      )}
      {review.goalReflections && review.goalReflections.length > 0 && (
        <div className="mt-2 pt-2 border-t border-zinc-100 space-y-1">
          <p className="text-xs text-zinc-500">目标反思</p>
          {review.goalReflections.map((g) => (
            <p key={g.goalId} className="text-sm text-zinc-700">
              <span className="text-zinc-500">{g.goalTitle || "目标"}：</span>
              {g.note}
            </p>
          ))}
        </div>
      )}
    </>
  );
}

export default function ReviewPage() {
  const [data, setData] = useState<ReviewData | null>(() => peekFetchCache<ReviewData>("/api/review"));
  const [loading, setLoading] = useState(() => shouldShowPageLoading(["/api/review"]));
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ wins: "", improvements: "", nextFocus: "" });
  const [goalNotes, setGoalNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [insights, setInsights] = useState<InsightItem[]>([]);

  const load = useCallback(async (weekStart?: string | null) => {
    const qs = weekStart ? `?weekStart=${encodeURIComponent(weekStart)}` : "";
    const key = `/api/review${qs}`;
    if (shouldShowPageLoading([key])) setLoading(true);
    setError(null);
    try {
      const d = await fetchJson<ReviewData>(key);
      setData(d);
      if (d.review) {
        setForm({
          wins: d.review.wins || "",
          improvements: d.review.improvements || "",
          nextFocus: d.review.nextFocus || "",
        });
      } else {
        setForm({ wins: "", improvements: "", nextFocus: "" });
      }
      const notes: Record<string, string> = {};
      (d.goalReflections || []).forEach((g) => { notes[g.goalId] = g.note; });
      setGoalNotes(notes);
      const ins = await fetchJson<{ insights: InsightItem[] }>(`/api/insights${qs}`).catch(
        () => ({ insights: [] as InsightItem[] })
      );
      setInsights(ins.insights ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    const goalReflections = (data?.activeGoals ?? [])
      .filter((g) => goalNotes[g.id]?.trim())
      .map((g) => ({ goalId: g.id, note: goalNotes[g.id].trim() }));

    await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, goalReflections, weekStart: data?.weekStart }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    load(data?.weekStart);
  };

  return (
    <>
      <PageHeader
        title="周复盘"
        description={data ? `${data.weekLabel} — 回顾本周，规划下周` : "回顾本周，规划下周"}
      />
      <CachedContent loading={loading} error={error} onRetry={() => load()} hasData={!!data}>
      {data && (
      <>

      <DateNav
        label={data.weekLabel}
        prevLabel="上周"
        nextLabel="下周"
        onPrev={() => load(data.prev)}
        onNext={() => load(data.next)}
      />

      {data.weeklyPlan && data.weeklyPlan.totalCount > 0 && (
        <Card className="mb-6 border-indigo-100">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-5 w-5 text-indigo-500" />
              本周计划 vs 实际
              <Badge className="ml-2">
                {data.weeklyPlan.completedCount}/{data.weeklyPlan.totalCount} 完成
              </Badge>
              <Link href="/calendar/week" className="text-xs font-normal text-indigo-600 ml-auto">
                编辑计划 →
              </Link>
            </CardTitle>
            {data.weeklyPlan.intention && (
              <p className="text-sm text-zinc-600 mt-1">意图：{data.weeklyPlan.intention}</p>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {data.weeklyPlan.priorities.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                {p.completed ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-zinc-300 shrink-0" />
                )}
                <span className={p.completed ? "text-zinc-500 line-through" : "text-zinc-800"}>
                  {p.title}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <InsightCards insights={insights} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: "习惯完成率", value: `${data.stats.habitRate}%`, icon: Repeat, color: "text-emerald-600" },
          { label: "本周打卡", value: `${data.stats.habitCheckIns}/${data.stats.habitExpected ?? "—"}`, icon: CheckCircle2, color: "text-indigo-600" },
          { label: "项目均进度", value: `${data.stats.avgProgress}%`, icon: BarChart3, color: "text-amber-600" },
          { label: "本周联系", value: `${data.stats.contactedThisWeek}/${data.stats.totalContacts}`, icon: Users, color: "text-pink-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-5 flex items-center gap-4">
              <div className={`p-3 rounded-xl bg-zinc-100 ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xl font-bold text-zinc-900">{value}</p>
                <p className="text-xs text-zinc-500">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {data.activeGoals.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-amber-500" />
              人生目标进展
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.activeGoals.map((g) => (
              <div key={g.id} className="rounded-xl border border-zinc-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-900">{g.title}</span>
                    <Badge className={GOAL_AREAS[g.area]?.color}>{GOAL_AREAS[g.area]?.label}</Badge>
                  </div>
                  <span className="text-sm text-zinc-500">{g.progress}%</span>
                </div>
                <ProgressBar value={g.progress} />
                <Field className="mt-3">
                  <Label className="text-xs">本周与此目标相关的进展</Label>
                  <Textarea
                    value={goalNotes[g.id] || ""}
                    onChange={(e) => setGoalNotes({ ...goalNotes, [g.id]: e.target.value })}
                    placeholder="离这个目标近了一步吗？做了什么？"
                    className="min-h-[60px] mt-1"
                  />
                </Field>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle>各习惯本周</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.perHabit.map((h) => (
              <div key={h.id}>
                <div className="flex justify-between text-sm mb-0.5">
                  <span className="text-zinc-700 truncate">{h.name}</span>
                  <span className="text-zinc-500 whitespace-nowrap ml-2">
                    {h.expected > 0 ? `${h.done}/${h.expected} 次` : "本周暂无安排"}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mb-1">{h.schedule}</p>
                <ProgressBar value={h.rate} />
              </div>
            ))}
            {data.perHabit.length === 0 && (
              <p className="text-sm text-zinc-500 text-center py-4">暂无活跃习惯</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>复盘记录</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Field>
              <Label>本周什么做得好？</Label>
              <Textarea value={form.wins} onChange={(e) => setForm({ ...form, wins: e.target.value })} placeholder="完成了哪些习惯、推进了哪些项目..." className="min-h-[80px]" />
            </Field>
            <Field>
              <Label>什么需要改进？</Label>
              <Textarea value={form.improvements} onChange={(e) => setForm({ ...form, improvements: e.target.value })} placeholder="哪些地方没做到、原因是什么..." className="min-h-[80px]" />
            </Field>
            <Field>
              <Label>下周重点</Label>
              <Textarea value={form.nextFocus} onChange={(e) => setForm({ ...form, nextFocus: e.target.value })} placeholder="下周最重要的 1-3 件事..." className="min-h-[80px]" />
            </Field>
            <div className="flex items-center gap-3">
              <Button onClick={save} disabled={saving}>{saving ? "保存中..." : "保存复盘"}</Button>
              {saved && <span className="text-sm text-emerald-600">已保存 ✓</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      {data.pastReviews.length > 0 && (
        <Card className="mt-6">
          <CardHeader><CardTitle>历史复盘</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.pastReviews.map((r) => (
                <div key={r.weekStart} className="rounded-lg border border-zinc-100 px-4 py-3">
                  <p className="text-xs font-medium text-zinc-500 mb-2">周起始 {r.weekStart}</p>
                  <ReviewEntry review={r} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      </>
      )}
      </CachedContent>
    </>
  );
}
