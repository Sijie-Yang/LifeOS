"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge, EmptyState } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea, Label, Field, Select } from "@/components/ui/Input";
import { MarkdownEditor } from "@/components/ui/MarkdownEditor";
import {
  CachedContent,
  fetchJson,
  invalidateFetchCache,
  peekFetchCache,
  shouldShowPageLoading,
} from "@/components/ui/PageState";
import {
  PHASE_STATUS_LABELS,
  type LifeStrategyEntryDto,
  type LifeStrategyPayload,
  type LifeStrategyPhaseDto,
} from "@/lib/life-strategy";
import {
  formatOperatingSystemMarkdown,
  parseOperatingSystem,
} from "@/lib/personal-operating-system";
import {
  PersonalOperatingSystemHeader,
  PersonalOperatingSystemPanel,
} from "@/components/strategy/PersonalOperatingSystemPanel";
import { MuskCompassPanel } from "@/components/strategy/MuskCompassPanel";
import { IronLawsBanner } from "@/components/layout/IronLawsBanner";
import { cn, toDateString } from "@/lib/utils";
import { useDeepLinkOpen } from "@/lib/useDeepLink";
import {
  Compass,
  Plus,
  Pencil,
  Trash2,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Target,
  Filter,
} from "lucide-react";
import { UI_COPY } from "@/lib/ui-copy";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-indigo-100 text-indigo-800 border-indigo-200",
  planned: "bg-zinc-100 text-zinc-700 border-zinc-200",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  revised: "bg-amber-100 text-amber-800 border-amber-200",
};

function linesToArray(text: string) {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function arrayToLines(arr: string[]) {
  return arr.join("\n");
}

function splitToRecord(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of linesToArray(text)) {
    const idx = line.indexOf(":");
    if (idx > 0) {
      out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }
  return out;
}

function recordToSplit(rec: Record<string, number | string>) {
  return Object.entries(rec)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

export default function StrategyPage() {
  const [data, setData] = useState<LifeStrategyPayload | null>(() =>
    peekFetchCache<LifeStrategyPayload>("/api/strategy")
  );
  const [loading, setLoading] = useState(() => shouldShowPageLoading(["/api/strategy"]));
  const [error, setError] = useState<string | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<"timeline" | "journal">("timeline");

  const [metaOpen, setMetaOpen] = useState(false);
  const [metaForm, setMetaForm] = useState({
    northStar: "",
    decisionFilter: "",
    operatingSystem: "",
  });

  const [phaseOpen, setPhaseOpen] = useState(false);
  const [editingPhase, setEditingPhase] = useState<LifeStrategyPhaseDto | null>(null);
  const [phaseForm, setPhaseForm] = useState({
    title: "",
    summary: "",
    status: "planned",
    startDate: "",
    endDate: "",
    timeSplitText: "",
    prioritiesText: "",
    doListText: "",
    dontListText: "",
    content: "",
  });

  const [entryOpen, setEntryOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LifeStrategyEntryDto | null>(null);
  const [entryForm, setEntryForm] = useState({
    title: "",
    date: toDateString(),
    phaseId: "",
    source: UI_COPY.strategy.defaultSource,
    tagsText: "",
    content: "",
  });

  const load = useCallback(async (force = false) => {
    if (force) invalidateFetchCache("/api/strategy");
    if (shouldShowPageLoading(["/api/strategy"])) setLoading(true);
    setError(null);
    try {
      const res = await fetchJson<LifeStrategyPayload>("/api/strategy", { force });
      setData(res);
      const active = res.phases.find((p) => p.status === "active");
      if (active) setExpandedPhases(new Set([active.id]));
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const entriesByPhase = useMemo(() => {
    const map = new Map<string, LifeStrategyEntryDto[]>();
    for (const e of data?.entries ?? []) {
      const key = e.phaseId ?? "_unlinked";
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return map;
  }, [data?.entries]);

  const openMetaEdit = () => {
    const os = parseOperatingSystem(data?.meta.operatingSystem);
    setMetaForm({
      northStar: data?.meta.northStar ?? "",
      decisionFilter: data?.meta.decisionFilter ?? "",
      operatingSystem: os
        ? formatOperatingSystemMarkdown(os)
        : (data?.meta.operatingSystem ?? ""),
    });
    setMetaOpen(true);
  };

  const saveMeta = async () => {
    await fetch("/api/strategy", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(metaForm),
    });
    setMetaOpen(false);
    load(true);
  };

  const openPhaseCreate = () => {
    setEditingPhase(null);
    setPhaseForm({
      title: "",
      summary: "",
      status: "planned",
      startDate: "",
      endDate: "",
      timeSplitText: "",
      prioritiesText: "",
      doListText: "",
      dontListText: "",
      content: "",
    });
    setPhaseOpen(true);
  };

  const openPhaseEdit = useCallback((p: LifeStrategyPhaseDto) => {
    setEditingPhase(p);
    setPhaseForm({
      title: p.title,
      summary: p.summary ?? "",
      status: p.status,
      startDate: p.startDate ?? "",
      endDate: p.endDate ?? "",
      timeSplitText: recordToSplit(p.timeSplit),
      prioritiesText: arrayToLines(p.priorities),
      doListText: arrayToLines(p.doList),
      dontListText: arrayToLines(p.dontList),
      content: p.content ?? "",
    });
    setPhaseOpen(true);
  }, []);

  useDeepLinkOpen(
    useCallback(
      (id) => {
        const phase = data?.phases.find((p) => p.id === id);
        if (!phase) return;
        setExpandedPhases((prev) => new Set([...prev, phase.id]));
        openPhaseEdit(phase);
      },
      [data, openPhaseEdit]
    ),
    !loading && !!data
  );

  const savePhase = async () => {
    const payload = {
      title: phaseForm.title,
      summary: phaseForm.summary || null,
      status: phaseForm.status,
      startDate: phaseForm.startDate || null,
      endDate: phaseForm.endDate || null,
      timeSplit: splitToRecord(phaseForm.timeSplitText),
      priorities: linesToArray(phaseForm.prioritiesText),
      doList: linesToArray(phaseForm.doListText),
      dontList: linesToArray(phaseForm.dontListText),
      content: phaseForm.content || null,
    };
    if (editingPhase) {
      await fetch("/api/strategy/phases", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingPhase.id, ...payload }),
      });
    } else {
      await fetch("/api/strategy/phases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setPhaseOpen(false);
    load(true);
  };

  const deletePhase = async () => {
    if (!editingPhase || !confirm("删除此阶段？关联对话记录会保留但解除链接。")) return;
    await fetch(`/api/strategy/phases/${editingPhase.id}`, { method: "DELETE" });
    setPhaseOpen(false);
    load(true);
  };

  const openEntryCreate = (phaseId?: string) => {
    setEditingEntry(null);
    setEntryForm({
      title: "",
      date: toDateString(),
      phaseId: phaseId ?? "",
      source: UI_COPY.strategy.defaultSource,
      tagsText: "",
      content: "",
    });
    setEntryOpen(true);
  };

  const openEntryEdit = (e: LifeStrategyEntryDto) => {
    setEditingEntry(e);
    setEntryForm({
      title: e.title,
      date: e.date,
      phaseId: e.phaseId ?? "",
      source: e.source ?? "",
      tagsText: arrayToLines(e.tags),
      content: e.content,
    });
    setEntryOpen(true);
  };

  const saveEntry = async () => {
    const payload = {
      title: entryForm.title,
      date: entryForm.date,
      phaseId: entryForm.phaseId || null,
      source: entryForm.source || null,
      tags: linesToArray(entryForm.tagsText),
      content: entryForm.content,
    };
    if (editingEntry) {
      await fetch("/api/strategy/entries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingEntry.id, ...payload }),
      });
    } else {
      await fetch("/api/strategy/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setEntryOpen(false);
    load(true);
  };

  const deleteEntry = async () => {
    if (!editingEntry || !confirm("确定删除这条策略记录？")) return;
    await fetch(`/api/strategy/entries/${editingEntry.id}`, { method: "DELETE" });
    setEntryOpen(false);
    load(true);
  };

  const togglePhase = (id: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const phases = data?.phases ?? [];
  const entries = data?.entries ?? [];
  const parsedOs = parseOperatingSystem(data?.meta.operatingSystem ?? null);

  return (
    <>
      <PageHeader
        title="人生轨迹策略"
        description={UI_COPY.strategy.description}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={openMetaEdit}>
              <Compass className="h-4 w-4" /> 编辑北极星与 OS
            </Button>
            <Button size="sm" onClick={openPhaseCreate}>
              <Plus className="h-4 w-4" /> 新阶段
            </Button>
          </div>
        }
      />
      <CachedContent loading={loading} error={error} onRetry={() => load(true)} hasData={!!data}>

      <IronLawsBanner />

      <div className="space-y-4 mb-8">
        <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white">
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start gap-3">
              <Target className="h-5 w-5 text-indigo-600 mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-500 mb-1">
                  North Star
                </p>
                <p className="text-sm font-medium text-zinc-900 leading-relaxed">
                  {data?.meta.northStar || "尚未设定 — 点击「编辑北极星与 OS」"}
                </p>
              </div>
            </div>
            {data?.meta.decisionFilter && (
              <div className="flex items-start gap-3 mt-4 pt-4 border-t border-indigo-100/80">
                <Filter className="h-4 w-4 text-zinc-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                    决策过滤器
                  </p>
                  <p className="text-sm text-zinc-600">{data.meta.decisionFilter}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50/40 to-white">
          <CardHeader className="pb-2">
            <PersonalOperatingSystemHeader />
          </CardHeader>
          <CardContent className="pt-0">
            {parsedOs ? (
              <PersonalOperatingSystemPanel data={parsedOs} />
            ) : data?.meta.operatingSystem ? (
              <div className="markdown-preview text-sm text-zinc-700">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {data.meta.operatingSystem}
                </ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">
                尚未设定 — 点击「编辑北极星与 OS」填写
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-200 bg-gradient-to-br from-zinc-50/80 to-white">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Compass className="h-4 w-4 text-zinc-600" />
              <div>
                <CardTitle className="text-base">Musk 风向标</CardTitle>
                <p className="text-xs text-zinc-500 font-normal mt-0.5">
                  行为模式 → 性格机制 → LifeOS 该学 / 该改 / 该拒
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <MuskCompassPanel />
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2 mb-6">
        <Button
          variant={tab === "timeline" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setTab("timeline")}
        >
          阶段时间线
        </Button>
        <Button
          variant={tab === "journal" ? "primary" : "secondary"}
          size="sm"
          onClick={() => setTab("journal")}
        >
          <BookOpen className="h-4 w-4" /> 策略对话 ({entries.length})
        </Button>
      </div>

      {tab === "timeline" && (
        <>
          {phases.length === 0 ? (
            <EmptyState
              title="暂无策略阶段"
              description="还没有阶段 — 手动添加你的第一个人生阶段"
            />
          ) : (
            <div className="relative pl-8 border-l-2 border-zinc-200 space-y-6">
              {phases.map((phase) => {
                const expanded = expandedPhases.has(phase.id);
                const phaseEntries = entriesByPhase.get(phase.id) ?? [];
                return (
                  <div key={phase.id} className="relative">
                    <span
                      className={cn(
                        "absolute -left-[calc(2rem+5px)] top-3 h-3 w-3 rounded-full border-2 border-white shadow-sm",
                        phase.status === "active" ? "bg-indigo-500 ring-4 ring-indigo-100" : "bg-zinc-300"
                      )}
                    />
                    <Card
                      className={cn(
                        phase.status === "active" && "ring-2 ring-indigo-200 border-indigo-100"
                      )}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <CardTitle className="text-base">{phase.title}</CardTitle>
                              <span
                                className={cn(
                                  "text-[10px] font-medium px-2 py-0.5 rounded-full border",
                                  STATUS_COLORS[phase.status] ?? STATUS_COLORS.planned
                                )}
                              >
                                {PHASE_STATUS_LABELS[phase.status as keyof typeof PHASE_STATUS_LABELS] ??
                                  phase.status}
                              </span>
                            </div>
                            {(phase.startDate || phase.endDate) && (
                              <p className="text-xs text-zinc-500 font-mono">
                                {phase.startDate ?? "?"} → {phase.endDate ?? "?"}
                              </p>
                            )}
                            {phase.summary && (
                              <p className="text-sm text-zinc-600 mt-2">{phase.summary}</p>
                            )}
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Button variant="ghost" size="sm" onClick={() => openPhaseEdit(phase)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => togglePhase(phase.id)}>
                              {expanded ? (
                                <ChevronUp className="h-4 w-4" />
                              ) : (
                                <ChevronDown className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      {expanded && (
                        <CardContent className="pt-0 space-y-4">
                          {Object.keys(phase.timeSplit).length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-zinc-500 mb-2">时间分配</p>
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(phase.timeSplit).map(([k, v]) => (
                                  <Badge key={k} className="bg-zinc-100 text-zinc-700">
                                    {k}: {v}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {phase.priorities.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-zinc-500 mb-1">优先级</p>
                              <ul className="text-sm text-zinc-700 list-disc pl-5 space-y-0.5">
                                {phase.priorities.map((p) => (
                                  <li key={p}>{p}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <div className="grid sm:grid-cols-2 gap-4">
                            {phase.doList.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-emerald-600 mb-1">要做</p>
                                <ul className="text-sm text-zinc-700 list-disc pl-5 space-y-0.5">
                                  {phase.doList.map((p) => (
                                    <li key={p}>{p}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {phase.dontList.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-red-600 mb-1">不做</p>
                                <ul className="text-sm text-zinc-700 list-disc pl-5 space-y-0.5">
                                  {phase.dontList.map((p) => (
                                    <li key={p}>{p}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                          {phase.content && (
                            <div className="markdown-preview rounded-xl border border-zinc-100 bg-zinc-50/50 px-4 py-3 text-sm">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{phase.content}</ReactMarkdown>
                            </div>
                          )}
                          {phaseEntries.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-zinc-500 mb-2">
                                关联对话 ({phaseEntries.length})
                              </p>
                              <div className="space-y-2">
                                {phaseEntries.map((e) => (
                                  <button
                                    key={e.id}
                                    type="button"
                                    onClick={() => openEntryEdit(e)}
                                    className="w-full text-left rounded-lg border border-zinc-100 px-3 py-2 hover:border-indigo-200 hover:bg-indigo-50/30 text-sm"
                                  >
                                    <span className="font-medium text-zinc-800">{e.title}</span>
                                    <span className="text-xs text-zinc-400 ml-2">{e.date}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          <Button variant="secondary" size="sm" onClick={() => openEntryCreate(phase.id)}>
                            <Plus className="h-3.5 w-3.5" /> 添加对话记录
                          </Button>
                        </CardContent>
                      )}
                    </Card>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === "journal" && (
        <>
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => openEntryCreate()}>
              <Plus className="h-4 w-4" /> 新对话记录
            </Button>
          </div>
          {entries.length === 0 ? (
            <EmptyState title="暂无策略对话" description="每次 Cursor 里调整方向后，可在此沉淀" />
          ) : (
            <div className="space-y-3">
              {entries.map((e) => {
                const expanded = expandedEntries.has(e.id);
                const phase = phases.find((p) => p.id === e.phaseId);
                return (
                  <Card key={e.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle className="text-base">{e.title}</CardTitle>
                          <p className="text-xs text-zinc-500 mt-1">
                            {e.date}
                            {e.source && ` · ${e.source}`}
                            {phase && ` · ${phase.title}`}
                          </p>
                          {e.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {e.tags.map((t) => (
                                <Badge key={t} className="bg-indigo-50 text-indigo-700">
                                  {t}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openEntryEdit(e)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setExpandedEntries((prev) => {
                                const next = new Set(prev);
                                if (next.has(e.id)) next.delete(e.id);
                                else next.add(e.id);
                                return next;
                              })
                            }
                          >
                            {expanded ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    {expanded && (
                      <CardContent className="pt-0">
                        <div className="markdown-preview text-sm border-t border-zinc-100 pt-4">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{e.content}</ReactMarkdown>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      <Modal open={metaOpen} onClose={() => setMetaOpen(false)} title="编辑北极星与个人 OS">
        <div className="space-y-4">
          <Field>
            <Label>North Star（一句话终点）</Label>
            <Textarea
              value={metaForm.northStar}
              onChange={(e) => setMetaForm({ ...metaForm, northStar: e.target.value })}
              rows={3}
            />
          </Field>
          <Field>
            <Label>决策过滤器（做选择时问自己）</Label>
            <Textarea
              value={metaForm.decisionFilter}
              onChange={(e) => setMetaForm({ ...metaForm, decisionFilter: e.target.value })}
              rows={2}
            />
          </Field>
          <Field>
            <Label>个人操作系统（Markdown · 七层框架）</Label>
            <MarkdownEditor
              value={metaForm.operatingSystem}
              onChange={(v) => setMetaForm({ ...metaForm, operatingSystem: v })}
              minHeight={280}
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={() => setMetaOpen(false)}>
            取消
          </Button>
          <Button onClick={saveMeta}>保存</Button>
        </div>
      </Modal>

      <Modal open={phaseOpen} onClose={() => setPhaseOpen(false)} title={editingPhase ? "编辑阶段" : "新阶段"} wide>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <Field>
            <Label>标题 *</Label>
            <Input
              value={phaseForm.title}
              onChange={(e) => setPhaseForm({ ...phaseForm, title: e.target.value })}
            />
          </Field>
          <Field>
            <Label>摘要（时间线卡片上显示）</Label>
            <Input
              value={phaseForm.summary}
              onChange={(e) => setPhaseForm({ ...phaseForm, summary: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field>
              <Label>状态</Label>
              <Select
                value={phaseForm.status}
                onChange={(e) => setPhaseForm({ ...phaseForm, status: e.target.value })}
              >
                {Object.entries(PHASE_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </Field>
            <Field>
              <Label>开始</Label>
              <Input
                placeholder="2026-06"
                value={phaseForm.startDate}
                onChange={(e) => setPhaseForm({ ...phaseForm, startDate: e.target.value })}
              />
            </Field>
            <Field>
              <Label>结束</Label>
              <Input
                placeholder="2026-08"
                value={phaseForm.endDate}
                onChange={(e) => setPhaseForm({ ...phaseForm, endDate: e.target.value })}
              />
            </Field>
          </div>
          <Field>
            <Label>时间分配（每行：名称: 比例）</Label>
            <Textarea
              value={phaseForm.timeSplitText}
              onChange={(e) => setPhaseForm({ ...phaseForm, timeSplitText: e.target.value })}
              rows={3}
              placeholder={UI_COPY.strategy.allocationPlaceholder}
            />
          </Field>
          <Field>
            <Label>优先级（每行一条）</Label>
            <Textarea
              value={phaseForm.prioritiesText}
              onChange={(e) => setPhaseForm({ ...phaseForm, prioritiesText: e.target.value })}
              rows={4}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <Label>要做</Label>
              <Textarea
                value={phaseForm.doListText}
                onChange={(e) => setPhaseForm({ ...phaseForm, doListText: e.target.value })}
                rows={4}
              />
            </Field>
            <Field>
              <Label>不做</Label>
              <Textarea
                value={phaseForm.dontListText}
                onChange={(e) => setPhaseForm({ ...phaseForm, dontListText: e.target.value })}
                rows={4}
              />
            </Field>
          </div>
          <MarkdownEditor
            label="阶段详情（Markdown）"
            value={phaseForm.content}
            onChange={(v) => setPhaseForm({ ...phaseForm, content: v })}
            minHeight={200}
          />
        </div>
        <div className="flex justify-between mt-6">
          {editingPhase ? (
            <Button variant="danger" size="sm" onClick={deletePhase}>
              <Trash2 className="h-3.5 w-3.5" /> 删除
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setPhaseOpen(false)}>
              取消
            </Button>
            <Button onClick={savePhase} disabled={!phaseForm.title}>
              保存
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={entryOpen}
        onClose={() => setEntryOpen(false)}
        title={editingEntry ? "编辑对话记录" : "新对话记录"}
        xl
      >
        <div className="flex flex-col flex-1 min-h-0 p-5 gap-4">
          <div className="grid grid-cols-2 gap-4 shrink-0">
            <Field>
              <Label>标题 *</Label>
              <Input
                value={entryForm.title}
                onChange={(e) => setEntryForm({ ...entryForm, title: e.target.value })}
              />
            </Field>
            <Field>
              <Label>日期</Label>
              <Input
                type="date"
                value={entryForm.date}
                onChange={(e) => setEntryForm({ ...entryForm, date: e.target.value })}
              />
            </Field>
            <Field>
              <Label>关联阶段</Label>
              <Select
                value={entryForm.phaseId}
                onChange={(e) => setEntryForm({ ...entryForm, phaseId: e.target.value })}
              >
                <option value="">无</option>
                {phases.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field>
              <Label>来源</Label>
              <Input
                value={entryForm.source}
                onChange={(e) => setEntryForm({ ...entryForm, source: e.target.value })}
                placeholder={UI_COPY.strategy.sourcePlaceholder}
              />
            </Field>
            <Field className="col-span-2">
              <Label>标签（每行一个）</Label>
              <Input
                value={entryForm.tagsText}
                onChange={(e) => setEntryForm({ ...entryForm, tagsText: e.target.value })}
                placeholder={UI_COPY.strategy.tagsPlaceholder}
              />
            </Field>
          </div>
          <MarkdownEditor
            label="内容 *"
            value={entryForm.content}
            onChange={(v) => setEntryForm({ ...entryForm, content: v })}
            fillHeight
            className="flex-1 min-h-0"
          />
          <div className="flex justify-between shrink-0 pt-2">
            {editingEntry ? (
              <Button variant="danger" size="sm" onClick={deleteEntry}>
                <Trash2 className="h-3.5 w-3.5" /> 删除
              </Button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setEntryOpen(false)}>
                取消
              </Button>
              <Button
                onClick={saveEntry}
                disabled={!entryForm.title.trim() || !entryForm.content.trim()}
              >
                保存
              </Button>
            </div>
          </div>
        </div>
      </Modal>
      </CachedContent>
    </>
  );
}
