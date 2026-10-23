"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { IronLawsBanner } from "@/components/layout/IronLawsBanner";
import { ReadingSubNav } from "@/components/reading/ReadingSubNav";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  CachedContent,
  fetchJson,
  peekFetchCache,
  shouldShowPageLoading,
} from "@/components/ui/PageState";
import {
  READING_PROJECT_MATCH,
  readingFocusKindLabel,
  readingFocusKindClass,
  type ReadingFocusItem,
  type ReadingPayload,
} from "@/lib/reading";
import { cn } from "@/lib/utils";
import { ExternalLink, Flame, ListOrdered } from "lucide-react";
import { UI_COPY } from "@/lib/ui-copy";

function priorityLabel(p: string) {
  if (p === "HIGH") return "高优";
  if (p === "LOW") return "低优";
  return "中优";
}

export default function ReadingFocusPage() {
  const router = useRouter();
  const [data, setData] = useState<ReadingPayload | null>(() =>
    peekFetchCache<ReadingPayload>("/api/reading")
  );
  const [loading, setLoading] = useState(() => shouldShowPageLoading(["/api/reading"]));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    if (shouldShowPageLoading(["/api/reading"])) setLoading(true);
    setError(null);
    try {
      const res = await fetchJson<ReadingPayload>("/api/reading", { force });
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

  const focus = data?.focus ?? [];
  const projects = data?.projects ?? [];

  const openNotes = (item: ReadingFocusItem) => {
    const params = new URLSearchParams();
    params.set("project", item.projectKey);
    if (item.readingTag) params.set("tag", item.readingTag);
    if (item.noteId) params.set("note", item.noteId);
    router.push(`/reading/notes?${params.toString()}`);
  };

  return (
    <>
      <PageHeader
        title="信息阅读"
        description={UI_COPY.reading.description}
        action={
          <Button size="sm" variant="secondary" onClick={() => router.push("/reading/notes")}>
            打开笔记 Inbox
          </Button>
        }
      />

      <CachedContent loading={loading} error={error} onRetry={() => load(true)} hasData={!!data}>
      <ReadingSubNav />
      <IronLawsBanner compact />

      <Card className="mb-6 border-amber-100 bg-gradient-to-br from-amber-50/50 to-white">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <ListOrdered className="h-4 w-4 text-amber-700" />
            <p className="text-sm font-semibold text-zinc-900">当前关注 · 按优先级</p>
            <span className="text-[11px] text-zinc-400">
              来自阅读计划步骤 · 深读书铁律优先
            </span>
          </div>

          {focus.length === 0 ? (
            <p className="text-sm text-zinc-400 py-6 text-center">
              暂无未完成阅读步骤 — 去项目计划里补书 / 领域 / 信息源
            </p>
          ) : (
            <ol className="space-y-2">
              {focus.map((item, idx) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => openNotes(item)}
                    className={cn(
                      "w-full text-left rounded-xl border px-3 py-2.5 transition-all flex gap-3 items-start",
                      item.isNow
                        ? "border-amber-300 bg-amber-50/90 ring-1 ring-amber-200"
                        : "border-zinc-200 bg-white hover:border-zinc-300"
                    )}
                  >
                    <span
                      className={cn(
                        "shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold",
                        item.isNow ? "bg-amber-500 text-white" : "bg-zinc-100 text-zinc-500"
                      )}
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                        {item.isNow && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-800">
                            <Flame className="h-3 w-3" /> 正在读
                          </span>
                        )}
                        <span
                          className={cn(
                            "text-[10px] px-1.5 py-0 rounded font-medium",
                            readingFocusKindClass(item.kind)
                          )}
                        >
                          {readingFocusKindLabel(item.kind)}
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          {READING_PROJECT_MATCH[item.projectKey].shortLabel}
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          {priorityLabel(item.projectPriority)}
                        </span>
                        {item.openSteps > 1 && (
                          <span className="text-[10px] text-zinc-400">余 {item.openSteps} 步</span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-zinc-900 truncate">{item.title}</p>
                      <p className="text-[12px] text-zinc-500 truncate mt-0.5">
                        下一步 · {item.subtitle}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {projects.map((p) => (
          <Card key={p.id} className="border-zinc-200/80">
            <CardContent className="pt-4 pb-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Project
              </p>
              <p className="text-sm font-medium text-zinc-900 mt-0.5 truncate">{p.name}</p>
              <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
                <span>{p.noteCount} 条笔记</span>
                <span>·</span>
                <span>{p.progress}%</span>
                <Link
                  href={`/projects?id=${p.id}`}
                  className="ml-auto text-indigo-600 hover:underline flex items-center gap-0.5"
                >
                  项目 <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      </CachedContent>
    </>
  );
}
