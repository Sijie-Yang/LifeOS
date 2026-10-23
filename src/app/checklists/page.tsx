"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge, ProgressBar } from "@/components/ui/Badge";
import { Input, Label, Field } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import {
  CachedContent,
  PageSkeleton,
  fetchJson,
  invalidateFetchCache,
  peekFetchCache,
  shouldShowPageLoading,
} from "@/components/ui/PageState";
import {
  CHECKLIST_CATEGORIES,
  checklistCategoryMeta,
  type ChecklistCategory,
  type ChecklistRunItem,
} from "@/lib/checklists";
import { cn, formatDateTime } from "@/lib/utils";
import { ArrowLeft, CheckSquare, Circle, ListChecks, Plus, Trash2 } from "lucide-react";
import { UI_COPY } from "@/lib/ui-copy";

type TemplateDto = {
  id: string;
  category: string;
  title: string;
  description: string | null;
  color: string;
  itemCount: number;
  runCount: number;
  activeRunCount: number;
};

type CategoryDto = {
  id: ChecklistCategory;
  label: string;
  description: string;
  color: string;
  templateId: string | null;
  templateCount: number;
  runCount: number;
  activeRunCount: number;
};

type RunDto = {
  id: string;
  title: string;
  status: string;
  items: ChecklistRunItem[];
  progress: { done: number; total: number; pct: number };
  createdAt: string;
  template: { id: string; title: string; category: string; color: string };
};

type ListPayload = {
  categories: CategoryDto[];
  templates: TemplateDto[];
  runs: RunDto[];
};

export default function ChecklistsPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="SOP" description="一类目一份清单 · 每次开一份，历史都在类目里" />
          <PageSkeleton />
        </>
      }
    >
      <ChecklistsInner />
    </Suspense>
  );
}

function ChecklistsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const category = searchParams.get("category") as ChecklistCategory | null;
  const runId = searchParams.get("run");

  const listKey = category ? `/api/checklists?category=${category}` : "/api/checklists";
  const [data, setData] = useState<ListPayload | null>(() => peekFetchCache<ListPayload>(listKey));
  const [activeRun, setActiveRun] = useState<RunDto | null>(null);
  const [loading, setLoading] = useState(() => shouldShowPageLoading([listKey]));
  const [error, setError] = useState<string | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  const [startTitle, setStartTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const templateForCategory = useMemo(() => {
    if (!data || !category) return null;
    return data.templates.find((t) => t.category === category) ?? null;
  }, [data, category]);

  const setQuery = useCallback(
    (next: { category?: string | null; run?: string | null }) => {
      const p = new URLSearchParams();
      const c = next.category === undefined ? category : next.category;
      const r = next.run === undefined ? runId : next.run;
      if (c) p.set("category", c);
      if (r) p.set("run", r);
      const qs = p.toString();
      router.replace(qs ? `/checklists?${qs}` : "/checklists");
    },
    [router, category, runId]
  );

  const load = useCallback(
    async (force = false) => {
      const url = category
        ? `/api/checklists?category=${category}`
        : "/api/checklists";
      if (force) invalidateFetchCache(url);
      if (shouldShowPageLoading([url])) setLoading(true);
      setError(null);
      try {
        const res = await fetchJson<ListPayload>(url, { force });
        setData(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        setLoading(false);
      }
    },
    [category]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!runId) {
      setActiveRun(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const run = await fetchJson<RunDto>(`/api/checklists/${runId}`, { force: true });
        if (!cancelled) setActiveRun(run);
      } catch {
        if (!cancelled) setActiveRun(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runId]);

  const startRun = async () => {
    const templateId = templateForCategory?.id;
    if (!templateId || !category) return;
    setBusy(true);
    try {
      const res = await fetch("/api/checklists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          templateId,
          title: startTitle.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error("创建失败");
      const run = (await res.json()) as RunDto;
      setStartOpen(false);
      setStartTitle("");
      setQuery({ run: run.id, category });
      await load(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : "失败");
    } finally {
      setBusy(false);
    }
  };

  const toggleItem = async (itemId: string, done: boolean) => {
    if (!activeRun) return;
    const res = await fetch(`/api/checklists/${activeRun.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, done }),
    });
    if (!res.ok) return;
    setActiveRun((await res.json()) as RunDto);
    void load(true);
  };

  const deleteRun = async (id: string) => {
    if (!confirm("删除这次清单？")) return;
    await fetch(`/api/checklists/${id}`, { method: "DELETE" });
    if (runId === id) setQuery({ run: null });
    void load(true);
  };

  const categories =
    data?.categories?.length
      ? data.categories
      : CHECKLIST_CATEGORIES.map((c) => ({
          ...c,
          templateId: null,
          templateCount: 0,
          runCount: 0,
          activeRunCount: 0,
        }));

  if (activeRun) {
    const groups = groupItems(activeRun.items);
    return (
      <>
        <PageHeader
          title={activeRun.title}
          description={`${checklistCategoryMeta(activeRun.template.category).label} · ${activeRun.progress.done}/${activeRun.progress.total}`}
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setQuery({
                  run: null,
                  category: activeRun.template.category as ChecklistCategory,
                })
              }
            >
              <ArrowLeft className="h-4 w-4" /> 历史
            </Button>
          }
        />
        <CachedContent loading={false} error={error} onRetry={() => load(true)} hasData>
        <Card className="mb-4">
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Badge
                className={
                  activeRun.status === "done"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-800"
                }
              >
                {activeRun.status === "done" ? "已完成" : "进行中"}
              </Badge>
              <span className="text-xs text-zinc-400">{formatDateTime(activeRun.createdAt)}</span>
            </div>
            <ProgressBar value={activeRun.progress.pct} />
          </CardContent>
        </Card>
        <div className="space-y-4">
          {groups.map(([group, items]) => (
            <Card key={group}>
              <CardContent className="pt-4 pb-3">
                {group !== "_" && (
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                    {group}
                  </p>
                )}
                <ul className="space-y-1">
                  {items.map((it) => (
                    <li key={it.id}>
                      <button
                        type="button"
                        onClick={() => void toggleItem(it.id, !it.done)}
                        className={cn(
                          "w-full flex items-start gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-zinc-50",
                          it.done && "opacity-60"
                        )}
                      >
                        {it.done ? (
                          <CheckSquare className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                        ) : (
                          <Circle className="h-4 w-4 text-zinc-300 mt-0.5 shrink-0" />
                        )}
                        <span
                          className={cn(
                            "text-sm text-zinc-800",
                            it.done && "line-through text-zinc-500"
                          )}
                        >
                          {it.text}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
        </CachedContent>
      </>
    );
  }

  if (category) {
    const meta = checklistCategoryMeta(category);
    const t = templateForCategory;
    const runs = data?.runs ?? [];

    return (
      <>
        <PageHeader
          title={meta.label}
          description={t?.description || meta.description}
          action={
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setQuery({ category: null, run: null })}
              >
                <ArrowLeft className="h-4 w-4" /> 全部类目
              </Button>
              <Button
                size="sm"
                disabled={!t}
                onClick={() => {
                  setStartTitle("");
                  setStartOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> 开一份新的
              </Button>
            </div>
          }
        />
        <CachedContent loading={loading} error={error} onRetry={() => load(true)} hasData={!!data}>
        <p className="text-xs text-zinc-500 mb-4">
          {t
            ? `共 ${t.runCount} 份历史 · 进行中 ${t.activeRunCount}`
            : "尚未创建模板"}
        </p>
        {runs.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-zinc-400">
              还没有历史。点「开一份新的」开始第一次。
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {runs.map((r) => (
              <li key={r.id}>
                <div className="flex gap-2 items-stretch">
                  <button
                    type="button"
                    onClick={() => setQuery({ run: r.id, category })}
                    className="flex-1 text-left rounded-xl border border-zinc-200 bg-white px-4 py-3 hover:border-zinc-300"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-zinc-900 truncate">{r.title}</p>
                      <Badge
                        className={
                          r.status === "done"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-800"
                        }
                      >
                        {r.status === "done" ? "完成" : "进行中"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-500">
                      <span>
                        {r.progress.done}/{r.progress.total}
                      </span>
                      <span>{formatDateTime(r.createdAt)}</span>
                    </div>
                    <div className="mt-2">
                      <ProgressBar value={r.progress.pct} />
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteRun(r.id)}
                    className="px-3 rounded-xl border border-zinc-200 text-zinc-400 hover:text-red-500 hover:border-red-200"
                    title="删除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Modal open={startOpen} onClose={() => setStartOpen(false)} title={`新开 · ${meta.label}`}>
          <Field>
            <Label>本次标题（可选）</Label>
            <Input
              value={startTitle}
              onChange={(e) => setStartTitle(e.target.value)}
              placeholder={UI_COPY.checklists.scenePlaceholder}
              autoFocus
            />
          </Field>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="secondary" onClick={() => setStartOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void startRun()} disabled={busy || !t}>
              {busy ? "创建中…" : "开始打勾"}
            </Button>
          </div>
        </Modal>
        </CachedContent>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="SOP"
        description="一类目一份清单 · 每次开一份，历史都在类目里"
      />
      <CachedContent loading={loading} error={error} onRetry={() => load(true)} hasData={!!data}>
      <div className="grid gap-3 sm:grid-cols-2">
        {categories
          .filter((c) => c.id !== "other" || c.templateCount > 0)
          .map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setQuery({ category: c.id })}
              className="text-left rounded-2xl border border-zinc-200 bg-white p-5 hover:border-zinc-300 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <ListChecks className="h-4 w-4" style={{ color: c.color }} />
                <p className="text-base font-semibold text-zinc-900">{c.label}</p>
              </div>
              <p className="text-xs text-zinc-500 mb-3">{c.description}</p>
              <p className="text-xs text-zinc-400">
                累计 {c.runCount} 份
                {c.activeRunCount > 0 ? ` · ${c.activeRunCount} 进行中` : ""}
              </p>
            </button>
          ))}
      </div>
      </CachedContent>
    </>
  );
}

function groupItems(items: ChecklistRunItem[]): Array<[string, ChecklistRunItem[]]> {
  const map = new Map<string, ChecklistRunItem[]>();
  for (const it of items) {
    const g = it.group || "_";
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(it);
  }
  return [...map.entries()];
}
