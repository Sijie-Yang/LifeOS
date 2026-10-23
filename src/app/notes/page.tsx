"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge, EmptyState } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea, Label, Field } from "@/components/ui/Input";
import { formatDateTime } from "@/lib/utils";
import { Plus, Pin, Trash2 } from "lucide-react";
import {
  CachedContent,
  fetchJson,
  peekFetchCache,
  shouldShowPageLoading,
} from "@/components/ui/PageState";
import { useDeepLinkOpen } from "@/lib/useDeepLink";

type Note = {
  id: string;
  title: string;
  content: string | null;
  type: string;
  projectId: string | null;
  project: { id: string; name: string } | null;
  pinned: boolean;
  updatedAt: string;
};

type Project = { id: string; name: string };

const NOTE_TYPES: Record<string, string> = {
  note: "笔记",
  idea: "灵感",
  sop: "SOP",
};

const emptyForm = { title: "", content: "", type: "note", projectId: "", pinned: false };

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>(() => peekFetchCache<Note[]>("/api/notes") ?? []);
  const [projects, setProjects] = useState<Project[]>(
    () => peekFetchCache<Project[]>("/api/projects") ?? []
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(() => shouldShowPageLoading(["/api/notes"]));
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (shouldShowPageLoading(["/api/notes"])) setLoading(true);
    setError(null);
    try {
      const notesData = await fetchJson<Note[]>("/api/notes");
      setNotes(notesData);
      const projs = await fetchJson<Project[]>("/api/projects");
      setProjects(projs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = useCallback((n: Note) => {
    setEditing(n);
    setForm({
      title: n.title,
      content: n.content || "",
      type: n.type,
      projectId: n.projectId || "",
      pinned: n.pinned,
    });
    setModalOpen(true);
  }, []);

  useDeepLinkOpen(
    useCallback(
      (id) => {
        const n = notes.find((x) => x.id === id);
        if (n) openEdit(n);
      },
      [notes, openEdit]
    ),
    !loading && notes.length > 0
  );

  const filtered = filter === "all" ? notes : notes.filter((n) => n.type === filter);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const save = async () => {
    const payload = { ...form, projectId: form.projectId || null };
    if (editing) {
      await fetch(`/api/notes/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setModalOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("确定删除？")) return;
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
    load();
  };

  const togglePin = async (n: Note) => {
    await fetch(`/api/notes/${n.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !n.pinned }),
    });
    load();
  };

  return (
    <>
      <PageHeader
        title="笔记"
        description="想法、灵感、SOP 与项目相关笔记"
        action={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> 新建笔记
          </Button>
        }
      />
      <CachedContent loading={loading} error={error} onRetry={load} hasData={notes.length > 0}>

      <div className="flex gap-2 mb-6">
        {["all", ...Object.keys(NOTE_TYPES)].map((key) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-1.5 rounded-full text-sm transition-all ${
              filter === key ? "bg-indigo-50 text-indigo-700" : "text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {key === "all" ? "全部" : NOTE_TYPES[key]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        notes.length === 0 ? (
          <EmptyState title="暂无笔记" description="记录你的灵感和思考" />
        ) : (
          <EmptyState title="该类型暂无笔记" description="切换其他类型或新建笔记" />
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((n) => (
            <Card
              key={n.id}
              className={`cursor-pointer hover:border-zinc-300 transition-colors ${n.pinned ? "border-amber-300 bg-amber-50/50" : ""}`}
              onClick={() => openEdit(n)}
            >
              <CardContent className="pt-5">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-zinc-900 line-clamp-1">{n.title}</h3>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); togglePin(n); }}
                      className={`p-1 rounded ${n.pinned ? "text-amber-500" : "text-zinc-400 hover:text-zinc-600"}`}
                    >
                      <Pin className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); remove(n.id); }}
                      className="p-1 rounded text-zinc-400 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="flex gap-2 mb-3">
                  <Badge className="bg-zinc-100 text-zinc-600">{NOTE_TYPES[n.type] ?? n.type}</Badge>
                  {n.project && (
                    <Badge className="bg-indigo-100 text-indigo-700">{n.project.name}</Badge>
                  )}
                </div>
                {n.content && (
                  <p className="text-sm text-zinc-500 line-clamp-3 mb-3">{n.content}</p>
                )}
                <p className="text-xs text-zinc-400">{formatDateTime(n.updatedAt)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "编辑笔记" : "新建笔记"} wide>
        <div className="space-y-4">
          <Field>
            <Label>标题 *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <Label>类型</Label>
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {Object.entries(NOTE_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
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
          <Field>
            <Label>内容</Label>
            <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} className="min-h-[200px]" />
          </Field>
          <label className="flex items-center gap-2 text-sm text-zinc-600 cursor-pointer">
            <input
              type="checkbox"
              checked={form.pinned}
              onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
              className="accent-indigo-500"
            />
            置顶
          </label>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>取消</Button>
          <Button onClick={save} disabled={!form.title}>保存</Button>
        </div>
      </Modal>

      </CachedContent>
    </>
  );
}
