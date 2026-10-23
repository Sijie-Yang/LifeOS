"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Textarea, Label, Field } from "@/components/ui/Input";
import {
  categoryDisplayName,
  type ProjectLoopDayStep,
  type ProjectLoopStat,
} from "@/lib/project-loop";
import { ExternalLink } from "lucide-react";

type Props = {
  project: ProjectLoopStat | null;
  onClose: () => void;
  onUpdated: () => void;
};

export function ProjectLoopDetailModal({ project, onClose, onUpdated }: Props) {
  const last = project?.recentLoops[0] ?? null;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [correction, setCorrection] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEditingId(null);
    setError(null);
  }, [project?.projectId]);

  const startEdit = (step: ProjectLoopDayStep) => {
    setEditingId(step.id);
    setFeedback(step.feedback || "");
    setCorrection(step.correction || "");
    setError(null);
  };

  const save = async () => {
    if (!editingId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/plan-steps/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback, correction }),
      });
      if (!res.ok) throw new Error("保存失败");
      setEditingId(null);
      onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!project}
      onClose={onClose}
      title={project ? project.projectName : "项目闭环"}
      wide
    >
      {project && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: project.color }}
            />
            <Badge className="bg-zinc-100 text-zinc-700">
              {categoryDisplayName(project.categoryName)}
            </Badge>
            {project.planActive ? (
              <Badge className="bg-emerald-50 text-emerald-800">plan 开</Badge>
            ) : (
              <Badge className="bg-zinc-100 text-zinc-500">plan 关</Badge>
            )}
            <Link
              href={`/projects?id=${project.projectId}`}
              className="ml-auto text-xs text-indigo-700 hover:underline inline-flex items-center gap-1"
            >
              打开项目页 <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border border-zinc-100 px-3 py-2">
              <p className="text-[11px] text-zinc-500">上次闭环</p>
              <p className="text-sm font-semibold text-zinc-900 mt-0.5">
                {project.lastDayLoopDate ?? "尚未闭环"}
              </p>
              {project.daysSinceLastDayLoop != null && (
                <p className="text-[11px] text-zinc-400">
                  {project.daysSinceLastDayLoop === 0
                    ? "今天"
                    : `${project.daysSinceLastDayLoop} 天前`}
                </p>
              )}
            </div>
            <div className="rounded-lg border border-zinc-100 px-3 py-2">
              <p className="text-[11px] text-zinc-500">平均间隔</p>
              <p className="text-sm font-semibold text-zinc-900 mt-0.5">
                {project.dayLoopAvgInterval != null
                  ? `${project.dayLoopAvgInterval} 天/次`
                  : "—"}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-100 px-3 py-2">
              <p className="text-[11px] text-zinc-500">日闭环次数</p>
              <p className="text-sm font-semibold text-zinc-900 mt-0.5">
                {project.dayLoopCount}
              </p>
            </div>
            <div className="rounded-lg border border-zinc-100 px-3 py-2">
              <p className="text-[11px] text-zinc-500">步骤进度</p>
              <p className="text-sm font-semibold text-zinc-900 mt-0.5">
                {project.doneSteps}/{project.totalSteps}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-zinc-800 mb-2">
              上次闭环详情
              {last ? ` · ${last.date}` : ""}
            </p>
            {!last ? (
              <p className="text-sm text-zinc-500 py-6 text-center rounded-xl border border-dashed border-zinc-200">
                还没有日闭环。在日历/日计划勾完该项目步骤后会出现在这里。
              </p>
            ) : (
              <div className="space-y-3">
                {last.steps.map((step) => (
                  <div
                    key={step.id}
                    className="rounded-xl border border-zinc-100 px-3 py-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-900">{step.title}</p>
                        {step.isMilestone && (
                          <Badge className="mt-1 bg-amber-50 text-amber-800">里程碑</Badge>
                        )}
                      </div>
                      {editingId !== step.id && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="shrink-0 text-xs"
                          onClick={() => startEdit(step)}
                        >
                          写反馈/修正
                        </Button>
                      )}
                    </div>

                    {editingId === step.id ? (
                      <div className="space-y-3 pt-1">
                        <Field>
                          <Label>反馈（观察到什么）</Label>
                          <Textarea
                            value={feedback}
                            onChange={(e) => setFeedback(e.target.value)}
                            rows={2}
                            placeholder="结果如何？身体/数据/对方反应？"
                          />
                        </Field>
                        <Field>
                          <Label>修正（下一轮改什么）</Label>
                          <Textarea
                            value={correction}
                            onChange={(e) => setCorrection(e.target.value)}
                            rows={2}
                            placeholder="下一步假设或方法上改哪一点？"
                          />
                        </Field>
                        {error && <p className="text-xs text-rose-600">{error}</p>}
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setEditingId(null)}
                          >
                            取消
                          </Button>
                          <Button size="sm" disabled={saving} onClick={() => void save()}>
                            {saving ? "保存中…" : "保存"}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-sky-50/80 px-2.5 py-2">
                          <p className="font-medium text-sky-900 mb-0.5">反馈</p>
                          <p className="text-sky-900/80 whitespace-pre-wrap">
                            {step.feedback || (
                              <span className="text-sky-700/50">尚未填写</span>
                            )}
                          </p>
                        </div>
                        <div className="rounded-lg bg-amber-50/80 px-2.5 py-2">
                          <p className="font-medium text-amber-900 mb-0.5">修正</p>
                          <p className="text-amber-900/80 whitespace-pre-wrap">
                            {step.correction || (
                              <span className="text-amber-700/50">尚未填写</span>
                            )}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {project.recentLoops.length > 1 && (
            <div>
              <p className="text-xs font-semibold text-zinc-800 mb-2">更早的闭环</p>
              <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                {project.recentLoops.slice(1).map((loop) => (
                  <li
                    key={loop.date}
                    className="text-xs text-zinc-600 flex items-baseline justify-between gap-2 rounded-lg border border-zinc-50 px-2.5 py-1.5"
                  >
                    <span className="font-medium text-zinc-800 shrink-0">{loop.date}</span>
                    <span className="truncate text-right">
                      {loop.steps.map((s) => s.title).join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[11px] text-zinc-400 leading-relaxed">
            统计口径：该项目计划步骤 done + doneDate。完整闭环 = 执行（勾选）+ 反馈 + 修正 +
            再执行。
          </p>
        </div>
      )}
    </Modal>
  );
}
