"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge, EmptyState } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea, Label, Field } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { MEETING_STATUS, MEETING_CATEGORIES, PROJECT_PRIORITY, formatDate } from "@/lib/utils";
import {
  CachedContent,
  fetchJson,
  invalidateFetchCache,
  peekFetchCache,
  shouldShowPageLoading,
} from "@/components/ui/PageState";
import { useDeepLinkOpen } from "@/lib/useDeepLink";
import { Plus, Trash2, Pencil, Users } from "lucide-react";
import { FilterTabs } from "@/components/ui/FilterTabs";
import { ContactNameList } from "@/components/contacts/ContactQuickView";
import Link from "next/link";

type Contact = { id: string; name: string };
type Project = { id: string; name: string };

type Meeting = {
  id: string;
  title: string;
  category: string;
  status: string;
  priority: string;
  meetingDate: string;
  meetingTime: string | null;
  timezone: string;
  durationMin: string | null;
  meetingFormat: string | null;
  location: string | null;
  purpose: string | null;
  content: string | null;
  logDate: string | null;
  projectId: string | null;
  referrerId: string | null;
  project: { id: string; name: string } | null;
  referrer: { id: string; name: string } | null;
  attendees: Array<{ contact: { id: string; name: string } }>;
  _count: { tasks: number };
};

const emptyForm = {
  title: "",
  category: "Other",
  status: "Scheduled",
  priority: "MEDIUM",
  meetingDate: "",
  meetingTime: "",
  timezone: "GMT+8",
  durationMin: "",
  meetingFormat: "",
  location: "",
  purpose: "",
  content: "",
  logDate: "",
  projectId: "",
  referrerId: "",
  attendeeIds: [] as string[],
};

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>(
    () => peekFetchCache<{ meetings: Meeting[] }>("/api/meetings")?.meetings ?? []
  );
  const [contacts, setContacts] = useState<Contact[]>(
    () => peekFetchCache<{ contacts: Contact[] }>("/api/contacts")?.contacts ?? []
  );
  const [projects, setProjects] = useState<Project[]>(
    () => peekFetchCache<Project[]>("/api/projects") ?? []
  );
  const [filter, setFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(() => shouldShowPageLoading(["/api/meetings"]));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const qs = filter === "upcoming" ? "?upcoming=1" : filter !== "all" ? `?status=${filter}` : "";
    const key = `/api/meetings${qs}`;
    if (shouldShowPageLoading([key])) setLoading(true);
    setError(null);
    try {
      const m = await fetchJson<{ meetings: Meeting[] }>(key);
      setMeetings(m.meetings);
      const [c, p] = await Promise.all([
        fetchJson<{ contacts: Contact[] }>("/api/contacts"),
        fetchJson<Project[]>("/api/projects"),
      ]);
      setContacts(c.contacts);
      setProjects(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const openEdit = useCallback((m: Meeting) => {
    setEditing(m);
    setForm({
      title: m.title,
      category: m.category,
      status: m.status,
      priority: m.priority,
      meetingDate: m.meetingDate,
      meetingTime: m.meetingTime || "",
      timezone: m.timezone,
      durationMin: m.durationMin || "",
      meetingFormat: m.meetingFormat || "",
      location: m.location || "",
      purpose: m.purpose || "",
      content: m.content || "",
      logDate: m.logDate || "",
      projectId: m.projectId || "",
      referrerId: m.referrerId || "",
      attendeeIds: m.attendees.map((a) => a.contact.id),
    });
    setModalOpen(true);
  }, []);

  useDeepLinkOpen(
    useCallback((id) => {
      const m = meetings.find((x) => x.id === id);
      if (m) openEdit(m);
    }, [meetings, openEdit]),
    !loading
  );

  const save = async () => {
    const payload = {
      ...form,
      projectId: form.projectId || null,
      referrerId: form.referrerId || null,
      attendeeIds: form.attendeeIds,
    };
    if (editing) {
      await fetch(`/api/meetings/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setModalOpen(false);
    invalidateFetchCache("/api/timeline");
    invalidateFetchCache("/api/meetings");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("删除此会议？")) return;
    await fetch(`/api/meetings/${id}`, { method: "DELETE" });
    invalidateFetchCache("/api/timeline");
    invalidateFetchCache("/api/meetings");
    load();
  };

  const toggleAttendee = (id: string) => {
    setForm((f) => ({
      ...f,
      attendeeIds: f.attendeeIds.includes(id)
        ? f.attendeeIds.filter((x) => x !== id)
        : [...f.attendeeIds, id],
    }));
  };

  return (
    <>
      <PageHeader
        title="会议"
        description="一次会议一篇档案 — 对象、提纲、会中笔记、会后任务"
        action={<Button onClick={() => { setEditing(null); setForm(emptyForm); setModalOpen(true); }}><Plus className="h-4 w-4" /> 新建会议</Button>}
      />
      <CachedContent loading={loading} error={error} onRetry={load} hasData={meetings.length > 0}>

      <FilterTabs
        tabs={[
          { key: "all", label: "全部" },
          { key: "upcoming", label: "即将到来" },
          { key: "Scheduled", label: "已安排" },
          { key: "Completed", label: "已完成" },
        ]}
        value={filter}
        onChange={setFilter}
      />

      {meetings.length === 0 ? (
        <EmptyState title="暂无会议" description="创建会议档案，关联联系人与项目" />
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => (
            <Card key={m.id} className="hover:border-indigo-200 transition-colors">
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-medium text-zinc-900">{m.title}</span>
                      <Badge className={MEETING_STATUS[m.status]?.color}>{MEETING_STATUS[m.status]?.label || m.status}</Badge>
                      <Badge className="bg-zinc-100 text-zinc-600">{m.category}</Badge>
                      <Badge className={PROJECT_PRIORITY[m.priority]?.color}>{PROJECT_PRIORITY[m.priority]?.label}</Badge>
                    </div>
                    <p className="text-sm text-zinc-500">
                      {m.meetingDate}{m.meetingTime ? ` ${m.meetingTime}` : ""} · {m.timezone}
                      {m.durationMin ? ` · ${m.durationMin} min` : ""}
                    </p>
                    {m.attendees.length > 0 && (
                      <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                        <Users className="h-3 w-3 shrink-0" />
                        <ContactNameList
                          people={m.attendees.map((a) => ({
                            id: a.contact.id,
                            name: a.contact.name,
                          }))}
                        />
                      </p>
                    )}
                    {m.purpose && <p className="text-sm text-zinc-600 mt-2 truncate">{m.purpose}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="secondary" onClick={() => openEdit(m)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="secondary" onClick={() => remove(m.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "编辑会议" : "新建会议"} wide>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <Field><Label>标题</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <Label>分类</Label>
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {MEETING_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field>
              <Label>状态</Label>
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {Object.entries(MEETING_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field><Label>日期</Label><Input type="date" value={form.meetingDate} onChange={(e) => setForm({ ...form, meetingDate: e.target.value })} /></Field>
            <Field><Label>时间</Label><Input type="time" value={form.meetingTime} onChange={(e) => setForm({ ...form, meetingTime: e.target.value })} /></Field>
            <Field><Label>时长</Label><Input value={form.durationMin} placeholder="20-30" onChange={(e) => setForm({ ...form, durationMin: e.target.value })} /></Field>
          </div>
          <Field><Label>目的</Label><Input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></Field>
          <Field>
            <Label>参会人</Label>
            <div className="flex flex-wrap gap-2 mt-1 max-h-24 overflow-y-auto">
              {contacts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleAttendee(c.id)}
                  className={`px-2 py-1 rounded-lg text-xs border ${form.attendeeIds.includes(c.id) ? "bg-indigo-50 border-indigo-300 text-indigo-700" : "border-zinc-200 text-zinc-600"}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <Label>引荐人</Label>
              <Select value={form.referrerId} onChange={(e) => setForm({ ...form, referrerId: e.target.value })}>
                <option value="">无</option>
                {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field>
              <Label>关联项目</Label>
              <Select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
                <option value="">无</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
          </div>
          <Field><Label>形式 / 地点</Label><Input value={form.meetingFormat} placeholder="视频/电话/现场" onChange={(e) => setForm({ ...form, meetingFormat: e.target.value })} /></Field>
          <Field><Label>提纲 / 会中笔记 / 会后总结（Markdown）</Label><Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="min-h-[200px] font-mono text-sm" /></Field>
          {editing && (
            <Link href={`/tasks?meetingId=${editing.id}`} className="text-sm text-indigo-600 hover:underline">
              查看关联任务 →
            </Link>
          )}
          <div className="flex gap-2 pt-2">
            <Button onClick={save}>保存</Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>取消</Button>
          </div>
        </div>
      </Modal>
      </CachedContent>
    </>
  );
}
