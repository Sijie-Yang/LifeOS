"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge, EmptyState, ProgressBar } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Label, Field } from "@/components/ui/Input";
import {
  DataTable,
  TableHead,
  TableHeaderCell,
  DraggableSortableTableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  TableActions,
  TableCount,
} from "@/components/ui/Table";
import {
  formatDate,
  formatYearMonth,
  monthInputToDate,
  PROJECT_PRIORITY,
  PROJECT_STATUS,
  stripProjectYearPrefix,
  toMonthInput,
  cn,
} from "@/lib/utils";
import {
  compareByOrder,
  compareDates,
  compareNumbers,
  compareStrings,
  toggleSortDirection,
  type SortDirection,
} from "@/lib/table-sort";
import { Plus, Trash2, Pencil, Check, X, ExternalLink, GripVertical, Pin, CalendarDays, Flag, ChevronUp, ChevronDown } from "lucide-react";
import { isDerivedMilestoneId, stepIdFromDerivedMilestoneId } from "@/lib/milestone-steps";
import {
  CachedContent,
  fetchJson,
  invalidateFetchCache,
  peekFetchCache,
  refetchJson,
  shouldShowPageLoading,
} from "@/components/ui/PageState";
import Link from "next/link";
import { parseTags, tagsFromInput, tagsToInput } from "@/lib/tags";
import { useDeepLinkOpen } from "@/lib/useDeepLink";
import { FilterTabs } from "@/components/ui/FilterTabs";
import type { ContactOption } from "@/components/contacts/ContactSearchPicker";
import { ContactName } from "@/components/contacts/ContactQuickView";
import type { ProjectOption } from "@/components/projects/ProjectSearchPicker";
import {
  migrateDescriptionToNote,
  pickDefaultNoteId,
  type ProjectNote,
} from "@/lib/project-notes";

const ContactSearchPicker = dynamic(
  () => import("@/components/contacts/ContactSearchPicker").then((m) => m.ContactSearchPicker),
  { ssr: false }
);
const ResizableSplitPane = dynamic(
  () => import("@/components/ui/ResizableSplitPane").then((m) => m.ResizableSplitPane),
  { ssr: false }
);
const ProjectSearchPicker = dynamic(
  () => import("@/components/projects/ProjectSearchPicker").then((m) => m.ProjectSearchPicker),
  { ssr: false }
);
const ProjectNotesPanel = dynamic(
  () => import("@/components/projects/ProjectNotesPanel").then((m) => m.ProjectNotesPanel),
  { ssr: false }
);

type Milestone = {
  id: string;
  title: string;
  dueDate: string | null;
  completed: boolean;
  sortOrder?: number;
  derived?: boolean;
  stepId?: string;
  childProjectId?: string | null;
  childProject?: {
    id: string;
    name: string;
    status: string;
    progress: number;
    targetDate?: string | null;
    category?: { name: string; color: string } | null;
  } | null;
};

type ProjectContact = {
  id: string;
  contactId: string;
  role: string | null;
  contact: { id: string; name: string; company: string | null };
};

type ProjectCategory = {
  id: string;
  name: string;
  color: string;
  projectCount?: number;
};

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
  startDate: string | null;
  targetDate: string | null;
  progress: number;
  sortOrder?: number;
  pinned?: boolean;
  tags?: string;
  categoryId: string | null;
  category: ProjectCategory | null;
  ideaDate: string | null;
  archiveDate: string | null;
  wishFinishTime: string | null;
  goalId: string | null;
  goal: { id: string; title: string } | null;
  habits: Array<{ id: string; name: string }>;
  milestones: Milestone[];
  contacts: ProjectContact[];
  notes?: ProjectNote[];
  _count?: { notes: number };
  planSteps?: PlanStep[];
};

type PlanStep = {
  id: string;
  projectId: string;
  sortOrder: number;
  title: string;
  detail: string | null;
  estMinutes: number | null;
  isMilestone: boolean;
  done: boolean;
  doneDate: string | null;
  scheduledDate?: string | null;
};

type GoalOption = { id: string; title: string };

const emptyForm = {
  name: "",
  description: "",
  status: "PLANNING",
  priority: "MEDIUM",
  startDate: "",
  targetDate: "",
  progress: 0,
  goalId: "",
  tags: "",
  categoryId: "",
  ideaDate: "",
  archiveDate: "",
  wishFinishTime: "",
};

const emptyCatForm = { name: "", color: "#6366f1" };

function CategoryFilterPill({
  name,
  color,
  count,
  active,
  onClick,
  onEdit,
}: {
  name: string;
  color: string;
  count: number;
  active: boolean;
  onClick: () => void;
  onEdit?: () => void;
}) {
  return (
    <div className="inline-flex items-center group">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all border",
          active ? "border-current shadow-sm" : "border-transparent hover:brightness-95"
        )}
        style={{ backgroundColor: `${color}20`, color }}
      >
        {name}
        <span className="opacity-60">{count}</span>
      </button>
      {onEdit && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="ml-0.5 p-1 rounded-full text-zinc-400 opacity-0 group-hover:opacity-100 hover:bg-zinc-100 hover:text-zinc-700 transition-all"
          title="编辑分类"
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

const STATUS_TABS = [
  { key: "all", label: "全部" },
  { key: "PLANNING", label: "规划中" },
  { key: "ACTIVE", label: "进行中" },
  { key: "PAUSED", label: "已暂停" },
  { key: "COMPLETED", label: "已完成" },
  { key: "CANCELLED", label: "已取消" },
];

type ProjectSortKey =
  | "sortOrder"
  | "name"
  | "category"
  | "status"
  | "priority"
  | "progress"
  | "milestones"
  | "ideaDate"
  | "targetDate"
  | "contacts";

const STATUS_ORDER = Object.keys(PROJECT_STATUS);
const PRIORITY_ORDER = Object.keys(PROJECT_PRIORITY);

const PROJECT_COLUMN_ORDER_KEY = "lifeos-projects-column-order";

const DEFAULT_PROJECT_COLUMNS: ProjectSortKey[] = [
  "name",
  "category",
  "status",
  "priority",
  "progress",
  "milestones",
  "ideaDate",
  "targetDate",
  "contacts",
];

const PROJECT_COLUMN_LABELS: Record<ProjectSortKey, string> = {
  sortOrder: "顺序",
  name: "项目名称",
  category: "分类",
  status: "状态",
  priority: "优先级",
  progress: "进度",
  milestones: "里程碑",
  ideaDate: "Idea 月份",
  targetDate: "目标月份",
  contacts: "联系人",
};

function loadProjectColumnOrder(): ProjectSortKey[] {
  if (typeof window === "undefined") return DEFAULT_PROJECT_COLUMNS;
  try {
    const saved = localStorage.getItem(PROJECT_COLUMN_ORDER_KEY);
    if (!saved) return DEFAULT_PROJECT_COLUMNS;
    const parsed = JSON.parse(saved) as ProjectSortKey[];
    const known = parsed.filter((k) => DEFAULT_PROJECT_COLUMNS.includes(k));
    const missing = DEFAULT_PROJECT_COLUMNS.filter((k) => !known.includes(k));
    if (known.length === 0) return DEFAULT_PROJECT_COLUMNS;
    return [...known, ...missing];
  } catch {
    /* ignore */
  }
  return DEFAULT_PROJECT_COLUMNS;
}

function isMilestoneDone(m: Milestone) {
  if (m.childProject) return m.childProject.status === "COMPLETED" || m.completed;
  return m.completed;
}

function milestoneDoneCount(p: Project) {
  return p.milestones?.filter((m) => isMilestoneDone(m)).length ?? 0;
}

function milestoneTotalCount(p: Project) {
  return p.milestones?.length ?? 0;
}

function sortProjects(items: Project[], key: ProjectSortKey, dir: SortDirection) {
  return [...items].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    if (key === "sortOrder") {
      return compareNumbers(a.sortOrder ?? 0, b.sortOrder ?? 0, dir);
    }
    switch (key) {
      case "name":
        return compareStrings(stripProjectYearPrefix(a.name), stripProjectYearPrefix(b.name), dir);
      case "category":
        return compareStrings(a.category?.name || "", b.category?.name || "", dir);
      case "status":
        return compareByOrder(a.status, b.status, STATUS_ORDER, dir);
      case "priority":
        return compareByOrder(a.priority, b.priority, PRIORITY_ORDER, dir);
      case "progress":
        return compareNumbers(a.progress, b.progress, dir);
      case "milestones": {
        const ratioA =
          milestoneTotalCount(a) > 0 ? milestoneDoneCount(a) / milestoneTotalCount(a) : -1;
        const ratioB =
          milestoneTotalCount(b) > 0 ? milestoneDoneCount(b) / milestoneTotalCount(b) : -1;
        if (ratioA !== ratioB) return compareNumbers(ratioA, ratioB, dir);
        return compareNumbers(milestoneTotalCount(a), milestoneTotalCount(b), dir);
      }
      case "ideaDate":
        return compareDates(a.ideaDate, b.ideaDate, dir);
      case "targetDate":
        return compareDates(a.targetDate, b.targetDate, dir);
      case "contacts":
        return compareNumbers(a.contacts?.length ?? 0, b.contacts?.length ?? 0, dir);
      default:
        return 0;
    }
  });
}

const PROJECT_KEYS = [
  "/api/projects",
  "/api/project-categories",
  "/api/contacts",
  "/api/goals",
];

/** 从别的页面点开项目时的弹窗模式：只渲染编辑弹窗，关掉回到原页面 */
export type ProjectQuickView = { id: string; onClose: () => void };

export function ProjectsWorkspace({ quickView }: { quickView?: ProjectQuickView } = {}) {
  const [projects, setProjects] = useState<Project[]>(
    () => peekFetchCache<Project[]>("/api/projects") ?? []
  );
  const [categories, setCategories] = useState<ProjectCategory[]>(
    () => peekFetchCache<ProjectCategory[]>("/api/project-categories") ?? []
  );
  const [allContacts, setAllContacts] = useState<ContactOption[]>(
    () => peekFetchCache<{ contacts: ContactOption[] }>("/api/contacts")?.contacts ?? []
  );
  const [allGoals, setAllGoals] = useState<GoalOption[]>(
    () =>
      (peekFetchCache<GoalOption[]>("/api/goals") ?? []).map((g) => ({
        id: g.id,
        title: g.title,
      }))
  );
  const [tab, setTab] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catEditing, setCatEditing] = useState<ProjectCategory | null>(null);
  const [catForm, setCatForm] = useState(emptyCatForm);
  const [modalOpen, setModalOpen] = useState(false);
  const closeModal = useCallback(() => {
    setModalOpen(false);
    quickView?.onClose();
  }, [quickView]);
  const [editing, setEditing] = useState<Project | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [newMilestone, setNewMilestone] = useState("");
  const [newMilestoneDue, setNewMilestoneDue] = useState("");
  const [newStepTitle, setNewStepTitle] = useState("");
  const [newStepDate, setNewStepDate] = useState("");
  const [newStepMinutes, setNewStepMinutes] = useState("");
  const [newStepMilestone, setNewStepMilestone] = useState(false);
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [milestoneForm, setMilestoneForm] = useState({ title: "", dueDate: "" });
  const [addContactId, setAddContactId] = useState("");
  const [addContactRole, setAddContactRole] = useState("");
  const [addSubProjectId, setAddSubProjectId] = useState("");
  const [dragMilestoneId, setDragMilestoneId] = useState<string | null>(null);
  const [dropMilestoneId, setDropMilestoneId] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => shouldShowPageLoading(PROJECT_KEYS));
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<ProjectSortKey>("sortOrder");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [columnOrder, setColumnOrder] = useState<ProjectSortKey[]>(DEFAULT_PROJECT_COLUMNS);
  const [dragColumn, setDragColumn] = useState<ProjectSortKey | null>(null);
  const [dropColumn, setDropColumn] = useState<ProjectSortKey | null>(null);
  const [dragProjectId, setDragProjectId] = useState<string | null>(null);
  const [dropProjectId, setDropProjectId] = useState<string | null>(null);
  const [projectNotes, setProjectNotes] = useState<ProjectNote[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  useEffect(() => {
    setColumnOrder(loadProjectColumnOrder());
  }, []);

  const load = useCallback(async (force = false) => {
    if (shouldShowPageLoading(PROJECT_KEYS)) setLoading(true);
    setError(null);
    const readJson = force ? refetchJson : fetchJson;
    try {
      const [projs, cats, contactsData, goalsData] = await Promise.all([
        readJson<Project[]>("/api/projects"),
        readJson<ProjectCategory[]>("/api/project-categories"),
        readJson<{ contacts: ContactOption[] }>("/api/contacts"),
        readJson<GoalOption[]>("/api/goals"),
      ]);
      setProjects(projs);
      setCategories(cats);
      setAllContacts(contactsData.contacts);
      setAllGoals(goalsData.map((g) => ({ id: g.id, title: g.title })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = useCallback(async (p: Project) => {
    const detail = await fetch(`/api/projects/${p.id}`).then((r) => r.json());
    let notes: ProjectNote[] = detail.notes || [];

    if (notes.length === 0 && detail.description?.trim()) {
      const migrated = await migrateDescriptionToNote(p.id, detail.description);
      if (migrated) {
        notes = [migrated];
        detail.description = null;
      }
    }

    setProjectNotes(notes);
    setActiveNoteId(pickDefaultNoteId(notes));
    setEditing(detail);
    setForm({
      name: stripProjectYearPrefix(detail.name),
      description: "",
      status: detail.status,
      priority: detail.priority,
      startDate: detail.startDate ? detail.startDate.slice(0, 10) : "",
      targetDate: toMonthInput(detail.targetDate),
      progress: detail.progress,
      goalId: detail.goalId || detail.goal?.id || "",
      tags: tagsToInput(parseTags(detail.tags || "[]")),
      categoryId: detail.categoryId || detail.category?.id || "",
      ideaDate: toMonthInput(detail.ideaDate),
      archiveDate: detail.archiveDate ? detail.archiveDate.slice(0, 10) : "",
      wishFinishTime: detail.wishFinishTime || "",
    });
    setNewMilestone("");
    setNewMilestoneDue("");
    setEditingMilestoneId(null);
    setAddContactId("");
    setAddContactRole("");
    setAddSubProjectId("");
    setModalOpen(true);
  }, []);

  useDeepLinkOpen(
    useCallback(
      async (id) => {
        const p = projects.find((x) => x.id === id);
        if (p) await openEdit(p);
        else {
          const detail = await fetch(`/api/projects/${id}`).then((r) => r.json()).catch(() => null);
          if (detail?.id) await openEdit(detail);
        }
      },
      [projects, openEdit]
    ),
    !loading
  );

  // 弹窗模式：按 id 取项目详情直接打开编辑弹窗
  useEffect(() => {
    if (!quickView) return;
    let cancelled = false;
    void fetch(`/api/projects/${quickView.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((detail) => {
        if (cancelled) return;
        if (detail?.id) void openEdit(detail);
        else quickView.onClose();
      })
      .catch(() => {
        if (!cancelled) quickView.onClose();
      });
    return () => {
      cancelled = true;
    };
  }, [quickView, openEdit]);

  // 「全部」不含已取消的项目；要看就点「已取消」
  const filteredByStatus =
    tab === "all" ? projects.filter((p) => p.status !== "CANCELLED") : projects.filter((p) => p.status === tab);
  const filtered =
    categoryFilter === "all"
      ? filteredByStatus
      : categoryFilter === "none"
        ? filteredByStatus.filter((p) => !p.categoryId)
        : filteredByStatus.filter((p) => p.categoryId === categoryFilter);
  const sorted = sortProjects(filtered, sortKey, sortDir);

  const categoryCount = (id: string) =>
    filteredByStatus.filter((p) => p.categoryId === id).length;
  const uncategorizedCount = filteredByStatus.filter((p) => !p.categoryId).length;

  const sortedCategories = [...categories].sort((a, b) => {
    const diff = categoryCount(b.id) - categoryCount(a.id);
    if (diff !== 0) return diff;
    return a.name.localeCompare(b.name, "zh-CN");
  });

  const openCatCreate = () => {
    setCatEditing(null);
    setCatForm(emptyCatForm);
    setCatModalOpen(true);
  };

  const openCatEdit = (cat: ProjectCategory) => {
    setCatEditing(cat);
    setCatForm({ name: cat.name, color: cat.color });
    setCatModalOpen(true);
  };

  const saveCategory = async () => {
    if (!catForm.name.trim()) return;
    if (catEditing) {
      await fetch(`/api/project-categories/${catEditing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(catForm),
      });
    } else {
      await fetch("/api/project-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(catForm),
      });
    }
    setCatModalOpen(false);
    load();
  };

  const removeCategory = async () => {
    if (!catEditing || !confirm(`确定删除分类「${catEditing.name}」？相关项目将变为未分类。`)) return;
    await fetch(`/api/project-categories/${catEditing.id}`, { method: "DELETE" });
    if (categoryFilter === catEditing.id) setCategoryFilter("all");
    setCatModalOpen(false);
    load();
  };

  const handleSort = (key: ProjectSortKey) => {
    setSortDir((dir) => toggleSortDirection(sortKey, key, dir));
    setSortKey(key);
  };

  const reorderProjects = async (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const from = projects.find((p) => p.id === fromId);
    const to = projects.find((p) => p.id === toId);
    if (!from || !to || Boolean(from.pinned) !== Boolean(to.pinned)) return;
    const byOrder = (a: Project, b: Project) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    const pinned = projects.filter((p) => p.pinned).sort(byOrder);
    const unpinned = projects.filter((p) => !p.pinned).sort(byOrder);
    const group = from.pinned ? pinned : unpinned;
    const fromIdx = group.findIndex((p) => p.id === fromId);
    const toIdx = group.findIndex((p) => p.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;
    const [item] = group.splice(fromIdx, 1);
    if (!item) return;
    group.splice(toIdx, 0, item);
    const next = [...(from.pinned ? group : pinned), ...(from.pinned ? unpinned : group)].map(
      (p, i) => ({ ...p, sortOrder: i })
    );
    const prev = projects;
    setProjects(next);
    setSortKey("sortOrder");
    setSortDir("asc");
    const res = await fetch("/api/projects/reorder", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: next.map((p) => p.id) }),
    });
    if (!res.ok) {
      setProjects(prev);
      return;
    }
    invalidateFetchCache("/api/projects");
    invalidateFetchCache("/api/timeline");
  };

  const moveColumn = (from: ProjectSortKey, to: ProjectSortKey) => {
    if (from === to) return;
    setColumnOrder((prev) => {
      const next = [...prev];
      const fromIdx = next.indexOf(from);
      const toIdx = next.indexOf(to);
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, from);
      localStorage.setItem(PROJECT_COLUMN_ORDER_KEY, JSON.stringify(next));
      return next;
    });
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setProjectNotes([]);
    setActiveNoteId(null);
    setNewMilestone("");
    setNewMilestoneDue("");
    setEditingMilestoneId(null);
    setAddContactId("");
    setAddContactRole("");
    setAddSubProjectId("");
    setModalOpen(true);
  };

  const openSubProject = async (projectId: string) => {
    const p = projects.find((x) => x.id === projectId);
    if (p) await openEdit(p);
    else {
      const detail = await fetch(`/api/projects/${projectId}`).then((r) => r.json()).catch(() => null);
      if (detail?.id) await openEdit(detail);
    }
  };

  const save = async () => {
    const payload = {
      ...form,
      name: stripProjectYearPrefix(form.name.trim()),
      description: null,
      startDate: form.startDate || null,
      targetDate: monthInputToDate(form.targetDate) || null,
      ideaDate: monthInputToDate(form.ideaDate) || null,
      goalId: form.goalId || null,
      tags: tagsFromInput(form.tags),
      categoryId: form.categoryId || null,
      archiveDate: form.archiveDate || null,
      wishFinishTime: form.wishFinishTime || null,
      completedAt: form.status === "COMPLETED" ? new Date().toISOString() : null,
    };
    if (editing) {
      await fetch(`/api/projects/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    closeModal();
    load(true);
  };

  const remove = async (id: string) => {
    if (!confirm("确定删除此项目？")) return;
    await fetch(`/api/projects/${id}`, { method: "DELETE" });
    load(true);
  };

  const togglePin = async (p: Project, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextPinned = !p.pinned;
    const prev = projects;
    setProjects((list) =>
      list.map((item) => (item.id === p.id ? { ...item, pinned: nextPinned } : item))
    );
    const res = await fetch(`/api/projects/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: nextPinned }),
    });
    if (!res.ok) {
      setProjects(prev);
      return;
    }
    invalidateFetchCache("/api/projects");
    invalidateFetchCache("/api/timeline");
  };

  const refreshEditing = async (project = editing) => {
    if (!project) return;
    invalidateFetchCache("/api/projects");
    invalidateFetchCache("/api/timeline");
    invalidateFetchCache("/api/daily-log");
    await openEdit(project);
    load();
  };

  const patchPlanStep = async (stepId: string, body: Record<string, unknown>) => {
    if (!editing) return;
    await fetch(`/api/plan-steps/${stepId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await refreshEditing();
  };

  const addPlanStep = async () => {
    if (!editing || !newStepTitle.trim()) return;
    await fetch(`/api/projects/${editing.id}/plan/steps`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        replace: false,
        planActive: true,
        steps: [
          {
            title: newStepTitle.trim(),
            scheduledDate: newStepDate || null,
            estMinutes: newStepMinutes ? Number(newStepMinutes) : null,
            isMilestone: newStepMilestone,
          },
        ],
      }),
    });
    setNewStepTitle("");
    setNewStepDate("");
    setNewStepMinutes("");
    setNewStepMilestone(false);
    await refreshEditing();
  };

  const deletePlanStep = async (stepId: string) => {
    if (!editing) return;
    await fetch(`/api/plan-steps/${stepId}`, { method: "DELETE" });
    await refreshEditing();
  };

  const movePlanStep = async (stepId: string, direction: -1 | 1) => {
    if (!editing) return;
    const steps = [...(editing.planSteps ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    const index = steps.findIndex((s) => s.id === stepId);
    const swap = index + direction;
    if (index < 0 || swap < 0 || swap >= steps.length) return;
    const next = [...steps];
    const current = next[index]!;
    next[index] = next[swap]!;
    next[swap] = current;
    await fetch(`/api/projects/${editing.id}/plan/steps`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        replace: false,
        steps: next.map((s, i) => ({
          id: s.id,
          title: s.title,
          detail: s.detail,
          estMinutes: s.estMinutes,
          scheduledDate: s.scheduledDate,
          isMilestone: s.isMilestone,
          done: s.done,
          doneDate: s.doneDate,
          sortOrder: i,
        })),
      }),
    });
    await refreshEditing();
  };

  const toggleMilestone = async (m: Milestone) => {
    if (!editing) return;
    const nextCompleted = !isMilestoneDone(m);
    if (m.derived || isDerivedMilestoneId(m.id)) {
      const stepId = m.stepId ?? stepIdFromDerivedMilestoneId(m.id);
      if (!stepId) return;
      await fetch(`/api/plan-steps/${stepId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: nextCompleted }),
      });
    } else {
      await fetch(`/api/milestones/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: nextCompleted }),
      });
    }
    openEdit(editing);
    load();
  };

  const addSubProject = async () => {
    if (!editing || !addSubProjectId) return;
    const res = await fetch(`/api/projects/${editing.id}/milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ childProjectId: addSubProjectId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "关联子项目失败");
      return;
    }
    setAddSubProjectId("");
    openEdit(editing);
    load();
  };

  const addMilestone = async () => {
    if (!editing || !newMilestone.trim()) return;
    await fetch(`/api/projects/${editing.id}/milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newMilestone.trim(),
        dueDate: newMilestoneDue || null,
      }),
    });
    setNewMilestone("");
    setNewMilestoneDue("");
    openEdit(editing);
    load();
  };

  const deleteMilestone = async (m: Milestone) => {
    if (!editing) return;
    if (editingMilestoneId === m.id) setEditingMilestoneId(null);
    if (m.derived || isDerivedMilestoneId(m.id)) {
      const stepId = m.stepId ?? stepIdFromDerivedMilestoneId(m.id);
      if (!stepId) return;
      await fetch(`/api/plan-steps/${stepId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isMilestone: false }),
      });
    } else {
      await fetch(`/api/milestones/${m.id}`, { method: "DELETE" });
    }
    openEdit(editing);
    load();
  };

  const startEditMilestone = (m: Milestone) => {
    if (m.childProjectId || m.derived || isDerivedMilestoneId(m.id)) return;
    setEditingMilestoneId(m.id);
    setMilestoneForm({
      title: m.title,
      dueDate: m.dueDate ? m.dueDate.slice(0, 10) : "",
    });
  };

  const saveMilestone = async () => {
    if (!editingMilestoneId || !editing || !milestoneForm.title.trim()) return;
    await fetch(`/api/milestones/${editingMilestoneId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: milestoneForm.title.trim(),
        dueDate: milestoneForm.dueDate || null,
      }),
    });
    setEditingMilestoneId(null);
    openEdit(editing);
    load();
  };

  const sortedMilestones = useMemo(
    () =>
      [...(editing?.milestones ?? [])].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
      ),
    [editing?.milestones]
  );

  const reorderMilestones = async (fromId: string, toId: string) => {
    if (!editing || fromId === toId) return;
    const list = [...sortedMilestones];
    const fromIdx = list.findIndex((m) => m.id === fromId);
    const toIdx = list.findIndex((m) => m.id === toId);
    if (fromIdx < 0 || toIdx < 0) return;

    const [item] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, item);
    const orderedIds = list.map((m) => m.id);
    const reordered = list.map((m, i) => ({ ...m, sortOrder: i }));

    setEditing({ ...editing, milestones: reordered });

    const res = await fetch(`/api/projects/${editing.id}/milestones/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds }),
    });
    if (!res.ok) {
      openEdit(editing);
      return;
    }
    load();
  };

  const linkContact = async () => {
    if (!editing || !addContactId) return;
    await fetch(`/api/projects/${editing.id}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contactId: addContactId, role: addContactRole.trim() || null }),
    });
    setAddContactId("");
    setAddContactRole("");
    openEdit(editing);
    load();
  };

  const unlinkContact = async (contactId: string) => {
    if (!editing) return;
    await fetch(`/api/projects/${editing.id}/contacts/${contactId}`, { method: "DELETE" });
    openEdit(editing);
    load();
  };

  const milestoneSummary = (p: Project) => {
    const total = milestoneTotalCount(p);
    if (!total) return "—";
    return `${milestoneDoneCount(p)}/${total}`;
  };

  const renderProjectCell = (col: ProjectSortKey, p: Project) => {
    switch (col) {
      case "name":
        return (
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              draggable
              onDragStart={(e) => {
                e.stopPropagation();
                setDragProjectId(p.id);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("application/x-project-id", p.id);
                e.dataTransfer.setData("text/plain", p.id);
              }}
              onDragEnd={() => {
                setDragProjectId(null);
                setDropProjectId(null);
              }}
              className="flex-shrink-0 cursor-grab active:cursor-grabbing p-0.5 text-zinc-300 hover:text-zinc-500 rounded"
              title="拖拽调整项目顺序"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-3.5 w-3.5" />
            </span>
            {p.pinned && <Pin className="h-3.5 w-3.5 flex-shrink-0 text-amber-500 fill-amber-400" />}
            <div
              className="font-medium text-zinc-900 truncate"
              title={stripProjectYearPrefix(p.name)}
            >
              {stripProjectYearPrefix(p.name)}
            </div>
          </div>
        );
      case "category":
        return p.category ? (
          <Badge color={p.category.color}>{p.category.name}</Badge>
        ) : (
          <span className="text-zinc-400">—</span>
        );
      case "status":
        return (
          <Badge className={PROJECT_STATUS[p.status]?.color}>
            {PROJECT_STATUS[p.status]?.label}
          </Badge>
        );
      case "priority":
        return (
          <span className={`font-medium ${PROJECT_PRIORITY[p.priority]?.color}`}>
            {PROJECT_PRIORITY[p.priority]?.label}
          </span>
        );
      case "progress":
        return (
          <div className="w-24">
            <ProgressBar value={p.progress} />
            <span className="text-xs text-zinc-500 mt-1 block">{p.progress}%</span>
          </div>
        );
      case "milestones":
        return milestoneSummary(p);
      case "ideaDate":
        return formatYearMonth(p.ideaDate);
      case "targetDate":
        return formatYearMonth(p.targetDate);
      case "contacts":
        return p.contacts?.length > 0 ? (
          <span className="text-sm text-zinc-600">{p.contacts.length} 人</span>
        ) : (
          <span className="text-zinc-400">—</span>
        );
      default:
        return null;
    }
  };

  const linkedContactIds = new Set(editing?.contacts?.map((c) => c.contactId) ?? []);
  const availableContacts = allContacts.filter((c) => !linkedContactIds.has(c.id));

  const alreadySubProjectIds = new Set(
    projects.flatMap((p) =>
      (p.milestones ?? [])
        .filter((m) => m.childProjectId)
        .map((m) => m.childProjectId as string)
    )
  );
  const currentSubProjectIds = new Set(
    editing?.milestones?.filter((m) => m.childProjectId).map((m) => m.childProjectId as string) ?? []
  );
  const availableSubProjects: ProjectOption[] = projects
    .filter(
      (p) =>
        p.id !== editing?.id &&
        !currentSubProjectIds.has(p.id) &&
        !alreadySubProjectIds.has(p.id)
    )
    .map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      category: p.category,
    }));

  const projectModal = (
    <Modal open={modalOpen} onClose={closeModal} title={editing ? "编辑项目" : "新建项目"} xl xlWide>
      <div className="grid flex-1 min-h-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden">
        <ResizableSplitPane
          storageKey="lifeos-project-edit-split"
          defaultLeftWidth={667}
          minLeft={360}
          minRight={560}
          className="min-h-0 overflow-hidden"
          left={
            <div className="px-5 py-4 pb-10">
          <div className="grid grid-cols-2 gap-4">
            <Field className="col-span-2">
              <Label>项目名称 *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field>
              <Label>状态</Label>
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {Object.entries(PROJECT_STATUS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </Select>
            </Field>
            <Field>
              <Label>优先级</Label>
              <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {Object.entries(PROJECT_PRIORITY).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </Select>
            </Field>
            <Field>
              <Label>开始日期</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </Field>
            <Field>
              <Label>目标月份</Label>
              <Input type="month" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} />
            </Field>
            <Field className="col-span-2">
              <Label>关联人生目标</Label>
              <Select value={form.goalId} onChange={(e) => setForm({ ...form, goalId: e.target.value })}>
                <option value="">无关联</option>
                {allGoals.map((g) => (
                  <option key={g.id} value={g.id}>{g.title}</option>
                ))}
              </Select>
            </Field>
            <Field className="col-span-2">
              <Label>标签（逗号分隔）</Label>
              <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="研究, 副业" />
            </Field>
            <Field>
              <Label>分类</Label>
              <Select
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                <option value="">未分类</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </Field>
            <Field>
              <Label>期望完成</Label>
              <Input
                value={form.wishFinishTime}
                onChange={(e) => setForm({ ...form, wishFinishTime: e.target.value })}
                placeholder="如：2026 Q2"
              />
            </Field>
            <Field>
              <Label>Idea 月份</Label>
              <Input type="month" value={form.ideaDate} onChange={(e) => setForm({ ...form, ideaDate: e.target.value })} />
            </Field>
            <Field>
              <Label>归档日期</Label>
              <Input type="date" value={form.archiveDate} onChange={(e) => setForm({ ...form, archiveDate: e.target.value })} />
            </Field>
            {editing && editing.milestones?.length > 0 ? (
              <Field className="col-span-2">
                <Label>进度（由里程碑自动计算: {form.progress}%）</Label>
                <ProgressBar value={form.progress} />
              </Field>
            ) : (
              <Field className="col-span-2">
                <Label>进度 ({form.progress}%)</Label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={form.progress}
                  onChange={(e) => setForm({ ...form, progress: +e.target.value })}
                  className="w-full accent-indigo-500"
                />
              </Field>
            )}
          </div>

          {editing && (
            <>
              <div className="mt-6 pt-6 border-t border-zinc-100">
                <Label>计划步骤</Label>
                <p className="text-xs text-zinc-500 mb-3">
                  执行单元可改日期、时长和完成状态。标记里程碑的步骤会计入进度。
                </p>
                <div className="space-y-2 mb-3">
                  {[...(editing.planSteps ?? [])]
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((step, index, list) => (
                      <div
                        key={step.id}
                        className={cn(
                          "grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-lg px-3 py-2",
                          step.done ? "bg-emerald-50/70" : "bg-zinc-50"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={step.done}
                          onChange={() => patchPlanStep(step.id, { done: !step.done })}
                          className="h-4 w-4 accent-indigo-500"
                        />
                        <div className="min-w-0 space-y-1.5">
                          <Input
                            defaultValue={step.title}
                            onBlur={(e) => {
                              const title = e.target.value.trim();
                              if (title && title !== step.title) patchPlanStep(step.id, { title });
                            }}
                            className={cn("h-8", step.done && "line-through text-zinc-400")}
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              type="date"
                              defaultValue={step.scheduledDate ?? step.doneDate ?? ""}
                              onBlur={(e) => {
                                const scheduledDate = e.target.value || null;
                                if (scheduledDate !== (step.scheduledDate ?? "")) {
                                  patchPlanStep(step.id, { scheduledDate });
                                }
                              }}
                              className="h-8 w-[150px]"
                            />
                            <Input
                              type="number"
                              min={0}
                              defaultValue={step.estMinutes ?? ""}
                              placeholder="分钟"
                              onBlur={(e) => {
                                const estMinutes = e.target.value ? Number(e.target.value) : null;
                                if (estMinutes !== step.estMinutes) {
                                  patchPlanStep(step.id, { estMinutes });
                                }
                              }}
                              className="h-8 w-[88px]"
                            />
                            <button
                              type="button"
                              onClick={() => patchPlanStep(step.id, { isMilestone: !step.isMilestone })}
                              className={cn(
                                "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px]",
                                step.isMilestone ? "bg-violet-100 text-violet-700" : "bg-white text-zinc-400"
                              )}
                              title="标记为里程碑"
                            >
                              <Flag className="h-3 w-3" />
                              里程碑
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <button
                            type="button"
                            onClick={() => movePlanStep(step.id, -1)}
                            disabled={index === 0}
                            className="text-zinc-400 hover:text-zinc-700 disabled:opacity-30"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => movePlanStep(step.id, 1)}
                            disabled={index === list.length - 1}
                            className="text-zinc-400 hover:text-zinc-700 disabled:opacity-30"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deletePlanStep(step.id)}
                            className="text-zinc-400 hover:text-red-500"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  {(editing.planSteps ?? []).length === 0 && (
                    <p className="text-sm text-zinc-400">还没有步骤。有未完成里程碑时可转成步骤，或在这里直接添加。</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Input
                    value={newStepTitle}
                    onChange={(e) => setNewStepTitle(e.target.value)}
                    placeholder="新步骤..."
                    className="flex-1 min-w-[140px]"
                    onKeyDown={(e) => e.key === "Enter" && addPlanStep()}
                  />
                  <Input
                    type="date"
                    value={newStepDate}
                    onChange={(e) => setNewStepDate(e.target.value)}
                    className="w-[150px]"
                  />
                  <Input
                    type="number"
                    min={0}
                    value={newStepMinutes}
                    onChange={(e) => setNewStepMinutes(e.target.value)}
                    placeholder="分钟"
                    className="w-[88px]"
                  />
                  <Button
                    variant={newStepMilestone ? "primary" : "secondary"}
                    onClick={() => setNewStepMilestone((v) => !v)}
                  >
                    里程碑
                  </Button>
                  <Button variant="secondary" onClick={addPlanStep} disabled={!newStepTitle.trim()}>
                    添加
                  </Button>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-zinc-100">
                <Label>里程碑</Label>
                <p className="text-xs text-zinc-500 mb-3">
                  拖拽 ⋮⋮ 调整顺序 · 勾选完成 · 可关联其它项目作为子项目 · 📅 来自日历步骤
                </p>
                <div className="space-y-2 mb-3">
              {sortedMilestones.map((m) => {
                const done = isMilestoneDone(m);
                const isSub = !!m.childProjectId;
                const isDerived = !!(m.derived || isDerivedMilestoneId(m.id));
                const isDragging = dragMilestoneId === m.id;
                const isDropTarget = dropMilestoneId === m.id && dragMilestoneId !== m.id;
                return (
                <div
                  key={m.id}
                  onDragOver={(e) => {
                    if (isDerived) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDropMilestoneId(m.id);
                  }}
                  onDragLeave={() => setDropMilestoneId((id) => (id === m.id ? null : id))}
                  onDrop={(e) => {
                    if (isDerived) return;
                    e.preventDefault();
                    const fromId = e.dataTransfer.getData("text/plain");
                    if (fromId) reorderMilestones(fromId, m.id);
                    setDragMilestoneId(null);
                    setDropMilestoneId(null);
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 transition-colors",
                    isSub ? "bg-indigo-50/80" : isDerived ? "bg-violet-50/60" : "bg-zinc-50",
                    isDragging && "opacity-40",
                    isDropTarget && "ring-2 ring-indigo-300 ring-inset"
                  )}
                >
                  {isDerived ? (
                    <span className="flex-shrink-0 p-0.5 text-violet-400" title="日历步骤里程碑">
                      <CalendarDays className="h-4 w-4" />
                    </span>
                  ) : (
                  <span
                    draggable
                    onDragStart={(e) => {
                      setDragMilestoneId(m.id);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", m.id);
                    }}
                    onDragEnd={() => {
                      setDragMilestoneId(null);
                      setDropMilestoneId(null);
                    }}
                    className="flex-shrink-0 cursor-grab active:cursor-grabbing p-0.5 text-zinc-300 hover:text-zinc-500 rounded"
                    title="拖拽排序"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <GripVertical className="h-4 w-4" />
                  </span>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleMilestone(m)}
                    className={`flex-shrink-0 h-5 w-5 rounded border flex items-center justify-center ${
                      done ? "bg-emerald-500 border-emerald-500 text-white" : "border-zinc-300"
                    }`}
                  >
                    {done && <Check className="h-3 w-3" />}
                  </button>
                  {editingMilestoneId === m.id ? (
                    <>
                      <Input
                        value={milestoneForm.title}
                        onChange={(e) => setMilestoneForm({ ...milestoneForm, title: e.target.value })}
                        className="flex-1 min-w-0 text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveMilestone();
                          if (e.key === "Escape") setEditingMilestoneId(null);
                        }}
                      />
                      <Input
                        type="date"
                        value={milestoneForm.dueDate}
                        onChange={(e) => setMilestoneForm({ ...milestoneForm, dueDate: e.target.value })}
                        className="w-[140px] text-sm"
                      />
                      <Button size="sm" variant="secondary" onClick={saveMilestone} disabled={!milestoneForm.title.trim()}>
                        保存
                      </Button>
                      <button
                        type="button"
                        onClick={() => setEditingMilestoneId(null)}
                        className="text-zinc-400 hover:text-zinc-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      {isSub ? (
                        <button
                          type="button"
                          onClick={() => openSubProject(m.childProjectId!)}
                          className="flex-1 min-w-0 text-left group"
                        >
                          <span className={`text-sm font-medium truncate block ${done ? "text-zinc-400 line-through" : "text-indigo-700 group-hover:text-indigo-900"}`}>
                            {m.childProject?.name || m.title}
                          </span>
                          <span className="text-xs text-zinc-500 mt-0.5 flex items-center gap-2 flex-wrap">
                            <Badge className="text-[10px] px-1.5 py-0 bg-indigo-100 text-indigo-700">子项目</Badge>
                            {m.childProject && (
                              <Badge className={PROJECT_STATUS[m.childProject.status]?.color}>
                                {PROJECT_STATUS[m.childProject.status]?.label}
                              </Badge>
                            )}
                            {m.childProject && <span>{m.childProject.progress}%</span>}
                          </span>
                        </button>
                      ) : (
                        <span className={`flex-1 text-sm min-w-0 truncate ${done ? "text-zinc-400 line-through" : "text-zinc-800"}`}>
                          {m.title}
                          {isDerived && (
                            <span className="ml-1.5 text-[10px] text-violet-600 font-normal">· 日历</span>
                          )}
                        </span>
                      )}
                      {(m.dueDate || m.childProject?.targetDate) && (
                        <span className="text-xs text-zinc-500 whitespace-nowrap">
                          {formatDate(m.dueDate || m.childProject?.targetDate!)}
                        </span>
                      )}
                      {isSub ? (
                        <button
                          type="button"
                          onClick={() => openSubProject(m.childProjectId!)}
                          className="text-zinc-400 hover:text-indigo-600"
                          title="打开子项目"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      ) : isDerived ? (
                        <Link
                          href="/timeline"
                          className="text-violet-400 hover:text-violet-600"
                          title="在时间线中查看"
                        >
                          <CalendarDays className="h-3.5 w-3.5" />
                        </Link>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditMilestone(m)}
                          className="text-zinc-400 hover:text-indigo-600"
                          title="编辑"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteMilestone(m)}
                        className="text-zinc-400 hover:text-red-500"
                        title={isSub ? "取消关联" : isDerived ? "取消里程碑标记" : "删除"}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
                );
              })}
            </div>
            <div className="flex gap-2 flex-wrap">
              <Input
                value={newMilestone}
                onChange={(e) => setNewMilestone(e.target.value)}
                placeholder="新里程碑..."
                className="flex-1 min-w-[140px]"
                onKeyDown={(e) => e.key === "Enter" && addMilestone()}
              />
              <Input
                type="date"
                value={newMilestoneDue}
                onChange={(e) => setNewMilestoneDue(e.target.value)}
                className="w-[150px]"
                title="截止日期（可选）"
              />
              <Button variant="secondary" onClick={addMilestone} disabled={!newMilestone.trim()}>添加</Button>
            </div>
            {availableSubProjects.length > 0 && (
              <div className="flex gap-2 flex-wrap items-start mt-3 pt-3 border-t border-zinc-100">
                <ProjectSearchPicker
                  projects={availableSubProjects}
                  value={addSubProjectId}
                  onChange={setAddSubProjectId}
                  placeholder="搜索项目，关联为子项目…"
                />
                <Button variant="secondary" onClick={addSubProject} disabled={!addSubProjectId}>
                  关联子项目
                </Button>
              </div>
            )}
          </div>

          <div className="mt-6 pt-6 border-t border-zinc-100">
            <Label>关联习惯</Label>
            <div className="flex flex-wrap gap-2 my-3">
              {editing.habits?.length > 0 ? (
                editing.habits.map((h) => (
                  <Link key={h.id} href="/habits">
                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors">
                      {h.name}
                    </Badge>
                  </Link>
                ))
              ) : (
                <span className="text-sm text-zinc-400">暂无关联习惯 — 在习惯页关联此项目</span>
              )}
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-zinc-100">
            <Label>相关联系人</Label>
            <div className="flex flex-wrap gap-2 my-3">
              {editing.contacts?.map((pc) => (
                <Badge key={pc.id} className="bg-indigo-100 text-indigo-700 pr-1 inline-flex items-center gap-1">
                  <ContactName
                    id={pc.contactId}
                    name={pc.contact.name}
                    role={pc.role}
                    className="text-indigo-700 hover:text-indigo-900"
                  />
                  <button
                    type="button"
                    onClick={() => unlinkContact(pc.contactId)}
                    className="ml-0.5 hover:text-red-500"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {(!editing.contacts || editing.contacts.length === 0) && (
                <span className="text-sm text-zinc-400">暂无关联联系人</span>
              )}
            </div>
            {availableContacts.length > 0 && (
              <div className="flex gap-2 flex-wrap items-start">
                <ContactSearchPicker
                  contacts={availableContacts}
                  value={addContactId}
                  onChange={setAddContactId}
                />
                <Input value={addContactRole} onChange={(e) => setAddContactRole(e.target.value)} placeholder="角色（可选）" className="w-32" />
                <Button variant="secondary" onClick={linkContact} disabled={!addContactId}>关联</Button>
              </div>
            )}
          </div>
        </>
      )}
            </div>
          }
          right={
            <ProjectNotesPanel
              projectId={editing?.id ?? null}
              notes={projectNotes}
              activeNoteId={activeNoteId}
              onNotesChange={setProjectNotes}
              onActiveNoteChange={setActiveNoteId}
            />
          }
        />

        <div className="flex-shrink-0 flex justify-end gap-2 px-5 py-4 border-t border-zinc-100 bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
          <Button variant="secondary" onClick={closeModal}>取消</Button>
          <Button onClick={save} disabled={!form.name}>保存</Button>
        </div>
      </div>
    </Modal>
  );

  if (quickView) return projectModal;

  return (
    <>
      <PageHeader
        title="项目管理"
        description="管理项目、里程碑与相关联系人"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={openCatCreate}>
              添加分类
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" /> 新建项目
            </Button>
          </div>
        }
      />

      <CachedContent loading={loading} error={error} onRetry={load} hasData={projects.length > 0}>
      <div className="flex flex-wrap gap-2 items-center mb-4">
        <CategoryFilterPill
          name="全部"
          color="#71717a"
          count={filteredByStatus.length}
          active={categoryFilter === "all"}
          onClick={() => setCategoryFilter("all")}
        />
        {uncategorizedCount > 0 && (
          <CategoryFilterPill
            name="未分类"
            color="#a1a1aa"
            count={uncategorizedCount}
            active={categoryFilter === "none"}
            onClick={() => setCategoryFilter("none")}
          />
        )}
        {sortedCategories.map((cat) => (
          <CategoryFilterPill
            key={cat.id}
            name={cat.name}
            color={cat.color}
            count={categoryCount(cat.id)}
            active={categoryFilter === cat.id}
            onClick={() => setCategoryFilter(cat.id)}
            onEdit={() => openCatEdit(cat)}
          />
        ))}
      </div>

      <FilterTabs
        tabs={STATUS_TABS.map(({ key, label }) => ({
          key,
          label,
          count: key !== "all" ? projects.filter((p) => p.status === key).length : undefined,
        }))}
        value={tab}
        onChange={setTab}
        shape="pill"
        size="md"
      />

      {filtered.length === 0 ? (
        projects.length === 0 ? (
          <EmptyState title="暂无项目" description="创建你的第一个项目，然后为它设定里程碑和习惯" />
        ) : (
          <EmptyState
            title="没有匹配的项目"
            description={categoryFilter !== "all" ? "试试切换分类或状态筛选" : "切换其他状态标签查看"}
          />
        )
      ) : (
        <>
          <TableCount count={filtered.length} label="个项目" />
          <p className="text-xs text-zinc-400 mb-3 -mt-2">
            拖拽行首 ⋮⋮ 可调整项目上下顺序；拖拽表头可调整列顺序
          </p>
          <DataTable>
            <TableHead>
              {columnOrder.map((col) => (
                <DraggableSortableTableHeaderCell
                  key={col}
                  active={sortKey === col}
                  direction={sortDir}
                  onSort={() => handleSort(col)}
                  isDragging={dragColumn === col}
                  isDragTarget={dropColumn === col && dragColumn !== col}
                  className={col === "name" ? "min-w-[280px] lg:min-w-[360px]" : undefined}
                  onDragStart={(e) => {
                    setDragColumn(col);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", col);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDropColumn(col);
                  }}
                  onDragLeave={() => setDropColumn((c) => (c === col ? null : c))}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = e.dataTransfer.getData("text/plain") as ProjectSortKey;
                    if (from && from !== col) moveColumn(from, col);
                    setDragColumn(null);
                    setDropColumn(null);
                  }}
                  onDragEnd={() => {
                    setDragColumn(null);
                    setDropColumn(null);
                  }}
                >
                  {PROJECT_COLUMN_LABELS[col]}
                </DraggableSortableTableHeaderCell>
              ))}
              <TableHeaderCell className="text-right">操作</TableHeaderCell>
            </TableHead>
            <TableBody>
              {sorted.map((p) => (
                <TableRow
                  key={p.id}
                  onClick={() => openEdit(p)}
                  className={cn(
                    p.pinned && "bg-amber-50/40 hover:bg-amber-50/70",
                    dragProjectId === p.id && "opacity-40",
                    dropProjectId === p.id && dragProjectId && dragProjectId !== p.id && "bg-indigo-50"
                  )}
                  onDragOver={(e) => {
                    if (!dragProjectId) return;
                    const dragging = projects.find((item) => item.id === dragProjectId);
                    if (!dragging || Boolean(dragging.pinned) !== Boolean(p.pinned)) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    setDropProjectId(p.id);
                  }}
                  onDragLeave={() => setDropProjectId((id) => (id === p.id ? null : id))}
                  onDrop={(e) => {
                    e.preventDefault();
                    const fromId = e.dataTransfer.getData("application/x-project-id");
                    if (fromId) void reorderProjects(fromId, p.id);
                    setDragProjectId(null);
                    setDropProjectId(null);
                  }}
                >
                  {columnOrder.map((col) => (
                    <TableCell
                      key={col}
                      className={cn(
                        col === "name" && "min-w-[280px] lg:min-w-[360px] max-w-[480px]",
                        (col === "milestones" || col === "ideaDate" || col === "targetDate") &&
                          "whitespace-nowrap text-zinc-600"
                      )}
                    >
                      {renderProjectCell(col, p)}
                    </TableCell>
                  ))}
                  <TableCell>
                    <TableActions>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => togglePin(p, e)}
                        title={p.pinned ? "取消置顶" : "置顶"}
                        className={p.pinned ? "text-amber-500" : undefined}
                      >
                        <Pin className={`h-3.5 w-3.5 ${p.pinned ? "fill-current" : ""}`} />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => openEdit(p)} title="编辑">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(p.id)} title="删除">
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </TableActions>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        </>
      )}

      {projectModal}

      <Modal
        open={catModalOpen}
        onClose={() => setCatModalOpen(false)}
        title={catEditing ? "编辑分类" : "添加分类"}
      >
        <div className="space-y-4">
          <Field>
            <Label>分类名称 *</Label>
            <Input
              value={catForm.name}
              onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
              placeholder="如：研究、副业"
              autoFocus
            />
          </Field>
          <Field>
            <Label>颜色</Label>
            <div className="flex items-center gap-3">
              <Input
                type="color"
                value={catForm.color}
                onChange={(e) => setCatForm({ ...catForm, color: e.target.value })}
                className="w-16 h-10 p-1"
              />
              <Badge color={catForm.color}>{catForm.name || "预览"}</Badge>
            </div>
          </Field>
        </div>
        <div className="flex justify-between mt-6">
          {catEditing ? (
            <Button variant="danger" size="sm" onClick={removeCategory}>
              <Trash2 className="h-3.5 w-3.5" /> 删除
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setCatModalOpen(false)}>取消</Button>
            <Button onClick={saveCategory} disabled={!catForm.name.trim()}>保存</Button>
          </div>
        </div>
      </Modal>
      </CachedContent>
    </>
  );
}
