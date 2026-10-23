"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProjectLoopSopPanel } from "@/components/loop/ProjectLoopSopPanel";
import { ProjectLoopCharts } from "@/components/loop/ProjectLoopCharts";
import { ProjectLoopDetailModal } from "@/components/loop/ProjectLoopDetailModal";
import {
  CachedContent,
  fetchJson,
  peekFetchCache,
  shouldShowPageLoading,
} from "@/components/ui/PageState";
import type { ProjectLoopResult, ProjectLoopStat } from "@/lib/project-loop";
import { Button } from "@/components/ui/Button";
import { RefreshCw } from "lucide-react";

const LOOP_KEY = "/api/projects/loop";

export default function ProjectLoopPage() {
  const [data, setData] = useState<ProjectLoopResult | null>(() =>
    peekFetchCache<ProjectLoopResult>(LOOP_KEY)
  );
  const [loading, setLoading] = useState(() => shouldShowPageLoading([LOOP_KEY]));
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ProjectLoopStat | null>(null);

  const load = useCallback(async () => {
    if (shouldShowPageLoading([LOOP_KEY])) setLoading(true);
    setError(null);
    try {
      const json = await fetchJson<ProjectLoopResult>(LOOP_KEY);
      setData(json);
      setSelected((prev) => {
        if (!prev) return null;
        return json.stats.find((s) => s.projectId === prev.projectId) ?? null;
      });
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
        title="项目闭环"
        description={
          data
            ? `截至 ${data.asOf} · 按类别色看生活块状况 · 点击项目看上次闭环与反馈/修正`
            : "按类别色看生活块状况 · 点击项目看上次闭环与反馈/修正"
        }
        action={
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-3.5 w-3.5" /> 刷新
          </Button>
        }
      />

      <CachedContent loading={loading} error={error} onRetry={load} hasData={!!data}>
        {data && (
          <>
            <ProjectLoopSopPanel />
            <ProjectLoopCharts data={data} onSelectProject={setSelected} />
            <ProjectLoopDetailModal
              project={selected}
              onClose={() => setSelected(null)}
              onUpdated={() => void load()}
            />
          </>
        )}
      </CachedContent>
    </>
  );
}
