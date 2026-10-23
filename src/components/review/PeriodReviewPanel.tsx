"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, ProgressBar } from "@/components/ui/Badge";
import { Textarea, Label, Field } from "@/components/ui/Input";
import { GOAL_AREAS, fmtMoney } from "@/lib/utils";
import { BarChart3, CheckCircle2, Users, Repeat, Target, Megaphone, Wallet } from "lucide-react";
import { DateNav } from "@/components/ui/DateNav";
import {
  CachedContent,
  fetchJson,
  peekFetchCache,
  shouldShowPageLoading,
} from "@/components/ui/PageState";

type PeriodType = "month" | "quarter" | "year";

type GoalReflection = { goalId: string; note: string; goalTitle?: string };

type PeriodData = {
  periodType: PeriodType;
  periodKey: string;
  periodLabel: string;
  start: string;
  end: string;
  prev: string;
  next: string;
  stats: {
    habitRate: number;
    habitCheckIns: number;
    habitExpected: number;
    activeProjects: number;
    avgProgress: number;
    contactedInPeriod: number;
    totalContacts: number;
    contentPublished: number;
    monthIncome: number;
    monthExpense: number;
    monthBalance: number;
  };
  activeGoals: Array<{ id: string; title: string; area: string; progress: number }>;
  goalReflections: GoalReflection[];
  review: {
    wins: string | null;
    improvements: string | null;
    nextFocus: string | null;
  } | null;
  pastReviews: Array<{
    periodKey: string;
    wins: string | null;
    improvements: string | null;
    nextFocus: string | null;
    goalReflections: GoalReflection[];
  }>;
};

function ReviewEntry({
  review,
  nextFocusLabel = "下阶段重点",
}: {
  review: {
    wins: string | null;
    improvements: string | null;
    nextFocus: string | null;
    goalReflections?: GoalReflection[];
  };
  nextFocusLabel?: string;
}) {
  const hasContent =
    review.wins || review.improvements || review.nextFocus || (review.goalReflections?.length ?? 0) > 0;
  if (!hasContent) return <p className="text-sm text-zinc-400">（空）</p>;
  return (
    <>
      {review.wins && (
        <p className="text-sm text-zinc-700"><span className="text-zinc-500">做得好：</span>{review.wins}</p>
      )}
      {review.improvements && (
        <p className="text-sm text-zinc-700 mt-1"><span className="text-zinc-500">需改进：</span>{review.improvements}</p>
      )}
      {review.nextFocus && (
        <p className="text-sm text-zinc-700 mt-1"><span className="text-zinc-500">{nextFocusLabel}：</span>{review.nextFocus}</p>
      )}
      {review.goalReflections && review.goalReflections.length > 0 && (
        <div className="mt-2 pt-2 border-t border-zinc-100 space-y-1">
          {review.goalReflections.map((g) => (
            <p key={g.goalId} className="text-sm text-zinc-700">
              <span className="text-zinc-500">{g.goalTitle || "目标"}：</span>{g.note}
            </p>
          ))}
        </div>
      )}
    </>
  );
}

export function PeriodReviewPanel({ periodType }: { periodType: PeriodType }) {
  const initialKey = `/api/review/period?type=${periodType}`;
  const [data, setData] = useState<PeriodData | null>(() =>
    peekFetchCache<PeriodData>(initialKey)
  );
  const [loading, setLoading] = useState(() => shouldShowPageLoading([initialKey]));
  const [form, setForm] = useState({ wins: "", improvements: "", nextFocus: "" });
  const [goalNotes, setGoalNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (key?: string | null) => {
    const qs = key ? `type=${periodType}&key=${encodeURIComponent(key)}` : `type=${periodType}`;
    const url = `/api/review/period?${qs}`;
    if (shouldShowPageLoading([url])) setLoading(true);
    setError(null);
    try {
      const d = await fetchJson<PeriodData>(url);
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [periodType]);

  useEffect(() => { load(null); }, [load]);

  const save = async () => {
    if (!data) return;
    setSaving(true);
    const goalReflections = data.activeGoals
      .filter((g) => goalNotes[g.id]?.trim())
      .map((g) => ({ goalId: g.id, note: goalNotes[g.id].trim() }));

    await fetch("/api/review/period", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        periodType,
        periodKey: data.periodKey,
        start: data.start,
        end: data.end,
        ...form,
        goalReflections,
      }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    load(data.periodKey);
  };

  const periodLabel =
    periodType === "month" ? "月" : periodType === "quarter" ? "季" : "年";

  const s = data?.stats;

  return (
    <CachedContent loading={loading} error={error} onRetry={() => load(null)} hasData={!!data}>
    {data && s && (
    <>
      <DateNav
        label={data.periodLabel}
        prevLabel={`上${periodLabel}`}
        nextLabel={`下${periodLabel}`}
        onPrev={() => load(data.prev)}
        onNext={() => load(data.next)}
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {[
          { label: "习惯完成率", value: `${s.habitRate}%`, icon: Repeat, color: "text-emerald-600" },
          { label: "打卡次数", value: `${s.habitCheckIns}/${s.habitExpected || "—"}`, icon: CheckCircle2, color: "text-indigo-600" },
          { label: "项目均进度", value: `${s.avgProgress}%`, icon: BarChart3, color: "text-amber-600" },
          { label: "联系人数", value: `${s.contactedInPeriod}/${s.totalContacts}`, icon: Users, color: "text-pink-600" },
          { label: "发布内容", value: String(s.contentPublished), icon: Megaphone, color: "text-violet-600" },
          { label: "收支结余", value: fmtMoney(s.monthBalance, "CNY", { showSign: true }), icon: Wallet, color: s.monthBalance >= 0 ? "text-emerald-600" : "text-red-500" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-zinc-100 ${color}`}><Icon className="h-4 w-4" /></div>
              <div>
                <p className="text-lg font-bold text-zinc-900">{value}</p>
                <p className="text-[10px] text-zinc-500">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {data.activeGoals.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-amber-500" /> 目标进展反思
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.activeGoals.map((g) => (
              <div key={g.id} className="rounded-xl border border-zinc-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{g.title}</span>
                    <Badge className={GOAL_AREAS[g.area]?.color}>{GOAL_AREAS[g.area]?.label}</Badge>
                  </div>
                  <span className="text-sm text-zinc-500">{g.progress}%</span>
                </div>
                <ProgressBar value={g.progress} />
                <Field className="mt-3">
                  <Label className="text-xs">本{periodLabel}与此目标相关的进展</Label>
                  <Textarea
                    value={goalNotes[g.id] || ""}
                    onChange={(e) => setGoalNotes({ ...goalNotes, [g.id]: e.target.value })}
                    className="min-h-[60px] mt-1"
                  />
                </Field>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader><CardTitle>复盘记录</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Field>
            <Label>本{periodLabel}什么做得好？</Label>
            <Textarea value={form.wins} onChange={(e) => setForm({ ...form, wins: e.target.value })} className="min-h-[80px]" />
          </Field>
          <Field>
            <Label>什么需要改进？</Label>
            <Textarea value={form.improvements} onChange={(e) => setForm({ ...form, improvements: e.target.value })} className="min-h-[80px]" />
          </Field>
          <Field>
            <Label>下{periodLabel}重点</Label>
            <Textarea value={form.nextFocus} onChange={(e) => setForm({ ...form, nextFocus: e.target.value })} className="min-h-[80px]" />
          </Field>
          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={saving}>{saving ? "保存中..." : "保存复盘"}</Button>
            {saved && <span className="text-sm text-emerald-600">已保存 ✓</span>}
          </div>
        </CardContent>
      </Card>

      {data.pastReviews.length > 0 && (
        <Card>
          <CardHeader><CardTitle>历史{periodLabel}复盘</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {data.pastReviews.map((r) => (
              <div key={r.periodKey} className="rounded-lg border border-zinc-100 px-4 py-3">
                <p className="text-xs font-medium text-zinc-500 mb-2">{r.periodKey}</p>
                <ReviewEntry review={r} nextFocusLabel={`下${periodLabel}重点`} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
    )}
    </CachedContent>
  );
}
