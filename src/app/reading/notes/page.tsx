"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PageHeader } from "@/components/layout/PageHeader";
import { IronLawsBanner } from "@/components/layout/IronLawsBanner";
import { ReadingSubNav } from "@/components/reading/ReadingSubNav";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Input, Label, Field, Select } from "@/components/ui/Input";
import { MarkdownEditor } from "@/components/ui/MarkdownEditor";
import {
  CachedContent,
  PageSkeleton,
  fetchJson,
  invalidateFetchCache,
  peekFetchCache,
  shouldShowPageLoading,
} from "@/components/ui/PageState";
import {
  inferReadingTag,
  BOOK_CHAPTER_TEMPLATE,
  INFO_CLIP_TEMPLATE,
  SCIENCE_CLIP_TEMPLATE,
  READING_PROJECT_KEYS,
  READING_PROJECT_MATCH,
  readingStructuralColor,
  readingStructuralLabel,
  readingTagsForProject,
  getReadingTagDef,
  isReadingStructuralType,
  type ReadingNoteDto,
  type ReadingPayload,
  type ReadingProjectKey,
} from "@/lib/reading";
import { cn, formatDateTime } from "@/lib/utils";
import {
  BookMarked,
  ExternalLink,
  FolderKanban,
  Pin,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { UI_COPY } from "@/lib/ui-copy";

type TabKey = "all" | ReadingProjectKey;
type TagFilter = "all" | "system" | string;

function noteLane(note: ReadingNoteDto): ReadingProjectKey | null {
  return note.projectKey === "learning" ? null : note.projectKey;
}

function noteDisplayTag(note: ReadingNoteDto) {
  if (isReadingStructuralType(note.type)) {
    return {
      label: readingStructuralLabel(note.type),
      color: readingStructuralColor(note.type),
      isStructural: true,
    };
  }
  const lane = noteLane(note);
  const def = lane ? getReadingTagDef(lane, note.readingTag) : null;
  return {
    label: def?.label ?? "未分类",
    color: def?.color ?? "bg-zinc-100 text-zinc-600",
    isStructural: false,
  };
}

function noteMatchesTagFilter(note: ReadingNoteDto, tagFilter: TagFilter) {
  if (tagFilter === "all") return true;
  if (tagFilter === "system") return isReadingStructuralType(note.type);
  if (isReadingStructuralType(note.type)) return false;
  const lane = noteLane(note);
  const tag = note.readingTag ?? (lane ? inferReadingTag(lane, note.title, note.content) : "other");
  return tag === tagFilter;
}

export default function ReadingNotesPage() {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="阅读笔记" description="Inbox · Learning · 按分类 / 信息源 / 主题筛选与摘录" />
          <PageSkeleton />
        </>
      }
    >
      <ReadingNotesInner />
    </Suspense>
  );
}

function ReadingNotesInner() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<ReadingPayload | null>(() =>
    peekFetchCache<ReadingPayload>("/api/reading")
  );
  const [loading, setLoading] = useState(() => shouldShowPageLoading(["/api/reading"]));
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("all");
  const [tagFilter, setTagFilter] = useState<TagFilter>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [captureForm, setCaptureForm] = useState({
    projectKey: "deep-books" as ReadingProjectKey,
    readingTag: "",
    title: "",
    content: BOOK_CHAPTER_TEMPLATE,
  });

  const [editDraft, setEditDraft] = useState<{
    title: string;
    content: string;
    readingTag: string;
    pinned: boolean;
  } | null>(null);

  const load = useCallback(async (force = false) => {
    if (force) invalidateFetchCache("/api/reading");
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

  useEffect(() => {
    const project = searchParams.get("project");
    const tag = searchParams.get("tag");
    const note = searchParams.get("note");
    if (project && (READING_PROJECT_KEYS as readonly string[]).includes(project)) {
      setTab(project as ReadingProjectKey);
    }
    if (tag) setTagFilter(tag);
    if (note) setActiveId(note);
  }, [searchParams]);

  const tagOptions = useMemo(() => {
    const keys: ReadingProjectKey[] =
      tab === "all" ? [...READING_PROJECT_KEYS] : [tab];
    const seen = new Set<string>();
    const options: Array<{ id: string; label: string; color: string; projectKey: ReadingProjectKey }> = [];
    for (const key of keys) {
      for (const t of readingTagsForProject(key)) {
        if (seen.has(t.id)) continue;
        seen.add(t.id);
        options.push({ ...t, projectKey: key });
      }
    }
    return options;
  }, [tab]);

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    let systemCount = 0;
    for (const note of data?.notes ?? []) {
      if (tab !== "all" && note.projectKey !== tab) continue;
      if (isReadingStructuralType(note.type)) {
        systemCount++;
        continue;
      }
      const lane = noteLane(note);
      const tag = note.readingTag ?? (lane ? inferReadingTag(lane, note.title, note.content) : "other");
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return { counts, systemCount };
  }, [data?.notes, tab]);

  const visibleTagFilters = useMemo(() => {
    return tagOptions.filter((t) => (tagCounts.counts.get(t.id) ?? 0) > 0);
  }, [tagOptions, tagCounts]);

  const filteredNotes = useMemo(() => {
    let list = data?.notes ?? [];
    if (tab !== "all") list = list.filter((n) => n.projectKey === tab);
    list = list.filter((n) => noteMatchesTagFilter(n, tagFilter));
    return list;
  }, [data?.notes, tab, tagFilter]);

  const activeNote = filteredNotes.find((n) => n.id === activeId) ?? filteredNotes[0] ?? null;

  useEffect(() => {
    if (activeNote) {
      const isStructural = isReadingStructuralType(activeNote.type);
      setEditDraft({
        title: activeNote.title,
        content: activeNote.content || "",
        readingTag:
          activeNote.readingTag ??
          (isStructural
            ? ""
            : (() => {
                const lane = noteLane(activeNote);
                return lane ? inferReadingTag(lane, activeNote.title, activeNote.content) : "";
              })()),
        pinned: activeNote.pinned,
      });
      setActiveId(activeNote.id);
    } else {
      setEditDraft(null);
    }
  }, [activeNote?.id]);

  const templateFor = (projectKey: ReadingProjectKey) => {
    if (projectKey === "deep-books") return BOOK_CHAPTER_TEMPLATE;
    if (projectKey === "science-info") return SCIENCE_CLIP_TEMPLATE;
    return INFO_CLIP_TEMPLATE;
  };

  const openCapture = (projectKey: ReadingProjectKey = "deep-books") => {
    setCaptureForm({
      projectKey,
      readingTag: "",
      title: "",
      content: templateFor(projectKey),
    });
    setCaptureOpen(true);
  };

  const submitCapture = async () => {
    setSaving(true);
    const readingTag =
      captureForm.readingTag ||
      inferReadingTag(captureForm.projectKey, captureForm.title, captureForm.content);
    const res = await fetch("/api/reading", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectKey: captureForm.projectKey,
        readingTag,
        title: captureForm.title || "未命名摘录",
        content: captureForm.content,
      }),
    });
    if (res.ok) {
      const note = (await res.json()) as ReadingNoteDto;
      setCaptureOpen(false);
      setActiveId(note.id);
      void load(true);
    }
    setSaving(false);
  };

  const saveEdit = async () => {
    if (!activeNote || !editDraft) return;
    setSaving(true);
    const payload: Record<string, unknown> = {
      title: editDraft.title,
      content: editDraft.content,
      pinned: editDraft.pinned,
    };
    if (!isReadingStructuralType(activeNote.type)) {
      payload.readingTag = editDraft.readingTag || null;
    }
    await fetch(`/api/notes/${activeNote.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    invalidateFetchCache("/api/reading");
    setSaving(false);
    void load(true);
  };

  const deleteNote = async (id: string) => {
    if (!confirm("删除这条笔记？")) return;
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
    if (activeId === id) setActiveId(null);
    void load(true);
  };

  const projects = data?.projects ?? [];
  const activeIsStructural = activeNote ? isReadingStructuralType(activeNote.type) : false;
  const captureTags = readingTagsForProject(captureForm.projectKey);

  return (
    <>
      <PageHeader
        title="阅读笔记"
        description="Inbox · Learning · 按分类 / 信息源 / 主题筛选与摘录"
        action={
          <Button
            size="sm"
            onClick={() => openCapture(tab === "all" ? "deep-books" : tab)}
          >
            <Plus className="h-4 w-4" /> 读书笔记
          </Button>
        }
      />

      <CachedContent loading={loading} error={error} onRetry={() => load(true)} hasData={!!data}>
      <ReadingSubNav />
      <IronLawsBanner compact />

      <div className="grid grid-cols-1 gap-3 mb-6 sm:grid-cols-2">
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
                <Link href={`/projects?id=${p.id}`} className="ml-auto text-indigo-600 hover:underline flex items-center gap-0.5">
                  打开 Learning <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        <Button variant={tab === "all" ? "primary" : "secondary"} size="sm" onClick={() => { setTab("all"); setTagFilter("all"); }}>
          全部
        </Button>
        {READING_PROJECT_KEYS.map((key) => (
          <Button
            key={key}
            variant={tab === key ? "primary" : "secondary"}
            size="sm"
            onClick={() => { setTab(key); setTagFilter("all"); }}
          >
            {READING_PROJECT_MATCH[key].label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-6 items-center">
        <Button variant={tagFilter === "all" ? "primary" : "secondary"} size="sm" onClick={() => setTagFilter("all")}>
          全部
        </Button>
        {tagCounts.systemCount > 0 && (
          <Button variant={tagFilter === "system" ? "primary" : "secondary"} size="sm" onClick={() => setTagFilter("system")}>
            系统 {tagCounts.systemCount}
          </Button>
        )}
        {visibleTagFilters.map((t) => (
          <button
            key={`${t.projectKey}-${t.id}`}
            type="button"
            onClick={() => setTagFilter(t.id)}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full font-medium transition-colors border",
              tagFilter === t.id
                ? "ring-2 ring-indigo-400 ring-offset-1 border-transparent"
                : "border-zinc-200 hover:border-zinc-300",
              t.color
            )}
          >
            {t.label}
            <span className="ml-1 opacity-70">{tagCounts.counts.get(t.id)}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-4 min-h-[520px] border border-zinc-200 rounded-2xl overflow-hidden bg-white shadow-sm">
        <div className="w-full lg:w-[300px] shrink-0 border-b lg:border-b-0 lg:border-r border-zinc-100 flex flex-col max-h-[360px] lg:max-h-none">
          <div className="px-3 py-2.5 border-b border-zinc-100 text-xs font-semibold text-zinc-500 flex items-center gap-2">
            <BookMarked className="h-3.5 w-3.5" />
            {filteredNotes.length} 条
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredNotes.length === 0 ? (
              <p className="text-sm text-zinc-400 p-6 text-center">
                暂无笔记 — 点「快速摘录」开始
              </p>
            ) : (
              filteredNotes.map((note) => {
                const badge = noteDisplayTag(note);
                return (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => setActiveId(note.id)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 border-b border-zinc-50 hover:bg-zinc-50 transition-colors",
                      activeId === note.id && "bg-indigo-50/80 border-l-2 border-l-indigo-500"
                    )}
                  >
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      {note.pinned && <Pin className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />}
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", badge.color)}>
                        {badge.label}
                      </span>
                      <span className="text-[10px] text-zinc-400 truncate">
                        {note.projectName}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-zinc-900 truncate">{note.title}</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">{formatDateTime(note.updatedAt)}</p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col min-h-[400px]">
          {!activeNote || !editDraft ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-zinc-400 p-8">
              <Sparkles className="h-10 w-10 opacity-40" />
              <p className="text-sm">选一条笔记，或快速摘录新信息</p>
              <Button size="sm" variant="secondary" onClick={() => openCapture()}>
                <Plus className="h-4 w-4" /> 快速摘录
              </Button>
            </div>
          ) : (
            <>
              <div className="flex-shrink-0 px-4 py-3 border-b border-zinc-100 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={editDraft.title}
                    onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })}
                    className="font-medium flex-1 min-w-[160px]"
                  />
                  {!activeIsStructural && noteLane(activeNote) && (
                    <Select
                      value={editDraft.readingTag}
                      onChange={(e) => setEditDraft({ ...editDraft, readingTag: e.target.value })}
                      className="w-40 text-sm"
                      title={noteLane(activeNote) === "science-info" ? "主题" : "信息源"}
                    >
                      {readingTagsForProject(noteLane(activeNote)!).map((t) => (
                        <option key={t.id} value={t.id}>{t.label}</option>
                      ))}
                    </Select>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditDraft({ ...editDraft, pinned: !editDraft.pinned })}
                    className={cn(
                      "p-2 rounded-lg",
                      editDraft.pinned ? "text-amber-500 bg-amber-50" : "text-zinc-400 hover:bg-zinc-100"
                    )}
                  >
                    <Pin className={cn("h-4 w-4", editDraft.pinned && "fill-current")} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteNote(activeNote.id)}
                    className="p-2 rounded-lg text-zinc-400 hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <Link
                    href={`/projects?id=${activeNote.projectId}`}
                    className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-100"
                    title="打开项目"
                  >
                    <FolderKanban className="h-4 w-4" />
                  </Link>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-zinc-400">
                    {activeNote.projectName}
                    {!activeIsStructural && editDraft.readingTag && noteLane(activeNote) && (
                      <> · {getReadingTagDef(noteLane(activeNote)!, editDraft.readingTag)?.label}</>
                    )}
                  </span>
                  <Button size="sm" onClick={() => void saveEdit()} disabled={saving}>
                    {saving ? "保存中…" : "保存"}
                  </Button>
                </div>
              </div>
              <div className="flex-1 min-h-0 p-4">
                <MarkdownEditor
                  value={editDraft.content}
                  onChange={(content) => setEditDraft({ ...editDraft, content })}
                  fillHeight
                />
              </div>
            </>
          )}
        </div>
      </div>

      <Card className="mt-6 border-indigo-100 bg-indigo-50/30">
        <CardContent className="pt-4 pb-4 text-sm text-zinc-600 markdown-preview">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {`**标签怎么用**

全部笔记都在 **Learning** 项目里，用上面的分类筛选：

- **Info Reading**：按 **信息源** 筛选（${UI_COPY.reading.infoSourceExamples}）— 正文 \`## 信息源\` 一行可自动识别
- **Science Info**：按 **主题** 筛选（半导体、工业 4.0、电路…）— 书太多，不按单本书打标签
- **系统**：Learning 里的流程笔记（Info / Science / 深读书 SOP）

本页 = Learning Inbox；深读笔记选源/选主题，周六 Info 输出 / Science 日历跟读。`}
          </ReactMarkdown>
        </CardContent>
      </Card>

      <Modal open={captureOpen} onClose={() => setCaptureOpen(false)} title="快速摘录" wide>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Field>
              <Label>分类</Label>
              <Select
                value={captureForm.projectKey}
                onChange={(e) => {
                  const projectKey = e.target.value as ReadingProjectKey;
                  setCaptureForm({
                    projectKey,
                    readingTag: "",
                    title: captureForm.title,
                    content: templateFor(projectKey),
                  });
                }}
              >
                {READING_PROJECT_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {READING_PROJECT_MATCH[key].label}
                  </option>
                ))}
              </Select>
            </Field>
            {captureForm.projectKey !== "deep-books" && (
              <Field>
                <Label>
                  {captureForm.projectKey === "science-info" ? "主题" : "信息源"}
                </Label>
                <Select
                  value={captureForm.readingTag}
                  onChange={(e) => setCaptureForm({ ...captureForm, readingTag: e.target.value })}
                >
                  <option value="">自动识别</option>
                  {captureTags.map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
          <Field>
            <Label>标题</Label>
            <Input
              value={captureForm.title}
              onChange={(e) => setCaptureForm({ ...captureForm, title: e.target.value })}
              placeholder="文章/视频/章节标题"
              autoFocus
            />
          </Field>
          <Field>
            <Label>内容</Label>
            <MarkdownEditor
              value={captureForm.content}
              onChange={(content) => setCaptureForm({ ...captureForm, content })}
              minHeight={240}
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={() => setCaptureOpen(false)}>
            取消
          </Button>
          <Button onClick={() => void submitCapture()} disabled={saving}>
            {saving ? "保存中…" : "存入 Inbox"}
          </Button>
        </div>
      </Modal>
      </CachedContent>
    </>
  );
}
