"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge, EmptyState } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea, Label, Field } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { TRAVEL_STATUS, TRAVEL_CATEGORIES, PROJECT_PRIORITY, formatDate } from "@/lib/utils";
import {
  CachedContent,
  fetchJson,
  peekFetchCache,
  shouldShowPageLoading,
} from "@/components/ui/PageState";
import { useDeepLinkOpen } from "@/lib/useDeepLink";
import { Plus, Trash2, Pencil, Users, MapPin } from "lucide-react";
import { FilterTabs } from "@/components/ui/FilterTabs";
import { ContactNameList } from "@/components/contacts/ContactQuickView";

type Contact = { id: string; name: string };
type Project = { id: string; name: string };

type Travel = {
  id: string;
  title: string;
  category: string;
  status: string;
  priority: string;
  startDate: string;
  endDate: string | null;
  destination: string | null;
  timezone: string;
  purpose: string | null;
  content: string | null;
  projectId: string | null;
  project: { id: string; name: string } | null;
  companions: Array<{ contact: { id: string; name: string } }>;
};

const TRAVEL_CATEGORY_LABELS: Record<string, string> = {
  Leisure: "休闲",
  Research: "科研",
  Work: "工作",
  Family: "家庭",
  Other: "其他",
};

const emptyForm = {
  title: "",
  category: "Leisure",
  status: "Planned",
  priority: "MEDIUM",
  startDate: "",
  endDate: "",
  destination: "",
  timezone: "GMT+8",
  purpose: "",
  content: "",
  projectId: "",
  companionIds: [] as string[],
};

function formatDateRange(start: string, end: string | null) {
  if (!end || end === start) return formatDate(start);
  return `${formatDate(start)} – ${formatDate(end)}`;
}

export default function TravelPage() {
  const [travels, setTravels] = useState<Travel[]>(
    () => peekFetchCache<{ travels: Travel[] }>("/api/travel")?.travels ?? []
  );
  const [contacts, setContacts] = useState<Contact[]>(
    () => peekFetchCache<{ contacts: Contact[] }>("/api/contacts")?.contacts ?? []
  );
  const [projects, setProjects] = useState<Project[]>(
    () => peekFetchCache<Project[]>("/api/projects") ?? []
  );
  const [filter, setFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Travel | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(() => shouldShowPageLoading(["/api/travel"]));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const qs = filter === "upcoming" ? "?upcoming=1" : filter !== "all" ? `?status=${filter}` : "";
    const key = `/api/travel${qs}`;
    if (shouldShowPageLoading([key])) setLoading(true);
    setError(null);
    try {
      const t = await fetchJson<{ travels: Travel[] }>(key);
      setTravels(t.travels);
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

  const openEdit = useCallback((t: Travel) => {
    setEditing(t);
    setForm({
      title: t.title,
      category: t.category,
      status: t.status,
      priority: t.priority,
      startDate: t.startDate,
      endDate: t.endDate || "",
      destination: t.destination || "",
      timezone: t.timezone,
      purpose: t.purpose || "",
      content: t.content || "",
      projectId: t.projectId || "",
      companionIds: t.companions.map((a) => a.contact.id),
    });
    setModalOpen(true);
  }, []);

  useDeepLinkOpen(
    useCallback((id) => {
      const t = travels.find((x) => x.id === id);
      if (t) openEdit(t);
    }, [travels, openEdit]),
    !loading
  );

  const save = async () => {
    const payload = {
      ...form,
      projectId: form.projectId || null,
      companionIds: form.companionIds,
    };
    if (editing) {
      await fetch(`/api/travel/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/travel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setModalOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("删除此旅行？")) return;
    await fetch(`/api/travel/${id}`, { method: "DELETE" });
    load();
  };

  const toggleCompanion = (id: string) => {
    setForm((f) => ({
      ...f,
      companionIds: f.companionIds.includes(id)
        ? f.companionIds.filter((x) => x !== id)
        : [...f.companionIds, id],
    }));
  };

  return (
    <>
      <PageHeader
        title="旅行"
        description="一次旅行一篇档案 — 行程、同行、行前清单与旅途笔记"
        action={<Button onClick={() => { setEditing(null); setForm(emptyForm); setModalOpen(true); }}><Plus className="h-4 w-4" /> 新建旅行</Button>}
      />
      <CachedContent loading={loading} error={error} onRetry={load} hasData={travels.length > 0}>

      <FilterTabs
        tabs={[
          { key: "all", label: "全部" },
          { key: "upcoming", label: "即将到来" },
          { key: "Planned", label: "计划中" },
          { key: "InProgress", label: "进行中" },
          { key: "Completed", label: "已完成" },
        ]}
        value={filter}
        onChange={setFilter}
      />

      {travels.length === 0 ? (
        <EmptyState title="暂无旅行" description="创建旅行档案，记录行程与行前准备" />
      ) : (
        <div className="space-y-3">
          {travels.map((t) => (
            <Card key={t.id} className="hover:border-emerald-200 transition-colors">
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-medium text-zinc-900">{t.title}</span>
                      <Badge className={TRAVEL_STATUS[t.status]?.color}>{TRAVEL_STATUS[t.status]?.label || t.status}</Badge>
                      <Badge className="bg-zinc-100 text-zinc-600">{TRAVEL_CATEGORY_LABELS[t.category] || t.category}</Badge>
                      <Badge className={PROJECT_PRIORITY[t.priority]?.color}>{PROJECT_PRIORITY[t.priority]?.label}</Badge>
                    </div>
                    <p className="text-sm text-zinc-500">
                      {formatDateRange(t.startDate, t.endDate)} · {t.timezone}
                    </p>
                    {t.destination && (
                      <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {t.destination}
                      </p>
                    )}
                    {t.companions.length > 0 && (
                      <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                        <Users className="h-3 w-3 shrink-0" />
                        <ContactNameList
                          people={t.companions.map((a) => ({
                            id: a.contact.id,
                            name: a.contact.name,
                          }))}
                        />
                      </p>
                    )}
                    {t.purpose && <p className="text-sm text-zinc-600 mt-2 truncate">{t.purpose}</p>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="secondary" onClick={() => openEdit(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="secondary" onClick={() => remove(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "编辑旅行" : "新建旅行"} wide>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <Field><Label>标题</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <Label>分类</Label>
              <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {TRAVEL_CATEGORIES.map((c) => <option key={c} value={c}>{TRAVEL_CATEGORY_LABELS[c] || c}</option>)}
              </Select>
            </Field>
            <Field>
              <Label>状态</Label>
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {Object.entries(TRAVEL_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field><Label>出发日期</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
            <Field><Label>返回日期</Label><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></Field>
          </div>
          <Field><Label>目的地</Label><Input value={form.destination} placeholder="东京" onChange={(e) => setForm({ ...form, destination: e.target.value })} /></Field>
          <Field><Label>概要</Label><Input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></Field>
          <Field>
            <Label>同行人</Label>
            <div className="flex flex-wrap gap-2 mt-1 max-h-24 overflow-y-auto">
              {contacts.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCompanion(c.id)}
                  className={`px-2 py-1 rounded-lg text-xs border ${form.companionIds.includes(c.id) ? "bg-emerald-50 border-emerald-300 text-emerald-700" : "border-zinc-200 text-zinc-600"}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </Field>
          <Field>
            <Label>关联项目</Label>
            <Select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}>
              <option value="">无</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field><Label>行程 / 行前清单 / 旅途笔记（Markdown）</Label><Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="min-h-[200px] font-mono text-sm" /></Field>
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
