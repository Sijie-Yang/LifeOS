"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge, EmptyState } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea, Label, Field } from "@/components/ui/Input";
import {
  CachedContent,
  fetchJson,
  invalidateFetchCache,
  peekFetchCache,
  shouldShowPageLoading,
} from "@/components/ui/PageState";
import { FilterTabs } from "@/components/ui/FilterTabs";
import {
  LIBRARY_KIND_LABEL,
  LIBRARY_KINDS,
  LIBRARY_STATUS_LABEL,
  LIBRARY_STATUSES,
  LIBRARY_CATEGORIES,
  categoriesForKind,
  extractLibraryCategory,
  libraryCategoryDef,
  withLibraryCategory,
} from "@/lib/library-meta";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  ExternalLink,
  FolderOpen,
  Link2,
  Pin,
  Plus,
  RefreshCw,
  Trash2,
  Pencil,
  FileText,
} from "lucide-react";
import { UI_COPY } from "@/lib/ui-copy";

type Project = { id: string; name: string; status: string };

type LibraryDoc = {
  id: string;
  title: string;
  authors: string | null;
  year: string | null;
  kind: string;
  status: string;
  relativePath: string | null;
  sourceUrl: string | null;
  doi: string | null;
  whySelected: string | null;
  notes: string | null;
  tags: string[];
  pinned: boolean;
  projects: Array<{
    role: string | null;
    project: { id: string; name: string; status: string };
  }>;
};

type ScanFile = {
  relativePath: string;
  name: string;
  ext: string;
  size: number;
  linked: boolean;
  documentId: string | null;
};

type KindFilter = "all" | "book" | "paper" | "other";

const emptyForm = {
  title: "",
  authors: "",
  year: "",
  kind: "paper",
  status: "to_read",
  category: "",
  relativePath: "",
  sourceUrl: "",
  doi: "",
  whySelected: "",
  notes: "",
  tags: "",
  projectIds: [] as string[],
  pinned: false,
};

function isOtherKind(kind: string) {
  return kind !== "book" && kind !== "paper";
}

function DocRow({
  doc,
  onEdit,
  onRemove,
}: {
  doc: LibraryDoc;
  onEdit: (doc: LibraryDoc) => void;
  onRemove: (id: string) => void;
}) {
  const st = LIBRARY_STATUS_LABEL[doc.status] ?? LIBRARY_STATUS_LABEL.to_read;
  const categoryId = extractLibraryCategory(doc.tags);
  const category = libraryCategoryDef(categoryId);
  const extraTags = doc.tags.filter((t) => t !== categoryId && t !== "深读书");
  const projectLabels = doc.projects.map((x) => x.project.name.replace(/^20\d{2}_/, ""));

  return (
    <div
      className="group flex items-center gap-2 px-3 py-2 hover:bg-amber-50/40 cursor-pointer"
      onClick={() => onEdit(doc)}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          {doc.pinned && <Pin className="h-3 w-3 shrink-0 text-amber-600" />}
          <span className="text-sm font-medium text-zinc-900 truncate max-w-full sm:max-w-[55%]">
            {doc.title}
          </span>
          {category && (
            <Badge className={cn(category.color, "shrink-0 text-[10px] px-1.5 py-0")}>
              {category.label}
            </Badge>
          )}
          <Badge className={cn(st.color, "shrink-0 text-[10px] px-1.5 py-0")}>{st.label}</Badge>
          {doc.year && <span className="shrink-0 text-[11px] text-zinc-400">{doc.year}</span>}
        </div>
        <div className="flex items-center gap-2 min-w-0 text-[11px] text-zinc-500 mt-0.5 flex-wrap">
          {doc.authors && <span className="truncate max-w-[36%]">{doc.authors}</span>}
          {extraTags.slice(0, 4).map((t) => (
            <span
              key={t}
              className="shrink-0 rounded bg-zinc-100 px-1.5 py-0 text-[10px] text-zinc-600"
            >
              {t}
            </span>
          ))}
          {doc.whySelected && (
            <span className="truncate text-zinc-600 max-w-[40%]" title={doc.whySelected}>
              {doc.whySelected}
            </span>
          )}
          {projectLabels.length > 0 && (
            <span
              className="shrink-0 truncate max-w-[28%] text-amber-800/80"
              title={projectLabels.join(" · ")}
            >
              <Link2 className="inline h-2.5 w-2.5 mr-0.5" />
              {projectLabels.slice(0, 3).join(" · ")}
              {projectLabels.length > 3 ? ` +${projectLabels.length - 3}` : ""}
            </span>
          )}
        </div>
      </div>
      <div
        className="flex items-center gap-0.5 shrink-0 opacity-70 group-hover:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        {doc.relativePath && (
          <a
            href={`/api/library/${doc.id}/file`}
            target="_blank"
            rel="noreferrer"
            className="p-1.5 rounded hover:bg-zinc-100 text-indigo-600"
            title="打开文件"
          >
            <FileText className="h-3.5 w-3.5" />
          </a>
        )}
        {doc.sourceUrl && (
          <a
            href={doc.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="p-1.5 rounded hover:bg-zinc-100 text-indigo-600"
            title="网页"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        <button
          type="button"
          className="p-1.5 rounded hover:bg-zinc-100 text-zinc-500"
          onClick={() => onEdit(doc)}
          title="编辑"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="p-1.5 rounded hover:bg-zinc-100 text-zinc-500"
          onClick={() => onRemove(doc.id)}
          title="删除"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function LibraryPage() {
  const [documents, setDocuments] = useState<LibraryDoc[]>(
    () => peekFetchCache<{ documents: LibraryDoc[] }>("/api/library")?.documents ?? []
  );
  const [projects, setProjects] = useState<Project[]>(
    () => peekFetchCache<Project[]>("/api/projects") ?? []
  );
  const [root, setRoot] = useState(
    () => peekFetchCache<{ root: string }>("/api/library")?.root ?? ""
  );
  const [statusFilter, setStatusFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [loading, setLoading] = useState(() =>
    shouldShowPageLoading(["/api/library", "/api/projects"])
  );
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [editing, setEditing] = useState<LibraryDoc | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [scanFiles, setScanFiles] = useState<ScanFile[]>([]);
  const [scanLoading, setScanLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const qs = statusFilter !== "all" ? `?status=${statusFilter}` : "";
    const url = `/api/library${qs}`;
    if (shouldShowPageLoading([url, "/api/projects"])) setLoading(true);
    setError(null);
    try {
      const lib = await fetchJson<{ root: string; documents: LibraryDoc[] }>(url);
      setDocuments(lib.documents);
      setRoot(lib.root);
      const p = await fetchJson<Project[]>("/api/projects");
      setProjects(Array.isArray(p) ? p : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = (preset?: Partial<typeof emptyForm>) => {
    setEditing(null);
    setForm({ ...emptyForm, ...preset });
    setModalOpen(true);
  };

  const openEdit = (doc: LibraryDoc) => {
    setEditing(doc);
    const category = extractLibraryCategory(doc.tags) || "";
    const otherTags = doc.tags.filter((t) => t !== category && t !== "深读书");
    setForm({
      title: doc.title,
      authors: doc.authors || "",
      year: doc.year || "",
      kind: doc.kind,
      status: doc.status,
      category,
      relativePath: doc.relativePath || "",
      sourceUrl: doc.sourceUrl || "",
      doi: doc.doi || "",
      whySelected: doc.whySelected || "",
      notes: doc.notes || "",
      tags: otherTags.join(", "),
      projectIds: doc.projects.map((x) => x.project.id),
      pinned: doc.pinned,
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) {
      alert("请填写标题");
      return;
    }
    if (!form.whySelected.trim()) {
      alert("精品库需要写「为何精选」——只收能改变方法/进 Related Work 的文献");
      return;
    }
    setSaving(true);
    try {
      const freeTags = form.tags
        .split(/[,，]/)
        .map((t) => t.trim())
        .filter(Boolean);
      const tags = withLibraryCategory(freeTags, form.category || null);
      if (form.kind === "book" && !tags.includes("深读书")) tags.push("深读书");

      const payload = {
        title: form.title.trim(),
        authors: form.authors || null,
        year: form.year || null,
        kind: form.kind,
        status: form.status,
        relativePath: form.relativePath || null,
        sourceUrl: form.sourceUrl || null,
        doi: form.doi || null,
        whySelected: form.whySelected || null,
        notes: form.notes || null,
        tags,
        projectIds: form.projectIds,
        pinned: form.pinned,
      };
      const res = await fetch(editing ? `/api/library/${editing.id}` : "/api/library", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error || "保存失败");
        return;
      }
      setModalOpen(false);
      invalidateFetchCache("/api/library");
      await load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm(UI_COPY.library.removeConfirm)) return;
    await fetch(`/api/library/${id}`, { method: "DELETE" });
    invalidateFetchCache("/api/library");
    load();
  };

  const toggleProject = (id: string) => {
    setForm((f) => ({
      ...f,
      projectIds: f.projectIds.includes(id)
        ? f.projectIds.filter((x) => x !== id)
        : [...f.projectIds, id],
    }));
  };

  const loadScan = async () => {
    setScanLoading(true);
    try {
      const data = await fetchJson<{ root: string; files: ScanFile[] }>("/api/library?scan=1", {
        force: true,
      });
      setRoot(data.root);
      setScanFiles(data.files);
      setScanOpen(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : "扫描失败");
    } finally {
      setScanLoading(false);
    }
  };

  const importFile = (file: ScanFile) => {
    const name = file.name.toLowerCase();
    const looksBook =
      name.includes("models") ||
      name.includes("engineering") ||
      name.includes("islp") ||
      name.includes("book");
    openCreate({
      title: file.name.replace(/\.[^.]+$/, "").replace(/[_]+/g, " "),
      relativePath: file.relativePath,
      kind: looksBook ? "book" : "paper",
      whySelected: "",
    });
    setScanOpen(false);
  };

  const activeProjects = useMemo(
    () => projects.filter((p) => p.status === "ACTIVE" || p.status === "PLANNING").slice(0, 80),
    [projects]
  );

  const counts = useMemo(() => {
    const book = documents.filter((d) => d.kind === "book").length;
    const paper = documents.filter((d) => d.kind === "paper").length;
    const other = documents.filter((d) => isOtherKind(d.kind)).length;
    return { book, paper, other, all: documents.length };
  }, [documents]);

  const filtered = useMemo(() => {
    return documents.filter((d) => {
      if (kindFilter === "book" && d.kind !== "book") return false;
      if (kindFilter === "paper" && d.kind !== "paper") return false;
      if (kindFilter === "other" && !isOtherKind(d.kind)) return false;
      if (categoryFilter !== "all") {
        const cat = extractLibraryCategory(d.tags);
        if (cat !== categoryFilter) return false;
      }
      return true;
    });
  }, [documents, kindFilter, categoryFilter]);

  const categoryOptions = useMemo(() => {
    if (kindFilter === "book") return LIBRARY_CATEGORIES.filter((c) => c.kinds.includes("book" as never));
    if (kindFilter === "paper") return LIBRARY_CATEGORIES.filter((c) => c.kinds.includes("paper" as never));
    if (kindFilter === "other") {
      return LIBRARY_CATEGORIES.filter((c) =>
        (c.kinds as readonly string[]).some((k) => k !== "book" && k !== "paper")
      );
    }
    return [...LIBRARY_CATEGORIES];
  }, [kindFilter]);

  const sections = useMemo(() => {
    if (kindFilter !== "all") {
      return [{ key: kindFilter, title: null as string | null, docs: filtered }];
    }
    const books = filtered.filter((d) => d.kind === "book");
    const papers = filtered.filter((d) => d.kind === "paper");
    const others = filtered.filter((d) => isOtherKind(d.kind));
    return [
      { key: "book", title: `书 · ${books.length}`, docs: books },
      { key: "paper", title: `论文 · ${papers.length}`, docs: papers },
      { key: "other", title: `其他 · ${others.length}`, docs: others },
    ].filter((s) => s.docs.length > 0);
  }, [filtered, kindFilter]);

  const formCategories = categoriesForKind(form.kind);

  return (
    <>
      <PageHeader
        title="文献库"
        description={UI_COPY.library.description}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void loadScan()} disabled={scanLoading}>
              <RefreshCw className={cn("h-4 w-4", scanLoading && "animate-spin")} />
              扫描文件夹
            </Button>
            <Button onClick={() => openCreate()}>
              <Plus className="h-4 w-4" /> 入库
            </Button>
          </div>
        }
      />

      <CachedContent loading={loading} error={error} onRetry={load} hasData={documents.length > 0}>
      <p className="mb-3 text-[11px] text-zinc-500 truncate" title={root}>
        <FolderOpen className="inline h-3 w-3 mr-1 -mt-0.5" />
        {root || "Reading Library"}
      </p>

      <FilterTabs
        tabs={[
          { key: "all", label: `全部 ${counts.all}` },
          { key: "book", label: `书 ${counts.book}` },
          { key: "paper", label: `论文 ${counts.paper}` },
          { key: "other", label: `其他 ${counts.other}` },
        ]}
        value={kindFilter}
        onChange={(k) => {
          setKindFilter(k as KindFilter);
          setCategoryFilter("all");
        }}
      />

      <div className="flex flex-wrap gap-2 mb-3 mt-1">
        <Button
          size="sm"
          variant={statusFilter === "all" ? "primary" : "secondary"}
          onClick={() => setStatusFilter("all")}
        >
          状态·全部
        </Button>
        {LIBRARY_STATUSES.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? "primary" : "secondary"}
            onClick={() => setStatusFilter(s)}
          >
            {LIBRARY_STATUS_LABEL[s].label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        <button
          type="button"
          onClick={() => setCategoryFilter("all")}
          className={cn(
            "text-xs px-2.5 py-1 rounded-full font-medium border transition-colors",
            categoryFilter === "all"
              ? "ring-2 ring-indigo-400 ring-offset-1 border-transparent bg-zinc-900 text-white"
              : "border-zinc-200 text-zinc-600 hover:border-zinc-300"
          )}
        >
          全部类别
        </button>
        {categoryOptions.map((c) => {
          const n = documents.filter((d) => extractLibraryCategory(d.tags) === c.id).length;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryFilter(c.id)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full font-medium border transition-colors",
                categoryFilter === c.id
                  ? "ring-2 ring-indigo-400 ring-offset-1 border-transparent"
                  : "border-transparent",
                c.color
              )}
            >
              {c.label}
              <span className="ml-1 opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="没有匹配文献"
          description="换筛选条件，或把 PDF 放进 Reading Library 后扫描入库"
        />
      ) : (
        <div className="space-y-6">
          {sections.map((section) => (
            <div key={section.key}>
              {section.title && (
                <h2 className="text-sm font-semibold text-zinc-800 mb-2 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-zinc-400" />
                  {section.title}
                </h2>
              )}
              <div className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
                {section.docs.map((doc) => (
                  <DocRow key={doc.id} doc={doc} onEdit={openEdit} onRemove={remove} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "编辑文献" : "精品入库"}
        wide
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <Field>
            <Label>标题</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field>
            <Label>为何精选（必填）</Label>
            <Textarea
              value={form.whySelected}
              onChange={(e) => setForm({ ...form, whySelected: e.target.value })}
              className="min-h-[72px]"
              placeholder={UI_COPY.library.relevancePlaceholder}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <Label>作者</Label>
              <Input value={form.authors} onChange={(e) => setForm({ ...form, authors: e.target.value })} />
            </Field>
            <Field>
              <Label>年份</Label>
              <Input value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field>
              <Label>类型</Label>
              <Select
                value={form.kind}
                onChange={(e) => {
                  const kind = e.target.value;
                  const cats = categoriesForKind(kind);
                  const keep = cats.some((c) => c.id === form.category);
                  setForm({
                    ...form,
                    kind,
                    category: keep ? form.category : cats[0]?.id || "",
                  });
                }}
              >
                {LIBRARY_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {LIBRARY_KIND_LABEL[k]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field>
              <Label>类别</Label>
              <Select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                <option value="">未分类</option>
                {formCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field>
              <Label>状态</Label>
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {LIBRARY_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {LIBRARY_STATUS_LABEL[s].label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field>
            <Label>相对路径（Reading Library 内）</Label>
            <Input
              value={form.relativePath}
              onChange={(e) => setForm({ ...form, relativePath: e.target.value })}
              placeholder={UI_COPY.library.pathPlaceholder}
              className="font-mono text-xs"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <Label>网页 / arXiv</Label>
              <Input value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} />
            </Field>
            <Field>
              <Label>DOI</Label>
              <Input value={form.doi} onChange={(e) => setForm({ ...form, doi: e.target.value })} />
            </Field>
          </div>
          <Field>
            <Label>关联项目（可多选）</Label>
            <div className="flex flex-wrap gap-2 mt-1 max-h-36 overflow-y-auto">
              {activeProjects.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleProject(p.id)}
                  className={cn(
                    "px-2 py-1 rounded-lg text-xs border",
                    form.projectIds.includes(p.id)
                      ? "bg-amber-50 border-amber-300 text-amber-900"
                      : "border-zinc-200 text-zinc-600"
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </Field>
          <Field>
            <Label>其它标签（逗号分隔，不含主类别）</Label>
            <Input
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="VLN, benchmark, GeoLLM"
            />
          </Field>
          <Field>
            <Label>读后笔记</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="min-h-[100px] font-mono text-sm"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={form.pinned}
              onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
            />
            置顶
          </label>
          <div className="flex gap-2 pt-2">
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "保存中…" : "保存"}
            </Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              取消
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={scanOpen} onClose={() => setScanOpen(false)} title="扫描 Reading Library" wide>
        <div className="space-y-3 max-h-[70vh] overflow-y-auto">
          <p className="text-xs text-zinc-500 break-all">{root}</p>
          {scanFiles.length === 0 ? (
            <EmptyState title="文件夹里还没有文档" description="把 PDF 放进该目录后再扫" />
          ) : (
            scanFiles.map((f) => (
              <div
                key={f.relativePath}
                className="flex items-center justify-between gap-3 rounded-lg border border-zinc-100 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-800 truncate">{f.name}</p>
                  <p className="text-xs text-zinc-400 font-mono truncate">{f.relativePath}</p>
                </div>
                {f.linked ? (
                  <Badge className="bg-emerald-100 text-emerald-700 shrink-0">已入库</Badge>
                ) : (
                  <Button size="sm" onClick={() => importFile(f)}>
                    <BookOpen className="h-3.5 w-3.5" /> 入库
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </Modal>
      </CachedContent>
    </>
  );
}
