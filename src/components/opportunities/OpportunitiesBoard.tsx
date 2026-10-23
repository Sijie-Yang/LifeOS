"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge, EmptyState } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea, Label, Field } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import {
  OPPORTUNITY_STATUS,
  PROJECT_PRIORITY,
  formatDate,
  type OpportunityLane,
} from "@/lib/utils";
import {
  CachedContent,
  fetchJson,
  invalidateFetchCache,
  peekFetchCache,
  shouldShowPageLoading,
} from "@/components/ui/PageState";
import { useDeepLinkOpen } from "@/lib/useDeepLink";
import { Plus, Trash2, Pencil, Users, CalendarClock } from "lucide-react";
import { FilterTabs } from "@/components/ui/FilterTabs";
import { ContactNameList } from "@/components/contacts/ContactQuickView";
import Link from "next/link";

type Contact = { id: string; name: string };
type Project = { id: string; name: string };
type Goal = { id: string; title: string };

type Opportunity = {
  id: string;
  title: string;
  lane: string;
  category: string;
  status: string;
  priority: string;
  deadline: string | null;
  source: string | null;
  nextAction: string | null;
  notes: string | null;
  emailRemind?: boolean;
  projectId: string | null;
  goalId: string | null;
  project: { id: string; name: string } | null;
  goal: { id: string; title: string } | null;
  contacts: Array<{ contact: { id: string; name: string }; role: string | null }>;
};

type Props = {
  lane: OpportunityLane;
  title: string;
  description: string;
  createLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  categories: readonly string[];
  defaultCategory: string;
  titlePlaceholder: string;
  sourcePlaceholder: string;
  nextActionPlaceholder: string;
  notesPlaceholder: string;
  sop?: React.ReactNode;
  accentClassName?: string;
  /** 从别的页面点开时的弹窗模式：只渲染编辑弹窗，关掉回到原页面 */
  quickView?: { id: string; onClose: () => void };
};

export function OpportunitiesBoard({
  lane,
  title,
  description,
  createLabel,
  emptyTitle,
  emptyDescription,
  categories,
  defaultCategory,
  titlePlaceholder,
  sourcePlaceholder,
  nextActionPlaceholder,
  notesPlaceholder,
  sop,
  accentClassName = "hover:border-amber-200",
  quickView,
}: Props) {
  const emptyForm = {
    title: "",
    category: defaultCategory,
    status: "Watching",
    priority: "MEDIUM",
    deadline: "",
    source: "",
    nextAction: "",
    notes: "",
    emailRemind: true,
    projectId: "",
    goalId: "",
    contactIds: [] as string[],
  };

  const initialOppKey = `/api/opportunities?${new URLSearchParams({ lane })}`;
  const [filter, setFilter] = useState(quickView ? "all" : "open");
  const [opportunities, setOpportunities] = useState<Opportunity[]>(() => {
    const cached = peekFetchCache<{ opportunities: Opportunity[] }>(initialOppKey);
    return (cached?.opportunities ?? []).filter(
      (x) => x.status === "Watching" || x.status === "Active"
    );
  });
  const [contacts, setContacts] = useState<Contact[]>(
    () => peekFetchCache<{ contacts: Contact[] }>("/api/contacts")?.contacts ?? []
  );
  const [projects, setProjects] = useState<Project[]>(
    () => peekFetchCache<Project[]>("/api/projects") ?? []
  );
  const [goals, setGoals] = useState<Goal[]>(
    () =>
      (peekFetchCache<Goal[]>("/api/goals") ?? []).map((x) => ({ id: x.id, title: x.title }))
  );
  const [modalOpen, setModalOpen] = useState(false);
  const closeModal = useCallback(() => {
    setModalOpen(false);
    quickView?.onClose();
  }, [quickView]);
  const [editing, setEditing] = useState<Opportunity | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(() => shouldShowPageLoading([initialOppKey]));
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ lane });
    if (filter === "upcoming") params.set("upcoming", "1");
    else if (filter !== "all" && filter !== "open") params.set("status", filter);
    const key = `/api/opportunities?${params}`;
    if (shouldShowPageLoading([key])) setLoading(true);
    setError(null);
    try {
      const o = await fetchJson<{ opportunities: Opportunity[] }>(key);
      let list = o.opportunities;
      if (filter === "open") {
        list = list.filter((x) => x.status === "Watching" || x.status === "Active");
      }
      setOpportunities(list);
      const [c, p, g] = await Promise.all([
        fetchJson<{ contacts: Contact[] }>("/api/contacts"),
        fetchJson<Project[]>("/api/projects"),
        fetchJson<Goal[]>("/api/goals").catch(() => [] as Goal[]),
      ]);
      setContacts(c.contacts);
      setProjects(Array.isArray(p) ? p : []);
      setGoals(g.map((x) => ({ id: x.id, title: x.title })));
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [filter, lane]);

  useEffect(() => {
    void load();
  }, [load]);

  const openEdit = useCallback((item: Opportunity) => {
    setEditing(item);
    setForm({
      title: item.title,
      category: item.category,
      status: item.status,
      priority: item.priority,
      deadline: item.deadline || "",
      source: item.source || "",
      nextAction: item.nextAction || "",
      notes: item.notes || "",
      emailRemind: item.emailRemind !== false,
      projectId: item.projectId || "",
      goalId: item.goalId || "",
      contactIds: item.contacts.map((a) => a.contact.id),
    });
    setModalOpen(true);
  }, []);

  useDeepLinkOpen(
    useCallback(
      (id) => {
        const item = opportunities.find((x) => x.id === id);
        if (item) openEdit(item);
      },
      [opportunities, openEdit]
    ),
    !loading && !quickView
  );

  // 弹窗模式：列表到了就按 id 打开一次（之后列表刷新不再重开，免得打断编辑）
  const quickOpened = useRef(false);
  useEffect(() => {
    if (!quickView || loading || quickOpened.current) return;
    const item = opportunities.find((x) => x.id === quickView.id);
    if (!item) {
      if (opportunities.length > 0) quickView.onClose();
      return;
    }
    // 下一拍再开弹窗，避免在 effect 里同步 setState；标记在真正打开时才置位，
    // 否则开发模式下 effect 跑两遍会把定时器清掉又不再重排
    const timer = setTimeout(() => {
      quickOpened.current = true;
      openEdit(item);
    }, 0);
    return () => clearTimeout(timer);
  }, [quickView, loading, opportunities, openEdit]);

  const save = async () => {
    if (!form.title.trim()) {
      alert("请填写标题");
      return;
    }
    const payload = {
      ...form,
      lane,
      deadline: form.deadline || null,
      projectId: form.projectId || null,
      goalId: form.goalId || null,
      contactIds: form.contactIds,
    };
    if (editing) {
      await fetch(`/api/opportunities/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/opportunities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    closeModal();
    invalidateFetchCache("/api/timeline");
    invalidateFetchCache("/api/opportunities");
    invalidateFetchCache("/api/stream");
    void load();
  };

  const remove = async (id: string) => {
    if (!confirm(lane === "life" ? "删除此局？" : "删除此机会？")) return;
    await fetch(`/api/opportunities/${id}`, { method: "DELETE" });
    invalidateFetchCache("/api/timeline");
    invalidateFetchCache("/api/opportunities");
    void load();
  };

  const toggleContact = (id: string) => {
    setForm((f) => ({
      ...f,
      contactIds: f.contactIds.includes(id)
        ? f.contactIds.filter((x) => x !== id)
        : [...f.contactIds, id],
    }));
  };

  const editModal = (
    <Modal
      open={modalOpen}
      onClose={closeModal}
      title={editing ? (lane === "life" ? "编辑局" : "编辑机会") : createLabel}
      wide
    >
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <Field>
          <Label>标题</Label>
          <Input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder={titlePlaceholder}
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <Label>分类</Label>
            <Select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field>
            <Label>状态</Label>
            <Select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              {Object.entries(OPPORTUNITY_STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <Label>截止日期（DDL）</Label>
            <Input
              type="date"
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
            />
            <p className="text-xs text-zinc-400 mt-1">填写后显示在日历；Lost / Passed / Archived 不显示</p>
            <label className="mt-2 flex items-center gap-2 text-xs text-zinc-600">
              <input
                type="checkbox"
                checked={form.emailRemind}
                onChange={(e) => setForm({ ...form, emailRemind: e.target.checked })}
              />
              邮件提醒（全局开启后，按 DDL 提前通知）
            </label>
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
        </div>
        <Field>
          <Label>来源</Label>
          <Input
            value={form.source}
            onChange={(e) => setForm({ ...form, source: e.target.value })}
            placeholder={sourcePlaceholder}
          />
        </Field>
        <Field>
          <Label>下一步行动</Label>
          <Input
            value={form.nextAction}
            onChange={(e) => setForm({ ...form, nextAction: e.target.value })}
            placeholder={nextActionPlaceholder}
          />
        </Field>
        <Field>
          <Label>相关联系人</Label>
          <div className="flex flex-wrap gap-2 mt-1 max-h-28 overflow-y-auto">
            {contacts.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleContact(c.id)}
                className={`px-2 py-1 rounded-lg text-xs border ${
                  form.contactIds.includes(c.id)
                    ? "bg-amber-50 border-amber-300 text-amber-800"
                    : "border-zinc-200 text-zinc-600"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-4">
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
            <Label>关联目标</Label>
            <Select
              value={form.goalId}
              onChange={(e) => setForm({ ...form, goalId: e.target.value })}
            >
              <option value="">无</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field>
          <Label>笔记</Label>
          <Textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="min-h-[120px] font-mono text-sm"
            placeholder={notesPlaceholder}
          />
        </Field>
        {editing?.deadline && (
          <Link href="/timeline" className="text-sm text-amber-700 hover:underline">
            在时间线中查看 DDL →
          </Link>
        )}
        <div className="flex gap-2 pt-2">
          <Button onClick={() => void save()}>保存</Button>
          <Button variant="secondary" onClick={closeModal}>
            取消
          </Button>
        </div>
      </div>
    </Modal>
  );

  if (quickView) return editModal;

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setForm(emptyForm);
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> {createLabel}
          </Button>
        }
      />

      <CachedContent loading={loading} error={error} onRetry={load} hasData={opportunities.length > 0}>
      {sop}

      <FilterTabs
        tabs={[
          { key: "open", label: "进行中" },
          { key: "upcoming", label: "即将到期" },
          { key: "Watching", label: "观察中" },
          { key: "Active", label: "推进中" },
          { key: "Won", label: "已拿下" },
          { key: "Archived", label: "已归档" },
          { key: "all", label: "全部" },
        ]}
        value={filter}
        onChange={setFilter}
      />

      {opportunities.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="space-y-3">
          {opportunities.map((item) => (
            <Card
              key={item.id}
              className={`${accentClassName} [content-visibility:auto] [contain-intrinsic-size:auto_96px] transition-colors`}
            >
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-medium text-zinc-900">{item.title}</span>
                      <Badge className={OPPORTUNITY_STATUS[item.status]?.color}>
                        {OPPORTUNITY_STATUS[item.status]?.label || item.status}
                      </Badge>
                      <Badge className="bg-zinc-100 text-zinc-600">{item.category}</Badge>
                      <Badge className={PROJECT_PRIORITY[item.priority]?.color}>
                        {PROJECT_PRIORITY[item.priority]?.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-zinc-500 flex items-center gap-1.5 flex-wrap">
                      {item.deadline ? (
                        <>
                          <CalendarClock className="h-3.5 w-3.5" />
                          DDL {formatDate(item.deadline)}
                          <span className="text-amber-700/80">· 已进时间线</span>
                        </>
                      ) : (
                        <span>无截止日期</span>
                      )}
                      {item.source && <span>· 来源 {item.source}</span>}
                      {item.project && <span>· {item.project.name}</span>}
                    </p>
                    {item.contacts.length > 0 && (
                      <p className="text-xs text-zinc-500 mt-1 flex items-center gap-1">
                        <Users className="h-3 w-3 shrink-0" />
                        <ContactNameList
                          people={item.contacts.map((a) => ({
                            id: a.contact.id,
                            name: a.contact.name,
                            role: a.role,
                          }))}
                        />
                      </p>
                    )}
                    {item.nextAction && (
                      <p className="text-sm text-zinc-700 mt-2">下一步：{item.nextAction}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="secondary" onClick={() => openEdit(item)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => void remove(item.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editModal}
      </CachedContent>
    </>
  );
}
