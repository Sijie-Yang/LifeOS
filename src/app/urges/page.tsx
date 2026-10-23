"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input, Label, Field } from "@/components/ui/Input";
import {
  CachedContent,
  fetchJson,
  invalidateFetchCache,
  peekFetchCache,
  shouldShowPageLoading,
} from "@/components/ui/PageState";
import { URGE_OUTCOMES, URGES_UPDATED_EVENT } from "@/lib/urges";
import { Waves, Plus, Flame } from "lucide-react";
import { format } from "date-fns";

type UrgesData = {
  weekStart: string;
  categories: Array<{
    id: string;
    name: string;
    color: string;
    isPrivate: boolean;
    goal: string | null;
    surfStreak: number;
    daysSinceLast: number | null;
    weekCount: number;
    weekSurfed: number;
  }>;
  recentEvents: Array<{
    id: string;
    categoryName: string;
    categoryColor: string;
    occurredAt: string;
    intensity: number;
    trigger: string | null;
    outcome: string;
    note: string | null;
  }>;
};

const OUTCOME_LABEL: Record<string, string> = Object.fromEntries(
  URGE_OUTCOMES.map((o) => [o.value, o.label])
);

export default function UrgesPage() {
  const [data, setData] = useState<UrgesData | null>(() =>
    peekFetchCache<UrgesData>("/api/urges?includePrivate=1")
  );
  const [loading, setLoading] = useState(() =>
    shouldShowPageLoading(["/api/urges?includePrivate=1"])
  );
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrivate, setNewPrivate] = useState(false);

  const load = useCallback(async (force = false) => {
    if (force) invalidateFetchCache("/api/urges");
    if (shouldShowPageLoading(["/api/urges?includePrivate=1"])) setLoading(true);
    setError(null);
    try {
      const res = await fetchJson<UrgesData>("/api/urges?includePrivate=1", { force });
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

  useEffect(() => {
    const onUpdated = () => void load(true);
    window.addEventListener(URGES_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(URGES_UPDATED_EVENT, onUpdated);
  }, [load]);

  const addCategory = async () => {
    if (!newName.trim()) return;
    await fetch("/api/urges/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim(), isPrivate: newPrivate }),
    });
    setNewName("");
    setShowAdd(false);
    void load(true);
  };

  return (
    <>
      <PageHeader
        title="冲动管理"
        description="镜子，不是惩罚 — 记录冲动、冲浪 90 秒、看清模式"
        action={
          <Button size="sm" variant="secondary" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="h-4 w-4" />
            新分类
          </Button>
        }
      />
      {showAdd && (
        <Card className="mb-4">
          <CardContent className="pt-4 space-y-3">
            <Field>
              <Label>分类名称</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="如：刷手机" />
            </Field>
            <label className="flex items-center gap-2 text-sm text-zinc-600">
              <input type="checkbox" checked={newPrivate} onChange={(e) => setNewPrivate(e.target.checked)} />
              私密（不在仪表盘显示）
            </label>
            <Button onClick={() => void addCategory()} disabled={!newName.trim()}>
              添加
            </Button>
          </CardContent>
        </Card>
      )}

      <CachedContent loading={loading} error={error} onRetry={() => load(true)} hasData={!!data}>
      {data && (
      <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {data.categories.map((cat) => (
          <Card key={cat.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color }} />
                {cat.name}
                {cat.isPrivate && <Badge className="text-[10px]">私密</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">距上次</span>
                <span className="font-medium">
                  {cat.daysSinceLast != null ? `${cat.daysSinceLast} 天` : "无记录"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500 flex items-center gap-1">
                  <Flame className="h-3.5 w-3.5 text-orange-500" /> 冲浪连续
                </span>
                <span className="font-medium">{cat.surfStreak} 次</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">本周</span>
                <span className="font-medium">
                  {cat.weekSurfed}/{cat.weekCount} 成功
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Waves className="h-5 w-5 text-orange-500" />
            本周记录
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.recentEvents.map((e) => (
            <div
              key={e.id}
              className="flex items-start gap-3 rounded-lg border border-zinc-100 px-3 py-2"
            >
              <span className="h-2 w-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: e.categoryColor }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-zinc-800">{e.categoryName}</span>
                  <Badge
                    className={
                      e.outcome === "gave_in"
                        ? "bg-zinc-100 text-zinc-600"
                        : "bg-emerald-50 text-emerald-700"
                    }
                  >
                    {OUTCOME_LABEL[e.outcome] ?? e.outcome}
                  </Badge>
                  {e.trigger && <Badge className="bg-zinc-50 text-zinc-500">{e.trigger}</Badge>}
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {format(new Date(e.occurredAt), "M/d HH:mm")} · 强度 {e.intensity}
                  {e.note ? ` · ${e.note}` : ""}
                </p>
              </div>
            </div>
          ))}
          {data.recentEvents.length === 0 && (
            <p className="text-sm text-zinc-500 text-center py-6">本周暂无记录。冲动来时点右下角 + 选「冲动来了」。</p>
          )}
        </CardContent>
      </Card>
      </>
      )}
      </CachedContent>
    </>
  );
}
