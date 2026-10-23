"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Input, Label, Field, Select, Textarea } from "@/components/ui/Input";
import { MarkdownEditor } from "@/components/ui/MarkdownEditor";
import {
  CachedContent,
  fetchJson,
  invalidateFetchCache,
  peekFetchCache,
  shouldShowPageLoading,
} from "@/components/ui/PageState";
import {
  RECIPE_SCENES,
  RECIPE_SCENE_COLORS,
  RECIPE_SCENE_LABELS,
  WEEKDAY_LABELS,
  type RecipeDto,
  type RecipeScene,
} from "@/lib/cooking";
import { cn, formatDateTime } from "@/lib/utils";
import {
  BookOpen,
  CalendarDays,
  ChefHat,
  ListTodo,
  Pin,
  Plus,
  Trash2,
} from "lucide-react";

type TabKey = "all" | "rotation" | "learn";

const emptyForm = {
  title: "",
  scene: "weekday" as RecipeScene,
  durationMinutes: "",
  servings: "1",
  difficulty: "1",
  ingredients: "",
  steps: "",
  review: "",
  inRotation: false,
  rotationDay: "",
  wantToLearn: false,
  pinned: false,
};

export default function CookingPage() {
  const [recipes, setRecipes] = useState<RecipeDto[]>(
    () => peekFetchCache<RecipeDto[]>("/api/cooking") ?? []
  );
  const [loading, setLoading] = useState(() => shouldShowPageLoading(["/api/cooking"]));
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RecipeDto | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    if (force) invalidateFetchCache("/api/cooking");
    if (shouldShowPageLoading(["/api/cooking"])) setLoading(true);
    setError(null);
    try {
      const data = await fetchJson<RecipeDto[]>("/api/cooking", { force });
      setRecipes(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (tab === "rotation") return recipes.filter((r) => r.inRotation);
    if (tab === "learn") return recipes.filter((r) => r.wantToLearn);
    return recipes.filter((r) => !r.wantToLearn);
  }, [recipes, tab]);

  const active =
    filtered.find((r) => r.id === activeId) ??
    recipes.find((r) => r.id === activeId) ??
    filtered[0] ??
    null;

  useEffect(() => {
    if (active && activeId !== active.id) setActiveId(active.id);
  }, [active, activeId]);

  const rotationByDay = useMemo(() => {
    const map = new Map<number, RecipeDto[]>();
    for (let d = 1; d <= 7; d++) map.set(d, []);
    for (const r of recipes.filter((x) => x.inRotation)) {
      const day = r.rotationDay && r.rotationDay >= 1 && r.rotationDay <= 7 ? r.rotationDay : 0;
      if (day === 0) continue;
      map.get(day)!.push(r);
    }
    return map;
  }, [recipes]);

  const openCreate = (opts?: Partial<typeof emptyForm>) => {
    setEditing(null);
    setForm({ ...emptyForm, ...opts });
    setModalOpen(true);
  };

  const openEdit = (r: RecipeDto) => {
    setEditing(r);
    setForm({
      title: r.title,
      scene: (RECIPE_SCENES.includes(r.scene as RecipeScene) ? r.scene : "other") as RecipeScene,
      durationMinutes: r.durationMinutes?.toString() ?? "",
      servings: r.servings?.toString() ?? "",
      difficulty: String(r.difficulty || 1),
      ingredients: r.ingredients,
      steps: r.steps,
      review: r.review,
      inRotation: r.inRotation,
      rotationDay: r.rotationDay?.toString() ?? "",
      wantToLearn: r.wantToLearn,
      pinned: r.pinned,
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) {
      alert("请填写菜名");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        scene: form.scene,
        durationMinutes: form.durationMinutes || null,
        servings: form.servings || null,
        difficulty: +form.difficulty || 1,
        ingredients: form.ingredients,
        steps: form.steps,
        review: form.review,
        inRotation: form.inRotation,
        rotationDay: form.rotationDay || null,
        wantToLearn: form.wantToLearn,
        pinned: form.pinned,
      };
      if (editing) {
        await fetch(`/api/cooking/${editing.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        const res = await fetch("/api/cooking", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const created = (await res.json()) as RecipeDto;
          setActiveId(created.id);
        }
      }
      setModalOpen(false);
      await load(true);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("删除这道菜？")) return;
    await fetch(`/api/cooking/${id}`, { method: "DELETE" });
    if (activeId === id) setActiveId(null);
    await load(true);
  };

  return (
    <>
      <PageHeader
        title="厨艺菜单"
        description="菜单与做法 — 长期能力库；每日「做饭」习惯只负责打卡"
        action={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => openCreate()}>
              <Plus className="h-4 w-4" /> 新菜
            </Button>
          </div>
        }
      />
      <CachedContent loading={loading} error={error} onRetry={() => load(true)} hasData={recipes.length > 0}>

      <div className="flex flex-wrap gap-2 mb-4">
        {(
          [
            ["all", "已会菜谱", BookOpen],
            ["rotation", "每周轮换", CalendarDays],
            ["learn", "想学队列", ListTodo],
          ] as const
        ).map(([key, label, Icon]) => (
          <Button
            key={key}
            variant={tab === key ? "primary" : "secondary"}
            size="sm"
            onClick={() => setTab(key)}
          >
            <Icon className="h-4 w-4" /> {label}
            <span className="opacity-70 ml-1">
              {key === "all"
                ? recipes.filter((r) => !r.wantToLearn).length
                : key === "rotation"
                  ? recipes.filter((r) => r.inRotation).length
                  : recipes.filter((r) => r.wantToLearn).length}
            </span>
          </Button>
        ))}
      </div>

      {tab === "rotation" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-6">
          {WEEKDAY_LABELS.map((label, i) => {
            const day = i + 1;
            const items = rotationByDay.get(day) ?? [];
            return (
              <Card key={day} className="border-zinc-200/80">
                <CardContent className="pt-3 pb-3 px-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                    周{label}
                  </p>
                  {items.length === 0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        openCreate({ inRotation: true, rotationDay: String(day), wantToLearn: false })
                      }
                      className="text-xs text-zinc-400 hover:text-amber-700 w-full text-left"
                    >
                      + 安排
                    </button>
                  ) : (
                    <ul className="space-y-1.5">
                      {items.map((r) => (
                        <li key={r.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setTab("all");
                              setActiveId(r.id);
                            }}
                            className="text-sm font-medium text-zinc-800 hover:text-amber-800 text-left leading-snug"
                          >
                            {r.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4 min-h-[480px] border border-zinc-200 rounded-2xl overflow-hidden bg-white shadow-sm">
        <div className="w-full lg:w-[280px] shrink-0 border-b lg:border-b-0 lg:border-r border-zinc-100 flex flex-col max-h-[320px] lg:max-h-none">
          <div className="px-3 py-2.5 border-b border-zinc-100 text-xs font-semibold text-zinc-500 flex items-center gap-2">
            <ChefHat className="h-3.5 w-3.5" />
            {filtered.length} 道
            {tab === "learn" && (
              <button
                type="button"
                className="ml-auto text-amber-700 hover:underline"
                onClick={() => openCreate({ wantToLearn: true })}
              >
                + 想学
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-sm text-zinc-400 p-6 text-center">
                {tab === "learn" ? "还没有想学的菜" : tab === "rotation" ? "还没有轮换菜" : "还没有菜谱"}
                <br />
                <button
                  type="button"
                  className="mt-2 text-amber-700 hover:underline"
                  onClick={() =>
                    openCreate(
                      tab === "learn"
                        ? { wantToLearn: true }
                        : tab === "rotation"
                          ? { inRotation: true }
                          : undefined
                    )
                  }
                >
                  添加第一道 →
                </button>
              </p>
            ) : (
              filtered.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setActiveId(r.id)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 border-b border-zinc-50 hover:bg-zinc-50 transition-colors",
                    active?.id === r.id && "bg-amber-50/80 border-l-2 border-l-amber-500"
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    {r.pinned && <Pin className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />}
                    <span
                      className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded font-medium",
                        RECIPE_SCENE_COLORS[r.scene as RecipeScene] ?? RECIPE_SCENE_COLORS.other
                      )}
                    >
                      {RECIPE_SCENE_LABELS[r.scene as RecipeScene] ?? r.scene}
                    </span>
                    {r.inRotation && (
                      <span className="text-[10px] text-emerald-700">
                        轮·{r.rotationDay ? `周${WEEKDAY_LABELS[r.rotationDay - 1]}` : "?"}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-zinc-900 truncate">{r.title}</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    {"★".repeat(r.difficulty)}
                    {"☆".repeat(Math.max(0, 3 - r.difficulty))}
                    {r.durationMinutes != null ? ` · ${r.durationMinutes} min` : ""}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col min-h-[360px]">
          {!active ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-zinc-400 p-8">
              <ChefHat className="h-10 w-10 opacity-40" />
              <p className="text-sm">选一道菜，或新建菜单</p>
              <Button size="sm" variant="secondary" onClick={() => openCreate()}>
                <Plus className="h-4 w-4" /> 新菜
              </Button>
            </div>
          ) : (
            <>
              <div className="flex-shrink-0 px-4 py-3 border-b border-zinc-100 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold text-zinc-900">{active.title}</h2>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <Badge
                        className={
                          RECIPE_SCENE_COLORS[active.scene as RecipeScene] ?? RECIPE_SCENE_COLORS.other
                        }
                      >
                        {RECIPE_SCENE_LABELS[active.scene as RecipeScene] ?? active.scene}
                      </Badge>
                      <Badge className="bg-zinc-100 text-zinc-600">
                        {"★".repeat(active.difficulty)}
                        {"☆".repeat(Math.max(0, 3 - active.difficulty))}
                      </Badge>
                      {active.durationMinutes != null && (
                        <Badge className="bg-zinc-100 text-zinc-600">{active.durationMinutes} min</Badge>
                      )}
                      {active.servings != null && (
                        <Badge className="bg-zinc-100 text-zinc-600">{active.servings} 人份</Badge>
                      )}
                      {active.inRotation && (
                        <Badge className="bg-emerald-100 text-emerald-800">
                          每周轮换
                          {active.rotationDay
                            ? ` · 周${WEEKDAY_LABELS[active.rotationDay - 1]}`
                            : ""}
                        </Badge>
                      )}
                      {active.wantToLearn && (
                        <Badge className="bg-amber-100 text-amber-900">想学</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => openEdit(active)}>
                      编辑
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600"
                      onClick={() => void remove(active.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-[11px] text-zinc-400">
                  更新于 {formatDateTime(active.updatedAt)}
                </p>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-5">
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                    食材
                  </h3>
                  <div className="markdown-preview text-sm text-zinc-700">
                    {active.ingredients.trim() ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{active.ingredients}</ReactMarkdown>
                    ) : (
                      <p className="text-zinc-400 italic">尚未填写</p>
                    )}
                  </div>
                </section>
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                    做法
                  </h3>
                  <div className="markdown-preview text-sm text-zinc-700">
                    {active.steps.trim() ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{active.steps}</ReactMarkdown>
                    ) : (
                      <p className="text-zinc-400 italic">尚未填写</p>
                    )}
                  </div>
                </section>
                {active.review.trim() && (
                  <section>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                      复盘
                    </h3>
                    <div className="markdown-preview text-sm text-zinc-700">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{active.review}</ReactMarkdown>
                    </div>
                  </section>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "编辑菜谱" : "新菜"}
        wide
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <Field>
            <Label>菜名</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="例如：番茄炒蛋"
            />
          </Field>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field>
              <Label>场景</Label>
              <Select
                value={form.scene}
                onChange={(e) => setForm({ ...form, scene: e.target.value as RecipeScene })}
              >
                {RECIPE_SCENES.map((s) => (
                  <option key={s} value={s}>
                    {RECIPE_SCENE_LABELS[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field>
              <Label>时长 (min)</Label>
              <Input
                type="number"
                value={form.durationMinutes}
                onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
              />
            </Field>
            <Field>
              <Label>人数</Label>
              <Input
                type="number"
                value={form.servings}
                onChange={(e) => setForm({ ...form, servings: e.target.value })}
              />
            </Field>
            <Field>
              <Label>难度</Label>
              <Select
                value={form.difficulty}
                onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
              >
                <option value="1">★☆☆</option>
                <option value="2">★★☆</option>
                <option value="3">★★★</option>
              </Select>
            </Field>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.inRotation}
                onChange={(e) => setForm({ ...form, inRotation: e.target.checked })}
              />
              进入每周轮换
            </label>
            {form.inRotation && (
              <Field className="min-w-[120px]">
                <Label>轮换日</Label>
                <Select
                  value={form.rotationDay}
                  onChange={(e) => setForm({ ...form, rotationDay: e.target.value })}
                >
                  <option value="">未指定</option>
                  {WEEKDAY_LABELS.map((label, i) => (
                    <option key={label} value={String(i + 1)}>
                      周{label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.wantToLearn}
                onChange={(e) => setForm({ ...form, wantToLearn: e.target.checked })}
              />
              想学（尚未会）
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
              />
              置顶
            </label>
          </div>
          <Field>
            <Label>食材</Label>
            <Textarea
              value={form.ingredients}
              onChange={(e) => setForm({ ...form, ingredients: e.target.value })}
              rows={4}
              placeholder={"- 鸡蛋 2 个\n- 番茄 2 个"}
              className="font-mono text-sm"
            />
          </Field>
          <div>
            <MarkdownEditor
              label="做法"
              value={form.steps}
              onChange={(steps) => setForm({ ...form, steps })}
              placeholder="步骤用 Markdown 写…"
              minHeight={220}
              showToc={false}
            />
          </div>
          <Field>
            <Label>复盘</Label>
            <Textarea
              value={form.review}
              onChange={(e) => setForm({ ...form, review: e.target.value })}
              rows={2}
              placeholder="好吃吗？下次改什么？"
            />
          </Field>
          <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void save()} disabled={saving || !form.title.trim()}>
              {saving ? "保存中…" : "保存"}
            </Button>
          </div>
        </div>
      </Modal>
      </CachedContent>
    </>
  );
}
