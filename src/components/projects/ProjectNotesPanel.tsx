"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Select, Label } from "@/components/ui/Input";
import { MarkdownEditor } from "@/components/ui/MarkdownEditor";
import {
  PROJECT_NOTE_TYPES,
  PROJECT_NOTE_TEMPLATES,
  cn,
  formatDateTime,
} from "@/lib/utils";
import {
  Plus,
  Pin,
  Trash2,
  Copy,
  GripVertical,
  FileText,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import Link from "next/link";
import {
  type ProjectNote,
  sortProjectNotes,
} from "@/lib/project-notes";

export type { ProjectNote } from "@/lib/project-notes";

type NoteDraft = {
  title: string;
  content: string;
  type: string;
  pinned: boolean;
};

type ProjectNotesPanelProps = {
  projectId: string | null;
  notes: ProjectNote[];
  activeNoteId: string | null;
  onNotesChange: (notes: ProjectNote[]) => void;
  onActiveNoteChange: (id: string | null) => void;
};

function sortNotes(list: ProjectNote[]) {
  return sortProjectNotes(list);
}

export function ProjectNotesPanel({
  projectId,
  notes,
  activeNoteId,
  onNotesChange,
  onActiveNoteChange,
}: ProjectNotesPanelProps) {
  const [draft, setDraft] = useState<NoteDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [dragNoteId, setDragNoteId] = useState<string | null>(null);
  const [dropNoteId, setDropNoteId] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sortedNotes = useMemo(() => sortNotes(notes), [notes]);
  const activeNote = sortedNotes.find((n) => n.id === activeNoteId) ?? null;

  useEffect(() => {
    if (activeNote) {
      setDraft({
        title: activeNote.title,
        content: activeNote.content || "",
        type: activeNote.type,
        pinned: activeNote.pinned,
      });
      setDirty(false);
    } else {
      setDraft(null);
      setDirty(false);
    }
  }, [activeNote?.id, activeNote?.updatedAt]);

  const persistNote = useCallback(
    async (noteId: string, data: NoteDraft) => {
      if (!projectId) return;
      setSaving(true);
      try {
        const res = await fetch(`/api/notes/${noteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: data.title.trim() || "未命名笔记",
            content: data.content || null,
            type: data.type,
            pinned: data.pinned,
          }),
        });
        if (!res.ok) throw new Error("保存失败");
        const updated = (await res.json()) as ProjectNote;
        onNotesChange(sortNotes(notes.map((n) => (n.id === noteId ? { ...n, ...updated } : n))));
        setDirty(false);
      } finally {
        setSaving(false);
      }
    },
    [projectId, notes, onNotesChange]
  );

  const scheduleSave = useCallback(
    (noteId: string, data: NoteDraft) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => persistNote(noteId, data), 800);
    },
    [persistNote]
  );

  const updateDraft = (patch: Partial<NoteDraft>) => {
    if (!draft || !activeNoteId) return;
    const next = { ...draft, ...patch };
    setDraft(next);
    setDirty(true);
    scheduleSave(activeNoteId, next);
  };

  const createNote = async (type: string) => {
    if (!projectId) return;
    setAddOpen(false);
    const tpl = PROJECT_NOTE_TEMPLATES[type] || PROJECT_NOTE_TEMPLATES.note;
    const res = await fetch(`/api/projects/${projectId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: tpl.title,
        content: tpl.content.replace("{{date}}", new Date().toISOString().slice(0, 10)),
        type,
      }),
    });
    if (!res.ok) return;
    const created = (await res.json()) as ProjectNote;
    const next = sortNotes([...notes, created]);
    onNotesChange(next);
    onActiveNoteChange(created.id);
  };

  const deleteNote = async (noteId: string) => {
    if (!confirm("确定删除此笔记？")) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await fetch(`/api/notes/${noteId}`, { method: "DELETE" });
    const next = notes.filter((n) => n.id !== noteId);
    onNotesChange(next);
    if (activeNoteId === noteId) {
      onActiveNoteChange(next[0]?.id ?? null);
    }
  };

  const duplicateNote = async (note: ProjectNote) => {
    if (!projectId) return;
    const res = await fetch(`/api/projects/${projectId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: `${note.title}（副本）`,
        content: note.content,
        type: note.type,
      }),
    });
    if (!res.ok) return;
    const created = (await res.json()) as ProjectNote;
    onNotesChange(sortNotes([...notes, created]));
    onActiveNoteChange(created.id);
  };

  const reorderNotes = async (fromId: string, toId: string) => {
    if (!projectId || fromId === toId) return;
    const list = [...sortedNotes];
    const fromIdx = list.findIndex((n) => n.id === fromId);
    const toIdx = list.findIndex((n) => n.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [item] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, item);
    const reordered = list.map((n, i) => ({ ...n, sortOrder: i }));
    onNotesChange(reordered);
    await fetch(`/api/projects/${projectId}/notes/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: reordered.map((n) => n.id) }),
    });
  };

  const charCount = draft?.content.length ?? 0;

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-400 p-6 text-center">
        保存项目后可添加项目笔记
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      {/* 编辑器 */}
      <div className="flex-1 min-w-0 flex flex-col bg-zinc-50/40 border-r border-zinc-100">
        {!activeNote || !draft ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-zinc-400 p-8">
            <FileText className="h-10 w-10 opacity-40" />
            <p className="text-sm">选择或新建一条项目笔记</p>
            <Button size="sm" variant="secondary" onClick={() => createNote("overview")}>
              <Plus className="h-4 w-4" /> 新建概览
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-shrink-0 px-4 py-3 border-b border-zinc-100 bg-white/80 space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  value={draft.title}
                  onChange={(e) => updateDraft({ title: e.target.value })}
                  className="font-medium flex-1"
                  placeholder="笔记标题"
                />
                <Select
                  value={draft.type}
                  onChange={(e) => updateDraft({ type: e.target.value })}
                  className="w-28 shrink-0 text-sm"
                >
                  {Object.entries(PROJECT_NOTE_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </Select>
                <button
                  type="button"
                  onClick={() => updateDraft({ pinned: !draft.pinned })}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    draft.pinned ? "text-amber-500 bg-amber-50" : "text-zinc-400 hover:bg-zinc-100"
                  )}
                  title={draft.pinned ? "取消置顶" : "置顶"}
                >
                  <Pin className={cn("h-4 w-4", draft.pinned && "fill-current")} />
                </button>
                <button
                  type="button"
                  onClick={() => duplicateNote(activeNote)}
                  className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-100"
                  title="复制"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteNote(activeNote.id)}
                  className="p-2 rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-500"
                  title="删除"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <Link
                  href={`/notes?id=${activeNote.id}`}
                  className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-100"
                  title="在笔记页打开"
                >
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </div>
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span>
                  {saving ? "保存中…" : dirty ? "未保存更改" : "已保存"}
                  {" · "}{charCount} 字
                </span>
                <span>更新于 {formatDateTime(activeNote.updatedAt)}</span>
              </div>
            </div>
            <div className="flex-1 min-h-0 p-4">
              <MarkdownEditor
                label=""
                value={draft.content}
                onChange={(content) => updateDraft({ content })}
                placeholder="项目笔记支持 Markdown…"
                fillHeight
              />
            </div>
          </>
        )}
      </div>

      {/* 笔记列表（最右侧） */}
      <div className="w-[240px] shrink-0 flex flex-col bg-white border-l border-zinc-100">
        <div className="flex-shrink-0 px-3 py-2.5 border-b border-zinc-100 flex items-center justify-between gap-1">
          <Label className="mb-0 text-xs font-semibold text-zinc-700">项目笔记</Label>
          <div className="relative">
            <Button size="sm" variant="secondary" className="h-7 px-2 text-xs" onClick={() => setAddOpen((v) => !v)}>
              <Plus className="h-3.5 w-3.5" />
              <ChevronDown className="h-3 w-3" />
            </Button>
            {addOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setAddOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 w-36 rounded-lg border border-zinc-200 bg-white shadow-lg py-1">
                  {Object.entries(PROJECT_NOTE_TYPES).map(([k, v]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => createNote(k)}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-zinc-50 text-zinc-700"
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {sortedNotes.length === 0 ? (
            <p className="text-xs text-zinc-400 p-4 text-center">暂无笔记</p>
          ) : (
            sortedNotes.map((note) => {
              const typeMeta = PROJECT_NOTE_TYPES[note.type] || PROJECT_NOTE_TYPES.note;
              const isActive = note.id === activeNoteId;
              const isDragging = dragNoteId === note.id;
              const isDropTarget = dropNoteId === note.id && dragNoteId !== note.id;
              return (
                <div
                  key={note.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDropNoteId(note.id);
                  }}
                  onDragLeave={() => setDropNoteId((id) => (id === note.id ? null : id))}
                  onDrop={(e) => {
                    e.preventDefault();
                    const fromId = e.dataTransfer.getData("text/plain");
                    if (fromId) reorderNotes(fromId, note.id);
                    setDragNoteId(null);
                    setDropNoteId(null);
                  }}
                  className={cn(
                    "border-b border-zinc-50 transition-colors",
                    isActive && "bg-indigo-50/80",
                    isDropTarget && "ring-1 ring-inset ring-indigo-300",
                    isDragging && "opacity-40"
                  )}
                >
                  <div className="flex items-center gap-0.5 px-1 py-0.5">
                    <span
                      draggable
                      onDragStart={(e) => {
                        setDragNoteId(note.id);
                        e.dataTransfer.setData("text/plain", note.id);
                      }}
                      onDragEnd={() => {
                        setDragNoteId(null);
                        setDropNoteId(null);
                      }}
                      className="cursor-grab active:cursor-grabbing p-0.5 text-zinc-300 hover:text-zinc-500 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <GripVertical className="h-3 w-3" />
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (dirty && activeNoteId && draft) {
                          void persistNote(activeNoteId, draft);
                        }
                        onActiveNoteChange(note.id);
                      }}
                      className="flex-1 min-w-0 flex items-center gap-1 px-1 py-1 rounded-md hover:bg-zinc-50/80"
                    >
                      {note.pinned && <Pin className="h-2.5 w-2.5 text-amber-500 fill-amber-400 shrink-0" />}
                      <Badge className={cn("text-[9px] px-1 py-0 leading-tight shrink-0", typeMeta.color)}>
                        {typeMeta.label}
                      </Badge>
                      <span
                        className={cn(
                          "flex-1 min-w-0 text-xs font-medium truncate leading-tight",
                          isActive ? "text-indigo-800" : "text-zinc-800"
                        )}
                      >
                        {note.title}
                      </span>
                      <span className="text-[9px] text-zinc-400 shrink-0 tabular-nums leading-none">
                        {formatDateTime(note.updatedAt).slice(5, 10)}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
