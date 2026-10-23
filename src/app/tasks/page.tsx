"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge, EmptyState } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Label, Field } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { PROJECT_PRIORITY } from "@/lib/utils";
import {
  CachedContent,
  fetchJson,
  peekFetchCache,
  shouldShowPageLoading,
} from "@/components/ui/PageState";
import { Plus, Trash2, CheckCircle2, Circle, Pencil } from "lucide-react";
import { FilterTabs } from "@/components/ui/FilterTabs";
import { ContactName } from "@/components/contacts/ContactQuickView";

type Task = {
  id: string;
  title: string;
  completed: boolean;
  dueDate: string | null;
  scheduledDate: string | null;
  priority: string;
  emailRemind?: boolean;
  project: { id: string; name: string } | null;
  contact: { id: string; name: string } | null;
  meeting: { id: string; title: string; meetingDate: string } | null;
};

type TaskFilter = "open" | "today" | "overdue" | "done" | "all";
const VALID_FILTERS: TaskFilter[] = ["open", "today", "overdue", "done", "all"];

type Option = { id: string; name: string };
type MeetingOption = { id: string; title: string };

const emptyForm = {
  title: "",
  dueDate: "",
  scheduledDate: "",
  priority: "MEDIUM",
  emailRemind: true,
  projectId: "",
  contactId: "",
  meetingId: "",
};

function readUrlParams() {
  const p = new URLSearchParams(window.location.search);
  const filterParam = p.get("filter");
  const filter: TaskFilter =
    filterParam && VALID_FILTERS.includes(filterParam as TaskFilter)
      ? (filterParam as TaskFilter)
      : p.get("meetingId")
        ? "all"
        : "open";
  return {
    filter,
    meetingId: p.get("meetingId"),
  };
}

function syncFilterUrl(filter: TaskFilter) {
  const url = new URL(window.location.href);
  if (filter === "open") url.searchParams.delete("filter");
  else url.searchParams.set("filter", filter);
  window.history.replaceState({}, "", url.toString());
}

export default function TasksPage() {
  const [meetingIdParam, setMeetingIdParam] = useState<string | null>(null);
  const [filter, setFilter] = useState<TaskFilter>("open");
  const [urlReady, setUrlReady] = useState(false);

  const [tasks, setTasks] = useState<Task[]>(
    () => peekFetchCache<{ tasks: Task[] }>("/api/tasks?filter=open")?.tasks ?? []
  );
  const [counts, setCounts] = useState(
    () =>
      peekFetchCache<{ counts: { open: number; today: number; overdue: number } }>(
        "/api/tasks?filter=open"
      )?.counts ?? { open: 0, today: 0, overdue: 0 }
  );
  const [projects, setProjects] = useState<Option[]>([]);
  const [contacts, setContacts] = useState<Option[]>([]);
  const [meetings, setMeetings] = useState<MeetingOption[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(() => shouldShowPageLoading(["/api/tasks?filter=open"]));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { filter: f, meetingId } = readUrlParams();
    setFilter(f);
    setMeetingIdParam(meetingId);
    setUrlReady(true);

    Promise.all([
      fetchJson<Option[]>("/api/projects").then((list) =>
        setProjects(list.map((p) => ({ id: p.id, name: p.name })))
      ),
      fetchJson<{ contacts: Option[] }>("/api/contacts").then((d) =>
        setContacts(d.contacts.map((c) => ({ id: c.id, name: c.name })))
      ),
      fetchJson<{ meetings: MeetingOption[] }>("/api/meetings").then((d) =>
        setMeetings(d.meetings.map((m) => ({ id: m.id, title: m.title })))
      ),
    ]).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!urlReady) return;
    const key = `/api/tasks?filter=${filter}`;
    if (shouldShowPageLoading([key])) setLoading(true);
    setError(null);
    try {
      const d = await fetchJson<{ tasks: Task[]; counts: typeof counts }>(key);
      let list = d.tasks;
      if (meetingIdParam) list = list.filter((t) => t.meeting?.id === meetingIdParam);
      setTasks(list);
      setCounts(d.counts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [filter, meetingIdParam, urlReady]);

  useEffect(() => {
    load();
  }, [load]);

  const changeFilter = (next: TaskFilter) => {
    setFilter(next);
    if (!meetingIdParam) syncFilterUrl(next);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, meetingId: meetingIdParam || "" });
    setModalOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditing(task);
    setForm({
      title: task.title,
      dueDate: task.dueDate || "",
      scheduledDate: task.scheduledDate || "",
      priority: task.priority,
      emailRemind: task.emailRemind !== false,
      projectId: task.project?.id || "",
      contactId: task.contact?.id || "",
      meetingId: task.meeting?.id || "",
    });
    setModalOpen(true);
  };

  const toggle = async (task: Task) => {
    await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !task.completed }),
    });
    load();
  };

  const saveTask = async () => {
    if (!form.title.trim()) return;
    const payload = {
      title: form.title.trim(),
      dueDate: form.dueDate || null,
      scheduledDate: form.scheduledDate || null,
      priority: form.priority,
      emailRemind: form.emailRemind,
      projectId: form.projectId || null,
      contactId: form.contactId || null,
      meetingId: form.meetingId || null,
    };
    if (editing) {
      await fetch(`/api/tasks/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setModalOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("确定删除此任务？")) return;
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <>
      <PageHeader
        title="任务"
        description={`未归属项目的收件箱与会议跟进 · 待办 ${counts.open} · 今日 ${counts.today} · 逾期 ${counts.overdue}`}
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> 新建任务
          </Button>
        }
      />
      <CachedContent loading={loading || !urlReady} error={error} onRetry={load} hasData={tasks.length > 0}>

      {!meetingIdParam && (
        <FilterTabs
          tabs={[
            { key: "open", label: "待办" },
            { key: "today", label: "今日" },
            { key: "overdue", label: "逾期" },
            { key: "done", label: "已完成" },
            { key: "all", label: "全部" },
          ]}
          value={filter}
          onChange={(k) => changeFilter(k as TaskFilter)}
        />
      )}

      {tasks.length === 0 ? (
        <EmptyState title="暂无任务" description="从日记、会议或项目中拆解待办" />
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => (
            <Card key={t.id}>
              <CardContent className="py-3 flex items-center gap-3">
                <button
                  onClick={() => toggle(t)}
                  className="shrink-0 text-zinc-400 hover:text-emerald-600"
                >
                  {t.completed ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <Circle className="h-5 w-5" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm ${t.completed ? "line-through text-zinc-400" : "text-zinc-800"}`}
                  >
                    {t.title}
                  </p>
                  <div className="flex gap-2 mt-0.5 flex-wrap items-center">
                    {t.dueDate && <span className="text-xs text-zinc-500">截止 {t.dueDate}</span>}
                    {t.scheduledDate && (
                      <span className="text-xs text-zinc-500">计划 {t.scheduledDate}</span>
                    )}
                    <Badge className={PROJECT_PRIORITY[t.priority]?.color}>
                      {PROJECT_PRIORITY[t.priority]?.label}
                    </Badge>
                    {t.project && (
                      <Link href={`/projects?id=${t.project.id}`}>
                        <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
                          {t.project.name}
                        </Badge>
                      </Link>
                    )}
                    {t.contact && (
                      <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors">
                        <ContactName
                          id={t.contact.id}
                          name={t.contact.name}
                          className="text-amber-800 hover:text-amber-950"
                        />
                      </Badge>
                    )}
                    {t.meeting && (
                      <Link href={`/meetings?id=${t.meeting.id}`}>
                        <Badge className="bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors">
                          {t.meeting.title}
                        </Badge>
                      </Link>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(t)} title="编辑">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(t.id)} title="删除">
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "编辑任务" : "新建任务"}
        wide
      >
        <div className="grid grid-cols-2 gap-4">
          <Field className="col-span-2">
            <Label>标题 *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              autoFocus
            />
          </Field>
          <Field>
            <Label>截止日期</Label>
            <Input
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
            <label className="mt-2 flex items-center gap-2 text-xs text-zinc-600">
              <input
                type="checkbox"
                checked={form.emailRemind}
                onChange={(e) => setForm({ ...form, emailRemind: e.target.checked })}
              />
              邮件提醒
            </label>
          </Field>
          <Field>
            <Label>计划日期</Label>
            <Input
              type="date"
              value={form.scheduledDate}
              onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
            />
          </Field>
          <Field>
            <Label>优先级</Label>
            <Select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              {Object.entries(PROJECT_PRIORITY).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field>
            <Label>关联项目</Label>
            <Select
              value={form.projectId}
              onChange={(e) => setForm({ ...form, projectId: e.target.value })}
            >
              <option value="">无</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field>
            <Label>关联联系人</Label>
            <Select
              value={form.contactId}
              onChange={(e) => setForm({ ...form, contactId: e.target.value })}
            >
              <option value="">无</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field>
            <Label>关联会议</Label>
            <Select
              value={form.meetingId}
              onChange={(e) => setForm({ ...form, meetingId: e.target.value })}
            >
              <option value="">无</option>
              {meetings.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            取消
          </Button>
          <Button onClick={saveTask} disabled={!form.title.trim()}>
            保存
          </Button>
        </div>
      </Modal>
      </CachedContent>
    </>
  );
}
