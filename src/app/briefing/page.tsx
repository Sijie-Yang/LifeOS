"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  CachedContent,
  fetchJson,
  peekFetchCache,
  shouldShowPageLoading,
} from "@/components/ui/PageState";
import { toDateString } from "@/lib/utils";
import { Calendar, CheckCircle2, Circle, Star, Target } from "lucide-react";

type BriefingData = {
  date: string;
  intention: string | null;
  priorities: Array<{ id: string; title: string; completed: boolean }>;
  mustDoCount: number;
  habitsTotal: number;
  habitsDone: number;
  uncheckedHabits: string[];
  tasks: Array<{ id: string; title: string; priority: string }>;
  meetings: Array<{ id: string; title: string; meetingTime: string | null; attendees: string[] }>;
  schedule: Array<{ title: string; startTime: string; endTime: string }>;
  closed: boolean;
  hasWellness: boolean;
};

const briefingKey = () => `/api/briefing?date=${toDateString()}`;

export default function BriefingPage() {
  const [data, setData] = useState<BriefingData | null>(() =>
    peekFetchCache<BriefingData>(briefingKey())
  );
  const [loading, setLoading] = useState(() => shouldShowPageLoading([briefingKey()]));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const key = briefingKey();
    if (shouldShowPageLoading([key])) setLoading(true);
    setError(null);
    try {
      const res = await fetchJson<BriefingData>(key);
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <PageHeader
        title="每日简报"
        description={data ? `${data.date} — 今日安排与收尾提醒` : "今日安排与收尾提醒"}
        action={
          <Link href="/daily">
            <Button size="sm">进入日计划</Button>
          </Link>
        }
      />
      <CachedContent loading={loading} error={error} onRetry={load} hasData={!!data}>
      {data && (
      <>
      {data.intention && (
        <Card className="mb-4 border-indigo-100 bg-indigo-50/40">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-indigo-600 font-medium mb-1">本周意图</p>
            <p className="text-sm text-zinc-800">{data.intention}</p>
          </CardContent>
        </Card>
      )}

      {data.priorities.length > 0 && (
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-indigo-500" />
              本周优先级
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.priorities.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <Circle className="h-4 w-4 text-zinc-300 shrink-0" />
                <span>{p.title}</span>
              </div>
            ))}
            <Link href="/review" className="text-xs text-indigo-600 inline-block mt-1">
              周复盘 + 周计划 →
            </Link>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" />
              今日必做
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-zinc-900">{data.mustDoCount}</p>
            <p className="text-xs text-zinc-500 mt-1">项已设定</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              习惯打卡
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-zinc-900">
              {data.habitsDone}/{data.habitsTotal}
            </p>
            {data.uncheckedHabits.length > 0 && (
              <p className="text-xs text-zinc-500 mt-1 truncate">
                待完成：{data.uncheckedHabits.join("、")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">今日任务</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.tasks.map((t) => (
              <Link key={t.id} href="/tasks" className="block text-sm text-zinc-700 hover:text-indigo-600">
                {t.title}
              </Link>
            ))}
            {data.tasks.length === 0 && <p className="text-sm text-zinc-500">暂无任务</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" /> 会议 & 日程
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.meetings.map((m) => (
              <div key={m.id} className="text-sm">
                <p className="font-medium text-zinc-800">{m.title}</p>
                <p className="text-xs text-zinc-500">
                  {m.meetingTime || "全天"} · {m.attendees.join("、")}
                </p>
              </div>
            ))}
            {data.schedule.map((s, i) => (
              <div key={i} className="text-sm text-zinc-600">
                {s.startTime}–{s.endTime} {s.title}
              </div>
            ))}
            {data.meetings.length === 0 && data.schedule.length === 0 && (
              <p className="text-sm text-zinc-500">今日无固定安排</p>
            )}
          </CardContent>
        </Card>
      </div>

      {data && (!data.hasWellness || data.uncheckedHabits.length > 0) && (
        <Card className="mb-4">
          <CardContent className="pt-4 flex flex-wrap items-center gap-3">
            {!data.hasWellness && (
              <Badge className="bg-violet-100 text-violet-700">状态未记录（可选）</Badge>
            )}
            {data.uncheckedHabits.length > 0 && (
              <Badge className="bg-amber-100 text-amber-700">
                {data.uncheckedHabits.length} 个习惯未打卡
              </Badge>
            )}
            <Link href="/daily" className="text-sm text-indigo-600 ml-auto">
              日计划 →
            </Link>
          </CardContent>
        </Card>
      )}
      </>
      )}
      </CachedContent>
    </>
  );
}
