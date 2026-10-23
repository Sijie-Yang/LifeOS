"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge, EmptyState, ProgressBar } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea, Label, Field } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import {
  GOAL_AREAS,
  GOAL_HORIZONS,
  GOAL_STATUS,
  formatDate,
} from "@/lib/utils";
import { CERTAINTY_LABELS, type GoalCertainty } from "@/lib/goal-certainty";
import {
  CachedContent,
  fetchJson,
  refetchJson,
  invalidateFetchCache,
  peekFetchCache,
  shouldShowPageLoading,
} from "@/components/ui/PageState";
import { useDeepLinkOpen } from "@/lib/useDeepLink";
import { FilterTabs } from "@/components/ui/FilterTabs";
import { Plus, Trash2, Pencil, Check, X, Trophy, Target } from "lucide-react";
import Link from "next/link";

type KeyResult = { id: string; title: string; completed: boolean };
type GoalProject = { id: string; name: string; progress: number; status: string };
type Goal = {
  id: string;
  title: string;
  description: string | null;
  area: string;
  horizon: string;
  status: string;
  progress: number;
  targetDate: string | null;
  keyResults: KeyResult[];
  projects: GoalProject[];
  _count?: { projects?: number };
  certainty: GoalCertainty;
};

type Achievement = {
  id: string;
  code: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  unlockedAt: string | null;
};

const emptyForm = {
  title: "",
  description: "",
  area: "career",
  horizon: "1y",
  status: "ACTIVE",
  targetDate: "",
};

export default function GoalsPage() {
  const router = useRouter();
  const [goals, setGoals] = useState<Goal[]>(() => peekFetchCache<Goal[]>("/api/goals") ?? []);
  const [achievements, setAchievements] = useState<Achievement[]>(
    () => peekFetchCache<{ achievements: Achievement[] }>("/api/achievements")?.achievements ?? []
  );
  const [unlockedCount, setUnlockedCount] = useState(
    () => peekFetchCache<{ unlockedCount: number }>("/api/achievements")?.unlockedCount ?? 0
  );
  const [filter, setFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [newKr, setNewKr] = useState("");
  const [loading, setLoading] = useState(() => shouldShowPageLoading(["/api/goals"]));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (fresh = false) => {
    if (shouldShowPageLoading(["/api/goals"])) setLoading(true);
    setError(null);
    try {
      const goalsData = fresh
        ? await refetchJson<Goal[]>("/api/goals")
        : await fetchJson<Goal[]>("/api/goals");
      setGoals(goalsData);
      const achData = await fetchJson<{ achievements: Achievement[]; unlockedCount: number }>(
        "/api/achievements"
      );
      setAchievements(achData.achievements);
      setUnlockedCount(achData.unlockedCount);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = useCallback(async (g: Goal) => {
    const detail = await refetchJson<Goal>(`/api/goals/${g.id}`);
    setEditing(detail);
    setForm({
      title: detail.title,
      description: detail.description || "",
      area: detail.area,
      horizon: detail.horizon,
      status: detail.status,
      targetDate: detail.targetDate ? detail.targetDate.slice(0, 10) : "",
    });
    setNewKr("");
    setModalOpen(true);
  }, []);

  useDeepLinkOpen(
    useCallback(
      async (id) => {
        const g = goals.find((x) => x.id === id);
        if (g) router.push(`/goals/${g.id}`);
      },
      [goals, router]
    ),
    !loading
  );

  const filtered =
    filter === "all" ? goals : goals.filter((g) => g.area === filter || g.status === filter);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setNewKr("");
    setModalOpen(true);
  };

  const save = async () => {
    const payload = {
      ...form,
      targetDate: form.targetDate || null,
    };
    if (editing) {
      await fetch(`/api/goals/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setModalOpen(false);
    load(true);
  };

  const remove = async (id: string) => {
    if (!confirm("确定删除此目标？")) return;
    await fetch(`/api/goals/${id}`, { method: "DELETE" });
    invalidateFetchCache("/api/goals");
    load(true);
  };

  const addKr = async () => {
    if (!editing || !newKr.trim()) return;
    await fetch(`/api/goals/${editing.id}/key-results`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newKr.trim() }),
    });
    setNewKr("");
    const detail = await refetchJson<Goal>(`/api/goals/${editing.id}`);
    setEditing(detail);
    load(true);
  };

  const deleteKr = async (id: string) => {
    if (!editing) return;
    await fetch(`/api/key-results/${id}`, { method: "DELETE" });
    const detail = await refetchJson<Goal>(`/api/goals/${editing.id}`);
    setEditing(detail);
    load(true);
  };

  const areaTabs = ["all", ...Object.keys(GOAL_AREAS)];

  return (
    <>
      <PageHeader
        title="人生目标"
        description="长期愿景 → 关键结果 → 关联项目，让方向驱动执行"
        action={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> 新建目标
          </Button>
        }
      />
      <CachedContent loading={loading} error={error} onRetry={load} hasData={goals.length > 0}>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              成就系统
              <span className="text-sm font-normal text-zinc-500 ml-auto">
                {unlockedCount}/{achievements.length} 已解锁
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {achievements.map((a) => (
                <div
                  key={a.id}
                  className={`rounded-xl border px-3 py-3 text-center transition-all ${
                    a.unlockedAt
                      ? "border-amber-200 bg-amber-50"
                      : "border-zinc-100 bg-zinc-50 opacity-50 grayscale"
                  }`}
                  title={a.description}
                >
                  <div className="text-2xl mb-1">{a.icon}</div>
                  <p className="text-xs font-medium text-zinc-800">{a.title}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>目标概览</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-500">进行中</span>
              <span className="font-medium">{goals.filter((g) => g.status === "ACTIVE").length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">已完成</span>
              <span className="font-medium">{goals.filter((g) => g.status === "COMPLETED").length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">关联项目</span>
              <span className="font-medium">{goals.reduce((s, g) => s + g.projects.length, 0)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <FilterTabs
        tabs={areaTabs.map((key) => ({
          key,
          label: key === "all" ? "全部" : GOAL_AREAS[key]?.label,
        }))}
        value={filter}
        onChange={setFilter}
        shape="pill"
      />

      {filtered.length === 0 ? (
        goals.length === 0 ? (
          <EmptyState title="还没有人生目标" description="设定你的第一个长期目标，然后关联项目和习惯" />
        ) : (
          <EmptyState title="该领域暂无目标" description="切换筛选或新建目标" />
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((g) => (
            <Card key={g.id} className="cursor-pointer hover:border-zinc-300" onClick={() => router.push(`/goals/${g.id}`)}>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge className={GOAL_AREAS[g.area]?.color}>{GOAL_AREAS[g.area]?.label}</Badge>
                      <Badge className={GOAL_STATUS[g.status]?.color}>{GOAL_STATUS[g.status]?.label}</Badge>
                      <Badge className={CERTAINTY_LABELS[g.certainty.label]?.color}>
                        {g.certainty.label} {g.certainty.score}
                      </Badge>
                      <span className="text-xs text-zinc-400">{GOAL_HORIZONS[g.horizon]}</span>
                    </div>
                    <h3 className="font-semibold text-zinc-900">{g.title}</h3>
                    {g.description && (
                      <p className="text-sm text-zinc-500 mt-1 line-clamp-2">{g.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" onClick={() => router.push(`/goals/${g.id}`)}>
                      <Target className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(g)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(g.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>
                <ProgressBar value={g.progress} />
                <div className="flex items-center justify-between mt-2 text-xs text-zinc-500">
                  <span>{g.progress}% 完成</span>
                  {g.targetDate && <span>目标日 {formatDate(g.targetDate)}</span>}
                </div>
                {g.certainty.gaps.length > 0 && (
                  <p className="mt-2 text-xs text-amber-600">
                    缺口：{g.certainty.gaps.join(" · ")}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {g.keyResults.length > 0 && (
                    <span className="text-zinc-500">
                      KR {g.keyResults.filter((k) => k.completed).length}/{g.keyResults.length}
                    </span>
                  )}
                  {g.projects.length > 0 && (
                    <span className="text-indigo-600">{g.projects.length} 个项目</span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "编辑目标" : "新建目标"} wide>
        <div className="grid grid-cols-2 gap-4">
          <Field className="col-span-2">
            <Label>目标标题 *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field className="col-span-2">
            <Label>描述</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field>
            <Label>领域</Label>
            <Select value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })}>
              {Object.entries(GOAL_AREAS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </Select>
          </Field>
          <Field>
            <Label>时间跨度</Label>
            <Select value={form.horizon} onChange={(e) => setForm({ ...form, horizon: e.target.value })}>
              {Object.entries(GOAL_HORIZONS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </Field>
          <Field>
            <Label>状态</Label>
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {Object.entries(GOAL_STATUS).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </Select>
          </Field>
          <Field>
            <Label>目标日期</Label>
            <Input type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} />
          </Field>
        </div>

        {editing && (
          <>
            <div className="mt-6 pt-6 border-t border-zinc-100">
              <Label>关键结果 (KR)</Label>
              <p className="text-xs text-zinc-500 mb-2">在作战室关联项目，全部完成时自动勾选</p>
              <div className="space-y-2 my-3">
                {editing.keyResults?.map((kr) => (
                  <div key={kr.id} className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2">
                    <div
                      className={`flex-shrink-0 h-5 w-5 rounded border flex items-center justify-center ${
                        kr.completed ? "bg-emerald-500 border-emerald-500 text-white" : "border-zinc-300"
                      }`}
                    >
                      {kr.completed && <Check className="h-3 w-3" />}
                    </div>
                    <span className={`flex-1 text-sm ${kr.completed ? "text-zinc-500" : "text-zinc-800"}`}>
                      {kr.title}
                    </span>
                    <button onClick={() => deleteKr(kr.id)} className="text-zinc-400 hover:text-red-500">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newKr}
                  onChange={(e) => setNewKr(e.target.value)}
                  placeholder="新关键结果..."
                  onKeyDown={(e) => e.key === "Enter" && addKr()}
                />
                <Button variant="secondary" onClick={addKr} disabled={!newKr.trim()}>添加</Button>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-zinc-100">
              <Label>关联项目</Label>
              <p className="text-xs text-zinc-500 mb-2">在项目编辑页选择关联目标</p>
              <div className="flex flex-wrap gap-2">
                {editing.projects?.length > 0 ? (
                  editing.projects.map((p) => (
                    <Link key={p.id} href="/projects">
                      <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-200">
                        {p.name} ({p.progress}%)
                      </Badge>
                    </Link>
                  ))
                ) : (
                  <span className="text-sm text-zinc-400">暂无 — 前往项目管理关联</span>
                )}
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>取消</Button>
          <Button onClick={save} disabled={!form.title}>保存</Button>
        </div>
      </Modal>
      </CachedContent>
    </>
  );
}
