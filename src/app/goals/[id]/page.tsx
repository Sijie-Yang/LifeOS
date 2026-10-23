"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge, EmptyState, ProgressBar } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, Select, Textarea, Label, Field } from "@/components/ui/Input";
import {
  GOAL_AREAS,
  GOAL_HORIZONS,
  GOAL_STATUS,
  PROJECT_STATUS,
  WEEKDAY_LABELS,
  formatDate,
} from "@/lib/utils";
import { projectDoneLabel } from "@/lib/goal-progress";
import { CERTAINTY_LABELS, type GoalCertainty } from "@/lib/goal-certainty";
import {
  CachedContent,
  fetchJson,
  refetchJson,
  invalidateFetchCache,
  peekFetchCache,
  shouldShowPageLoading,
} from "@/components/ui/PageState";
import type { ContactOption } from "@/components/contacts/ContactSearchPicker";
import { ContactName } from "@/components/contacts/ContactQuickView";
import {
  ArrowLeft,
  Check,
  Clock,
  Coins,
  MapPin,
  Pencil,
  Plus,
  Target,
  Users,
  X,
} from "lucide-react";

const ContactSearchPicker = dynamic(
  () => import("@/components/contacts/ContactSearchPicker").then((m) => m.ContactSearchPicker),
  { ssr: false }
);

const ProjectSearchPicker = dynamic(
  () => import("@/components/projects/ProjectSearchPicker").then((m) => m.ProjectSearchPicker),
  { ssr: false }
);

type KrProjectLink = {
  id: string;
  projectId: string;
  project: {
    id: string;
    name: string;
    progress: number;
    status: string;
    archiveDate: string | null;
  };
};
type KeyResult = { id: string; title: string; completed: boolean; projects?: KrProjectLink[] };
type GoalProject = {
  id: string;
  name: string;
  progress: number;
  status: string;
  milestones: { id: string; title: string; dueDate: string | null; completed: boolean }[];
};
type GoalContactRow = {
  id: string;
  contactId: string;
  role: string | null;
  source: "direct" | "project";
  projectName?: string;
  contact: {
    id: string;
    name: string;
    company?: string | null;
    institution?: string | null;
    category?: { name: string; color: string } | null;
  };
};
type ScheduleBlockRow = {
  id: string;
  title: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  color: string;
  habit?: { name: string } | null;
};
type NextAction = {
  id: string;
  title: string;
  dueDate: string | null;
  source: "goal" | "project";
  projectName?: string;
};

type GoalDetail = {
  id: string;
  title: string;
  description: string | null;
  area: string;
  horizon: string;
  status: string;
  progress: number;
  targetDate: string | null;
  budgetAmount: number | null;
  budgetCurrency: string | null;
  whyItMatters: string | null;
  resourceNote: string | null;
  keyResults: KeyResult[];
  projects: GoalProject[];
  contacts: GoalContactRow[];
  scheduleBlocks: ScheduleBlockRow[];
  nextActions: NextAction[];
  pomodoroMinutesWeek: number;
  spending: number;
  certainty: GoalCertainty;
};

function DimensionChip({
  label,
  icon: Icon,
  ready,
  hint,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  ready: boolean;
  hint: string;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        ready ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-4 w-4 ${ready ? "text-emerald-600" : "text-amber-600"}`} />
        <span className="text-sm font-medium text-zinc-800">{label}</span>
        {ready ? (
          <Check className="h-3.5 w-3.5 text-emerald-500 ml-auto" />
        ) : (
          <span className="text-xs text-amber-600 ml-auto">待补齐</span>
        )}
      </div>
      <p className="text-xs text-zinc-600">{hint}</p>
    </div>
  );
}

export default function GoalCommandCenterPage() {
  const params = useParams();
  const router = useRouter();
  const goalId = params.id as string;

  const goalUrl = `/api/goals/${goalId}`;
  const [goal, setGoal] = useState<GoalDetail | null>(() => peekFetchCache<GoalDetail>(goalUrl));
  const [allContacts, setAllContacts] = useState<ContactOption[]>(
    () => peekFetchCache<{ contacts: ContactOption[] }>("/api/contacts")?.contacts ?? []
  );
  const [loading, setLoading] = useState(() => shouldShowPageLoading([goalUrl]));
  const [error, setError] = useState<string | null>(null);
  const [editingMeta, setEditingMeta] = useState(false);
  const [metaForm, setMetaForm] = useState({
    whyItMatters: "",
    budgetAmount: "",
    budgetCurrency: "CNY",
    resourceNote: "",
  });
  const [newContactId, setNewContactId] = useState("");
  const [newContactRole, setNewContactRole] = useState("");
  const [newTask, setNewTask] = useState("");
  const [newKr, setNewKr] = useState("");
  const [krPicker, setKrPicker] = useState<Record<string, string>>({});

  const load = useCallback(async (fresh = false) => {
    const url = `/api/goals/${goalId}`;
    if (shouldShowPageLoading([url])) setLoading(true);
    setError(null);
    try {
      const goalData = fresh ? await refetchJson<GoalDetail>(url) : await fetchJson<GoalDetail>(url);
      if (fresh) invalidateFetchCache("/api/goals");
      setGoal(goalData);
      setMetaForm({
        whyItMatters: goalData.whyItMatters || "",
        budgetAmount: goalData.budgetAmount != null ? String(goalData.budgetAmount) : "",
        budgetCurrency: goalData.budgetCurrency || "CNY",
        resourceNote: goalData.resourceNote || "",
      });
      const contactsData = fresh
        ? await refetchJson<{ contacts: ContactOption[] }>("/api/contacts")
        : await fetchJson<{ contacts: ContactOption[] }>("/api/contacts");
      setAllContacts(contactsData.contacts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [goalId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveMeta = async () => {
    await fetch(`/api/goals/${goalId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        whyItMatters: metaForm.whyItMatters || null,
        budgetAmount: metaForm.budgetAmount ? Number(metaForm.budgetAmount) : null,
        budgetCurrency: metaForm.budgetCurrency || null,
        resourceNote: metaForm.resourceNote || null,
      }),
    });
    setEditingMeta(false);
    load(true);
  };

  const addContact = async () => {
    if (!newContactId) return;
    await fetch(`/api/goals/${goalId}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: newContactId, role: newContactRole || null }),
    });
    setNewContactId("");
    setNewContactRole("");
    load(true);
  };

  const removeContact = async (contactId: string, source: string) => {
    if (source !== "direct") return;
    await fetch(`/api/goals/${goalId}/contacts/${contactId}`, { method: "DELETE" });
    load(true);
  };

  const addTask = async () => {
    if (!newTask.trim()) return;
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newTask.trim(), goalId }),
    });
    setNewTask("");
    load(true);
  };

  const addKr = async () => {
    if (!newKr.trim()) return;
    await fetch(`/api/goals/${goalId}/key-results`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newKr.trim() }),
    });
    setNewKr("");
    load(true);
  };

  const linkKrProject = async (krId: string, projectId: string) => {
    if (!projectId) return;
    await fetch(`/api/key-results/${krId}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    setKrPicker((prev) => ({ ...prev, [krId]: "" }));
    load(true);
  };

  const unlinkKrProject = async (krId: string, projectId: string) => {
    await fetch(`/api/key-results/${krId}/projects/${projectId}`, { method: "DELETE" });
    load(true);
  };

  const deleteKr = async (id: string) => {
    if (!goal) return;
    setGoal({
      ...goal,
      keyResults: goal.keyResults.filter((k) => k.id !== id),
    });
    await fetch(`/api/key-results/${id}`, { method: "DELETE" });
    load(true);
  };

  const certaintyMeta = goal ? CERTAINTY_LABELS[goal.certainty.label] : null;

  return (
    <>
      <div className="mb-4">
        <Link
          href="/goals"
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800"
        >
          <ArrowLeft className="h-4 w-4" /> 返回目标列表
        </Link>
      </div>

      <PageHeader
        title={goal?.title ?? "目标作战室"}
        description={goal?.description || "目标作战室 — 人 · 事 · 物 · 场"}
        action={
          goal ? (
            <div className="flex items-center gap-2">
              <Badge className={GOAL_AREAS[goal.area]?.color}>{GOAL_AREAS[goal.area]?.label}</Badge>
              <Badge className={GOAL_STATUS[goal.status]?.color}>
                {GOAL_STATUS[goal.status]?.label}
              </Badge>
              <span className="text-xs text-zinc-400">{GOAL_HORIZONS[goal.horizon]}</span>
            </div>
          ) : undefined
        }
      />
      <CachedContent loading={loading} error={error} onRetry={load} hasData={!!goal}>
      {goal && certaintyMeta && (
      <>
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-shrink-0 text-center md:text-left">
              <div className="text-4xl font-bold text-zinc-900">{goal.certainty.score}</div>
              <Badge className={`mt-1 ${certaintyMeta.color}`}>{goal.certainty.label}</Badge>
              <p className="text-xs text-zinc-500 mt-1 max-w-[160px]">{certaintyMeta.description}</p>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-zinc-600">执行进度</span>
                <span className="text-sm font-medium">{goal.progress}%</span>
              </div>
              <ProgressBar value={goal.progress} />
              <p className="text-xs text-zinc-400 mt-1">
                关联项目中已完成的比例（已完成 / 已归档 / 100%）
              </p>
              {goal.certainty.gaps.length > 0 && (
                <p className="text-xs text-amber-600 mt-2">
                  缺口：{goal.certainty.gaps.join(" · ")}
                  {!goal.certainty.momentum && " — 近 14 天无活动记录"}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
            <DimensionChip
              label="人"
              icon={Users}
              ready={goal.certainty.people.ready}
              hint={goal.certainty.people.hint}
            />
            <DimensionChip
              label="事"
              icon={Target}
              ready={goal.certainty.affairs.ready}
              hint={goal.certainty.affairs.hint}
            />
            <DimensionChip
              label="物"
              icon={Coins}
              ready={goal.certainty.things.ready}
              hint={goal.certainty.things.hint}
            />
            <DimensionChip
              label="场"
              icon={MapPin}
              ready={goal.certainty.field.ready}
              hint={goal.certainty.field.hint}
            />
          </div>

          {goal.whyItMatters && !editingMeta && (
            <div className="mt-4 rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-3">
              <p className="text-xs text-indigo-600 font-medium mb-1">为什么重要</p>
              <p className="text-sm text-indigo-900">{goal.whyItMatters}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 人 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-pink-500" /> 人
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!goal.certainty.people.ready && (
              <p className="text-xs text-amber-600 mb-3">
                这个目标需要谁的帮助、监督或合作？
              </p>
            )}
            <div className="space-y-2 mb-4">
              {goal.contacts.length === 0 ? (
                <EmptyState title="暂无关联联系人" description="添加导师、合作者或关键关系人" />
              ) : (
                goal.contacts.map((c) => (
                  <div
                    key={`${c.contactId}-${c.source}`}
                    className="flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2"
                  >
                    <div className="flex-1 min-w-0">
                      <ContactName
                        id={c.contactId}
                        name={c.contact.name}
                        className="text-sm font-medium text-zinc-800"
                      />
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        {c.role && <span>{c.role}</span>}
                        {c.source === "project" && c.projectName && (
                          <span>via {c.projectName}</span>
                        )}
                      </div>
                    </div>
                    {c.source === "direct" && (
                      <button
                        onClick={() => removeContact(c.contactId, c.source)}
                        className="text-zinc-400 hover:text-red-500"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
            <div className="space-y-2 pt-3 border-t border-zinc-100">
              <ContactSearchPicker
                contacts={allContacts}
                value={newContactId}
                onChange={setNewContactId}
                placeholder="搜索并添加联系人…"
              />
              <div className="flex gap-2">
                <Input
                  value={newContactRole}
                  onChange={(e) => setNewContactRole(e.target.value)}
                  placeholder="角色，如导师、合作者"
                  className="flex-1"
                />
                <Button size="sm" onClick={addContact} disabled={!newContactId}>
                  <Plus className="h-3.5 w-3.5" /> 添加
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 事 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4 text-indigo-500" /> 事
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Label className="text-xs text-zinc-500">
                关键结果 ({goal.keyResults.filter((k) => k.completed).length}/{goal.keyResults.length})
                <span className="text-zinc-400 font-normal ml-1">· 关联项目全部完成时自动勾选</span>
              </Label>
              <div className="space-y-3 mt-2">
                {goal.keyResults.map((kr) => {
                  const linkedIds = new Set((kr.projects ?? []).map((lp) => lp.projectId));
                  const availableProjects = goal.projects
                    .filter((p) => !linkedIds.has(p.id))
                    .map((p) => ({ id: p.id, name: p.name, status: p.status }));
                  return (
                    <div key={kr.id} className="rounded-lg bg-zinc-50 px-3 py-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <div
                          className={`flex-shrink-0 h-5 w-5 rounded border flex items-center justify-center mt-0.5 ${
                            kr.completed ? "bg-emerald-500 border-emerald-500 text-white" : "border-zinc-300 bg-white"
                          }`}
                          title={kr.completed ? "关联项目已全部完成" : "尚有项目未完成"}
                        >
                          {kr.completed && <Check className="h-3 w-3" />}
                        </div>
                        <span className={`flex-1 text-sm ${kr.completed ? "text-zinc-500" : "text-zinc-800"}`}>
                          {kr.title}
                        </span>
                        <button
                          type="button"
                          onClick={() => deleteKr(kr.id)}
                          className="text-zinc-400 hover:text-red-500"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pl-7">
                        {(kr.projects ?? []).length === 0 ? (
                          <span className="text-xs text-amber-600">请关联至少一个项目</span>
                        ) : (
                          (kr.projects ?? []).map((lp) => (
                            <Badge
                              key={lp.id}
                              className={
                                lp.project.status === "COMPLETED" || lp.project.progress >= 100
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-indigo-100 text-indigo-700"
                              }
                            >
                              {lp.project.name} · {projectDoneLabel(lp.project)}
                              <button
                                type="button"
                                onClick={() => unlinkKrProject(kr.id, lp.projectId)}
                                className="ml-1 opacity-60 hover:opacity-100"
                              >
                                <X className="h-3 w-3 inline" />
                              </button>
                            </Badge>
                          ))
                        )}
                      </div>
                      {availableProjects.length > 0 && (
                        <div className="pl-7 flex gap-2">
                          <div className="flex-1 min-w-0">
                            <ProjectSearchPicker
                              projects={availableProjects}
                              value={krPicker[kr.id] ?? ""}
                              onChange={(id) => setKrPicker((prev) => ({ ...prev, [kr.id]: id }))}
                              placeholder="关联项目…"
                            />
                          </div>
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={!krPicker[kr.id]}
                            onClick={() => linkKrProject(kr.id, krPicker[kr.id] ?? "")}
                          >
                            关联
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 mt-2">
                <Input
                  value={newKr}
                  onChange={(e) => setNewKr(e.target.value)}
                  placeholder="新关键结果…"
                  onKeyDown={(e) => e.key === "Enter" && addKr()}
                />
                <Button size="sm" variant="secondary" onClick={addKr} disabled={!newKr.trim()}>
                  添加
                </Button>
              </div>
            </div>

            <div className="mb-4">
              <Label className="text-xs text-zinc-500">目标下全部项目</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {goal.projects.length > 0 ? (
                  goal.projects.map((p) => (
                    <Link key={p.id} href="/projects">
                      <Badge
                        className={
                          p.status === "COMPLETED" || p.progress >= 100
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                            : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                        }
                      >
                        {p.name} · {PROJECT_STATUS[p.status]?.label ?? p.status} {p.progress}%
                      </Badge>
                    </Link>
                  ))
                ) : (
                  <Link href="/projects" className="text-xs text-indigo-600 hover:underline">
                    前往项目管理关联 →
                  </Link>
                )}
              </div>
            </div>

            <div>
              <Label className="text-xs text-zinc-500">下一步行动</Label>
              <div className="space-y-1.5 mt-2">
                {goal.nextActions.map((t) => (
                  <div key={t.id} className="text-sm text-zinc-700 flex items-center gap-2">
                    <span>{t.title}</span>
                    {t.dueDate && (
                      <span className="text-xs text-zinc-400">{formatDate(t.dueDate)}</span>
                    )}
                    {t.projectName && (
                      <span className="text-xs text-zinc-400">· {t.projectName}</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Input
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  placeholder="目标级下一步行动…"
                  onKeyDown={(e) => e.key === "Enter" && addTask()}
                />
                <Button size="sm" variant="secondary" onClick={addTask} disabled={!newTask.trim()}>
                  添加
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 物 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2">
                <Coins className="h-4 w-4 text-amber-500" /> 物
              </span>
              <Button size="sm" variant="ghost" onClick={() => setEditingMeta(!editingMeta)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {editingMeta ? (
              <div className="space-y-3">
                <Field>
                  <Label>为什么重要</Label>
                  <Textarea
                    value={metaForm.whyItMatters}
                    onChange={(e) => setMetaForm({ ...metaForm, whyItMatters: e.target.value })}
                    placeholder="这个目标对你意味着什么？"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <Label>预算金额</Label>
                    <Input
                      type="number"
                      value={metaForm.budgetAmount}
                      onChange={(e) => setMetaForm({ ...metaForm, budgetAmount: e.target.value })}
                      placeholder="0"
                    />
                  </Field>
                  <Field>
                    <Label>货币</Label>
                    <Select
                      value={metaForm.budgetCurrency}
                      onChange={(e) => setMetaForm({ ...metaForm, budgetCurrency: e.target.value })}
                    >
                      <option value="CNY">CNY</option>
                      <option value="USD">USD</option>
                      <option value="SGD">SGD</option>
                    </Select>
                  </Field>
                </div>
                <Field>
                  <Label>资源备注</Label>
                  <Textarea
                    value={metaForm.resourceNote}
                    onChange={(e) => setMetaForm({ ...metaForm, resourceNote: e.target.value })}
                    placeholder="所需工具、设备、课程等"
                  />
                </Field>
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="secondary" onClick={() => setEditingMeta(false)}>
                    取消
                  </Button>
                  <Button size="sm" onClick={saveMeta}>保存</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                {goal.budgetAmount != null ? (
                  <div>
                    <span className="text-zinc-500">预算：</span>
                    <span className="font-medium">
                      {goal.budgetCurrency || "CNY"} {goal.budgetAmount.toLocaleString()}
                    </span>
                  </div>
                ) : (
                  <p className="text-zinc-400 text-xs">未设定预算 — 点击编辑添加</p>
                )}
                {goal.resourceNote && (
                  <div>
                    <span className="text-zinc-500">资源：</span>
                    <span>{goal.resourceNote}</span>
                  </div>
                )}
                {goal.area === "finance" && goal.spending > 0 && (
                  <div>
                    <span className="text-zinc-500">关联项目支出：</span>
                    <span className="font-medium">¥{goal.spending.toLocaleString()}</span>
                  </div>
                )}
                {!goal.budgetAmount && !goal.resourceNote && (
                  <p className="text-xs text-amber-600">
                    {goal.area === "finance"
                      ? "财务目标建议设定预算金额"
                      : "记录所需资源或预算，提升确定性"}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 场 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-violet-500" /> 场
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!goal.certainty.field.ready && (
              <p className="text-xs text-amber-600 mb-3">
                在时间表中为这个目标预留专属时段
              </p>
            )}
            <div className="space-y-2 mb-4">
              {goal.scheduleBlocks.length === 0 ? (
                <EmptyState title="暂无时间块" description="前往时间表添加专属时段" />
              ) : (
                goal.scheduleBlocks.map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center gap-3 rounded-lg px-3 py-2"
                    style={{ backgroundColor: `${b.color}15` }}
                  >
                    <div
                      className="w-1 h-8 rounded-full flex-shrink-0"
                      style={{ backgroundColor: b.color }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-800">{b.title}</p>
                      <p className="text-xs text-zinc-500">
                        {WEEKDAY_LABELS[b.dayOfWeek === 0 ? 6 : b.dayOfWeek - 1]} {b.startTime}–{b.endTime}
                        {b.habit && ` · ${b.habit.name}`}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="flex items-center justify-between text-sm pt-3 border-t border-zinc-100">
              <span className="text-zinc-500">本周专注时间</span>
              <span className="font-medium">{goal.pomodoroMinutesWeek} 分钟</span>
            </div>
            <Link
              href="/calendar/week"
              className="inline-block mt-3 text-xs text-indigo-600 hover:underline"
            >
              前往周日历 →
            </Link>
          </CardContent>
        </Card>
      </div>

      {goal.targetDate && (
        <p className="text-xs text-zinc-400 mt-6 text-center">
          目标日期：{formatDate(goal.targetDate)}
        </p>
      )}
      </>
      )}
      </CachedContent>
    </>
  );
}
