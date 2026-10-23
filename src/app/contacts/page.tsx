"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { ContactProfileTab } from "@/components/contacts/ContactProfilePanel";
import { PartnerBoard } from "@/components/contacts/PartnerBoard";
import { CircleManager } from "@/components/contacts/CircleManager";
import { ContactMaintenance } from "@/components/contacts/ContactMaintenance";
import { contactDue } from "@/lib/contact-maintenance";
import { setFetchCache, subscribeFetchCache } from "@/lib/fetch-cache";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Badge, EmptyState } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea, Label, Field } from "@/components/ui/Input";
import { ResizableSplitPane } from "@/components/ui/ResizableSplitPane";
import {
  DataTable,
  TableHead,
  SortableTableHeaderCell,
  TableBody,
  TableRow,
  TableCell,
  TableActions,
  TableCount,
} from "@/components/ui/Table";
import {
  formatDate,
  daysSinceContact,
  isOverdue,
  CONTACT_TYPES,
} from "@/lib/utils";
import { Plus, Star, MessageSquare, Trash2, Pencil, History, Heart } from "lucide-react";
import {
  CachedContent,
  mutateJson,
  PageLoading,
  fetchJson,
  refetchJson,
  peekFetchCache,
  shouldShowPageLoading,
} from "@/components/ui/PageState";
import { parseTags, tagsFromInput } from "@/lib/tags";
import { CRUSH_TAG, hasCrushTag } from "@/lib/contact-crush";
import {
  citiesFromInput,
  citiesToInput,
  institutionsFromInput,
  institutionsToInput,
  parseCities,
  parseInstitutions,
  stringifyCities,
  stringifyInstitutions,
} from "@/lib/contact-places";
import {
  compareDates,
  compareStrings,
  type SortDirection,
} from "@/lib/table-sort";
import { useDeepLinkOpen } from "@/lib/useDeepLink";
import { ContactSopPanel } from "@/components/contacts/ContactSopPanel";
import { MeetNewSop } from "@/components/contacts/MeetNewSop";
import { ContactCircleMap } from "@/components/contacts/ContactCircleMap";
import {
  CONTACT_LOG_REASONS,
  hasContactLogReason,
  type ContactLogReason,
} from "@/lib/contact-sop";
import {
  FREQUENCY_BUCKETS,
  FREQUENCY_PRESETS,
  formatFrequencyLabel,
  getFrequencyBucket,
} from "@/lib/contact-frequency";
import { cn } from "@/lib/utils";
import { UI_COPY } from "@/lib/ui-copy";

const ContactProfilePanel = dynamic(() => import("@/components/contacts/ContactProfilePanel").then((m) => m.ContactProfilePanel), { loading: () => <PageLoading label="加载联系人档案…" /> });

type Category = { id: string; name: string; color: string };
type Contact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  position: string | null;
  categoryId: string | null;
  category: Category | null;
  lastContactAt: string | null;
  contactFrequencyDays: number;
  birthday: string | null;
  notes: string | null;
  tags: string;
  importance: number;
  institution: string | null;
  city: string | null;
  institutions?: string[];
  cities?: string[];
  responseLevel: number | null;
  logs: Array<{ id: string; type: string; content: string | null; contactedAt: string }>;
};

type ContactSortKey =
  | "name"
  | "category"
  | "institution"
  | "city"
  | "frequency"
  | "lastContactAt";

function sortContacts(items: Contact[], key: ContactSortKey, dir: SortDirection): Contact[] {
  return [...items].sort((a, b) => {
    switch (key) {
      case "name":
        return compareStrings(a.name, b.name, dir);
      case "category":
        return compareStrings(a.category?.name || "", b.category?.name || "", dir);
      case "institution": {
        const aa = (a.institutions ?? parseInstitutions(a.institution)).join("、");
        const bb = (b.institutions ?? parseInstitutions(b.institution)).join("、");
        return compareStrings(aa, bb, dir);
      }
      case "city": {
        const aa = (a.cities ?? parseCities(a.city)).join("、");
        const bb = (b.cities ?? parseCities(b.city)).join("、");
        return compareStrings(aa, bb, dir);
      }
      case "frequency": {
        const cmp = a.contactFrequencyDays - b.contactFrequencyDays;
        return dir === "asc" ? cmp : -cmp;
      }
      case "lastContactAt":
      default:
        return compareDates(a.lastContactAt, b.lastContactAt, dir);
    }
  });
}

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  position: "",
  categoryId: "",
  contactFrequencyDays: 30,
  birthday: "",
  tags: "",
  importance: 3,
  institutions: "",
  cities: "",
  responseLevel: "",
  crush: false,
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>(
    () => peekFetchCache<{ contacts: Contact[] }>("/api/contacts")?.contacts ?? []
  );
  const [categories, setCategories] = useState<Category[]>(
    () => peekFetchCache<{ categories: Category[] }>("/api/contacts")?.categories ?? []
  );
  const [filter, setFilter] = useState("all");
  /** all | weekly | biweekly | ... */
  const [freqFilter, setFreqFilter] = useState<string>("all");
  /** When true, list is split into cadence sections */
  const [groupByFreq, setGroupByFreq] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [logModal, setLogModal] = useState<Contact | null>(null);
  const [catModal, setCatModal] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [logForm, setLogForm] = useState({ type: "message", content: "", contactedAt: "" });
  const [logReasons, setLogReasons] = useState<Record<ContactLogReason, boolean>>({
    connect: true,
    specific: false,
    update: false,
    trigger: false,
  });
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [profileTab, setProfileTab] = useState<ContactProfileTab>("notes");
  const [loading, setLoading] = useState(() => shouldShowPageLoading(["/api/contacts"]));
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"circles" | "list" | "partner">("circles");
  /** 约会看板：联系人有改动时 +1 刷新 */
  const [partnerVersion, setPartnerVersion] = useState(0);
  const [sortKey, setSortKey] = useState<ContactSortKey>("lastContactAt");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  const closeProfile = useCallback(() => {
    setSelectedId(null);
    setProfileTab("notes");
  }, []);

  /** Row/name: toggle archive. Pass tab to force-open (e.g. 往来). */
  const openProfile = useCallback(
    (id: string, tab?: ContactProfileTab) => {
      if (tab) {
        setSelectedId(id);
        setProfileTab(tab);
        return;
      }
      setSelectedId((prev) => {
        if (prev === id) {
          setProfileTab("notes");
          return null;
        }
        setProfileTab("notes");
        return id;
      });
    },
    []
  );

  const loadVersion = useRef(0);
  const load = useCallback(async (force = false) => {
    const version = ++loadVersion.current;
    if (shouldShowPageLoading(["/api/contacts"])) setLoading(true);
    setError(null);
    try {
      const d = force
        ? await refetchJson<{ contacts: Contact[]; categories: Category[] }>("/api/contacts")
        : await fetchJson<{ contacts: Contact[]; categories: Category[] }>("/api/contacts");
      if (version !== loadVersion.current) return;
      setContacts(d.contacts);
      setCategories(d.categories);
    } catch (e) {
      if (version === loadVersion.current) setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial request reuses the same retry loader
  useEffect(() => { void load(); }, [load]);
  useEffect(() => subscribeFetchCache(() => {
    const cached = peekFetchCache<{ contacts: Contact[]; categories: Category[] }>("/api/contacts");
    if (cached) { setContacts(cached.contacts); setCategories(cached.categories); }
  }), []);

  const runMutation = async (action: () => Promise<void>) => {
    if (savingRef.current) return;
    savingRef.current = true; setSaving(true); setMutationError(null);
    try { await action(); }
    catch (e) { setMutationError(e instanceof Error ? e.message : "保存失败，请重试"); }
    finally { savingRef.current = false; setSaving(false); }
  };

  const openCreate = () => {
    setMutationError(null);
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = useCallback((c: Contact) => {
    setMutationError(null);
    setEditing(c);
    setForm({
      name: c.name,
      email: c.email || "",
      phone: c.phone || "",
      position: c.position || "",
      categoryId: c.categoryId || "",
      contactFrequencyDays: c.contactFrequencyDays,
      birthday: c.birthday ? c.birthday.slice(0, 10) : "",
      tags: parseTags(c.tags).join(", "),
      importance: c.importance,
      institutions: institutionsToInput(c.institutions ?? c.institution),
      cities: citiesToInput(c.cities ?? c.city),
      responseLevel: c.responseLevel?.toString() || "",
      crush: hasCrushTag(c.tags),
    });
    setModalOpen(true);
  }, []);

  useDeepLinkOpen(
    useCallback((id) => {
      setSelectedId(id);
      setProfileTab("notes");
    }, []),
    !loading && contacts.length > 0
  );

  const filtered = useMemo(() => contacts.filter((c) => {
    const q = deferredSearch.toLowerCase().trim();
    const orgs = c.institutions ?? parseInstitutions(c.institution);
    const cities = c.cities ?? parseCities(c.city);
    const matchSearch =
      !q ||
      c.name.toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.phone ?? "").includes(q) ||
      (c.position ?? "").toLowerCase().includes(q) ||
      orgs.some((t) => t.toLowerCase().includes(q)) ||
      cities.some((t) => t.toLowerCase().includes(q)) ||
      parseTags(c.tags).some((t) => t.toLowerCase().includes(q));
    if (!matchSearch) return false;
    if (filter === "overdue" || filter === "soon" || filter === "never") {
      const status = contactDue(c).status;
      if (status !== (filter === "overdue" ? "due" : filter)) return false;
    } else if (filter === "uncircled") {
      if (c.categoryId) return false;
    } else if (filter === "crush") {
      if (!hasCrushTag(c.tags)) return false;
    } else if (filter !== "all" && c.categoryId !== filter) {
      return false;
    }
    if (freqFilter !== "all") {
      const bucket = FREQUENCY_BUCKETS.find((b) => b.id === freqFilter);
      if (!bucket?.match(c.contactFrequencyDays)) return false;
    }
    return true;
  }), [contacts, deferredSearch, filter, freqFilter]);

  const sorted = useMemo(
    () => sortContacts(filtered, sortKey, sortDir),
    [filtered, sortKey, sortDir]
  );

  const freqCounts = useMemo(() => {
    const map = Object.fromEntries(FREQUENCY_BUCKETS.map((b) => [b.id, 0])) as Record<string, number>;
    for (const c of contacts) {
      const id = getFrequencyBucket(c.contactFrequencyDays).id;
      map[id] = (map[id] ?? 0) + 1;
    }
    return map;
  }, [contacts]);

  const groupedByFreq = useMemo(() => {
    if (!groupByFreq) return null;
    return FREQUENCY_BUCKETS.map((bucket) => ({
      bucket,
      items: sorted.filter((c) => bucket.match(c.contactFrequencyDays)),
    })).filter((g) => g.items.length > 0);
  }, [groupByFreq, sorted]);

  const handleSort = (key: ContactSortKey) => {
    setSortKey(key);
    setSortDir((dir) => {
      if (sortKey === key) return dir === "asc" ? "desc" : "asc";
      // 上次联系：新切到该列默认「最近在前」；周期默认「更密在前」
      if (key === "lastContactAt") return "desc";
      if (key === "frequency") return "asc";
      return "asc";
    });
  };

  const save = () => runMutation(async () => {
    const payload = {
      name: form.name.trim(),
      email: form.email,
      phone: form.phone,
      position: form.position,
      categoryId: form.categoryId || null,
      contactFrequencyDays: form.contactFrequencyDays,
      birthday: form.birthday || null,
      tags: tagsFromInput(form.tags).filter((t) => t !== CRUSH_TAG),
      crush: form.crush,
      importance: form.importance,
      responseLevel: form.responseLevel ? +form.responseLevel : null,
      institution: stringifyInstitutions(institutionsFromInput(form.institutions)),
      city: stringifyCities(citiesFromInput(form.cities)),
      company: null,
    };
    if (editing) {
      await mutateJson(`/api/contacts/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      const created = await mutateJson<{ id: string }>("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (created?.id) setSelectedId(created.id);
    }
    setModalOpen(false);
    await load(true);
  });

  const openLog = (c: Contact) => {
    setMutationError(null);
    setLogModal(c);
    setLogForm({ type: "message", content: "", contactedAt: "" });
    setLogReasons({ connect: true, specific: false, update: false, trigger: false });
  };

  const toggleLogReason = (key: ContactLogReason, checked: boolean) => {
    setLogReasons((prev) => ({ ...prev, [key]: checked }));
    if (checked) {
      const tpl = CONTACT_LOG_REASONS.find((r) => r.key === key)?.template;
      if (tpl && !logForm.content.trim()) {
        setLogForm((prev) => ({ ...prev, content: tpl }));
      }
    }
  };

  const moveToCircle = (id: string, categoryId: string | null) => runMutation(async () => {
    await mutateJson(`/api/contacts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId }),
    });
    await load(true);
  });

  const saveLog = () => runMutation(async () => {
    if (!logModal) return;
    if (!hasContactLogReason(logReasons)) {
      const ok = confirm(
        "未勾选联系类型。\n\n建议至少勾「续温 / Stay Connected」。若只是补记历史，仍可继续保存。\n\n继续保存记录？"
      );
      if (!ok) return;
    }
    await mutateJson(`/api/contacts/${logModal.id}/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...logForm, contactedAt: logForm.contactedAt ? new Date(`${logForm.contactedAt}T00:00:00`).toISOString() : undefined }),
    });
    setLogModal(null);
    setLogForm({ type: "message", content: "", contactedAt: "" });
    setLogReasons({ connect: true, specific: false, update: false, trigger: false });
    await load(true);
  });

  const remove = (id: string) => runMutation(async () => {
    if (!confirm("确定删除此联系人？")) return;
    await mutateJson(`/api/contacts/${id}`, { method: "DELETE" });
    if (selectedId === id) setSelectedId(null);
    await load(true);
  });

  const selectedContact = contacts.find((c) => c.id === selectedId) ?? null;

  const patchContactNotes = useCallback((id: string, patch: { notes?: string | null; tags?: string }) => {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    const cached = peekFetchCache<{ contacts: Contact[]; categories: Category[] }>("/api/contacts");
    if (cached) setFetchCache("/api/contacts", { ...cached, contacts: cached.contacts.map((c) => c.id === id ? { ...c, ...patch } : c) });
  }, []);

  const renderContactRows = (items: Contact[]) =>
    items.map((c) => {
      const days = daysSinceContact(c.lastContactAt ? new Date(c.lastContactAt) : null);
      const overdue = isOverdue(
        c.lastContactAt ? new Date(c.lastContactAt) : null,
        c.contactFrequencyDays
      );
      const selected = selectedId === c.id;
      const freq = getFrequencyBucket(c.contactFrequencyDays);
      return (
        <TableRow
          key={c.id}
          className={cn(
            "cursor-pointer",
            overdue && !selected && "bg-red-50/40",
            selected && "bg-indigo-50/80 hover:bg-indigo-50/80"
          )}
          onClick={() => openProfile(c.id)}
        >
          <TableCell>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="font-medium text-indigo-700 hover:underline text-left"
                onClick={(e) => {
                  e.stopPropagation();
                  openProfile(c.id);
                }}
              >
                {c.name}
              </button>
              {hasCrushTag(c.tags) && (
                <Heart className="h-3 w-3 fill-rose-500 text-rose-500 shrink-0" />
              )}
              {Array.from({ length: c.importance }).map((_, i) => (
                <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
              ))}
            </div>
          </TableCell>
          <TableCell>
            <Badge className={cn(freq.className, "text-[10px] px-1.5 py-0")}>
              {formatFrequencyLabel(c.contactFrequencyDays)}
            </Badge>
          </TableCell>
          <TableCell>
            {c.category ? (
              <Badge color={c.category.color}>{c.category.name}</Badge>
            ) : (
              <span className="text-zinc-400">—</span>
            )}
          </TableCell>
          <TableCell>
            {(() => {
              const orgs = c.institutions ?? parseInstitutions(c.institution);
              if (!orgs.length) return <span className="text-zinc-400">—</span>;
              return (
                <div className="flex flex-wrap gap-1 max-w-[220px]">
                  {orgs.map((org) => (
                    <Badge key={org} className="bg-zinc-100 text-zinc-700">
                      {org}
                    </Badge>
                  ))}
                </div>
              );
            })()}
          </TableCell>
          <TableCell>
            {(() => {
              const cities = c.cities ?? parseCities(c.city);
              if (!cities.length) return <span className="text-zinc-400">—</span>;
              return (
                <div className="flex flex-wrap gap-1 max-w-[160px]">
                  {cities.map((city) => (
                    <Badge key={city} className="bg-sky-50 text-sky-800">
                      {city}
                    </Badge>
                  ))}
                </div>
              );
            })()}
          </TableCell>
          <TableCell>
            <div className={overdue ? "text-red-600" : "text-zinc-600"}>
              <div className="whitespace-nowrap text-xs">
                {c.lastContactAt ? formatDate(c.lastContactAt) : "从未联系"}
              </div>
              {days !== null && (
                <div className="text-[11px] text-zinc-400">{days} 天前</div>
              )}
            </div>
          </TableCell>
          <TableCell>
            <TableActions>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  openProfile(c.id, "thread");
                }}
                title="往来"
              >
                <History className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  openLog(c);
                }}
                title="记录联系"
              >
                <MessageSquare className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedId(c.id);
                  openEdit(c);
                }}
                title="编辑"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  void remove(c.id);
                }}
                title="删除"
              >
                <Trash2 className="h-3.5 w-3.5 text-red-500" />
              </Button>
            </TableActions>
          </TableCell>
        </TableRow>
      );
    });

  const contactTableHead = (
    <TableHead>
      <SortableTableHeaderCell
        active={sortKey === "name"}
        direction={sortDir}
        onSort={() => handleSort("name")}
      >
        姓名
      </SortableTableHeaderCell>
      <SortableTableHeaderCell
        active={sortKey === "frequency"}
        direction={sortDir}
        onSort={() => handleSort("frequency")}
      >
        联系周期
      </SortableTableHeaderCell>
      <SortableTableHeaderCell
        active={sortKey === "category"}
        direction={sortDir}
        onSort={() => handleSort("category")}
      >
        分类
      </SortableTableHeaderCell>
      <SortableTableHeaderCell
        active={sortKey === "institution"}
        direction={sortDir}
        onSort={() => handleSort("institution")}
      >
        单位
      </SortableTableHeaderCell>
      <SortableTableHeaderCell
        active={sortKey === "city"}
        direction={sortDir}
        onSort={() => handleSort("city")}
      >
        地点
      </SortableTableHeaderCell>
      <SortableTableHeaderCell
        active={sortKey === "lastContactAt"}
        direction={sortDir}
        onSort={() => handleSort("lastContactAt")}
      >
        上次联系
      </SortableTableHeaderCell>
      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-zinc-500 whitespace-nowrap">
        操作
      </th>
    </TableHead>
  );

  const contactTable = (
    <DataTable>
      {contactTableHead}
      <TableBody>{renderContactRows(sorted)}</TableBody>
    </DataTable>
  );

  const contactGroupedTables = groupedByFreq ? (
    <div className="space-y-5">
      {groupedByFreq.map(({ bucket, items }) => (
        <div key={bucket.id}>
          <div className="flex items-center gap-2 px-2 mb-1.5">
            <Badge className={cn(bucket.className, "text-[11px] px-2 py-0.5")}>{bucket.label}</Badge>
            <span className="text-[11px] text-zinc-400">{bucket.hint}</span>
            <span className="text-[11px] text-zinc-400 tabular-nums">· {items.length}</span>
          </div>
          <DataTable>
            {contactTableHead}
            <TableBody>{renderContactRows(items)}</TableBody>
          </DataTable>
        </div>
      ))}
    </div>
  ) : (
    contactTable
  );

  return (
    <>
      <PageHeader
        title="关系圈子"
        description="把关系整理成圈子，让每次联系有记录、每段关系有节奏。"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setCatModal(true)}>
              管理圈子
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" /> 添加联系人
            </Button>
          </div>
        }
      />

      <CachedContent loading={loading} error={error} onRetry={load} hasData={contacts.length > 0}>
      {mutationError && !modalOpen && !logModal && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{mutationError}</p>}
      <ContactMaintenance contacts={contacts} filtered={filtered} filter={filter} onFilter={setFilter}
        onSelect={(id) => openProfile(id, "notes")} onLog={(id) => { const c = contacts.find((p) => p.id === id); if (c) openLog(c); }} />
      <MeetNewSop />
      <details className="mb-4 text-xs text-zinc-500"><summary className="cursor-pointer py-2">联系建议与行动模板</summary><ContactSopPanel /></details>

      <div className="flex gap-3 mb-3 flex-wrap items-center">
        <Input
          aria-label="搜索联系人"
          placeholder="姓名、单位、地点、标签、电话…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select aria-label="筛选圈子或维护状态" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-[160px]">
          <option value="all">全部圈子</option>
          <option value="overdue">今天／逾期待联系</option>
          <option value="soon">未来 7 天</option>
          <option value="never">尚未联系</option>
          <option value="uncircled">未分圈</option>
          <option value="crush">心动</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <button
          type="button"
          onClick={() => setView("circles")}
          className={cn(
            "text-[11px] px-2.5 py-1.5 rounded-full border transition-colors",
            view === "circles"
              ? "bg-zinc-900 text-white border-zinc-900"
              : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"
          )}
        >
          圈子
        </button>
        <button
          type="button"
          onClick={() => setView("list")}
          className={cn(
            "text-[11px] px-2.5 py-1.5 rounded-full border transition-colors",
            view === "list"
              ? "bg-zinc-900 text-white border-zinc-900"
              : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"
          )}
        >
          列表
        </button>
        <button
          type="button"
          onClick={() => setView("partner")}
          className={cn(
            "text-[11px] px-2.5 py-1.5 rounded-full border transition-colors",
            view === "partner"
              ? "bg-rose-600 text-white border-rose-600"
              : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"
          )}
        >
          {UI_COPY.contacts.partnerTab}
        </button>
        {view === "list" && (
          <button
            type="button"
            onClick={() => setGroupByFreq((v) => !v)}
            className={cn(
              "text-[11px] px-2.5 py-1.5 rounded-full border transition-colors",
              groupByFreq
                ? "bg-zinc-900 text-white border-zinc-900"
                : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"
            )}
          >
            {groupByFreq ? "按周期分列 · 开" : "按周期分列 · 关"}
          </button>
        )}
      </div>

      {(search || filter !== "all" || freqFilter !== "all") && <Button size="sm" variant="ghost" className="mb-3" onClick={() => { setSearch(""); setFilter("all"); setFreqFilter("all"); }}>清除筛选 · 显示全部关系</Button>}
      <div className="flex gap-1.5 mb-6 flex-wrap items-center">
        <span className="text-[11px] text-zinc-400 mr-1">联系周期</span>
        <button
          type="button"
          onClick={() => setFreqFilter("all")}
          className={cn(
            "text-[11px] px-2.5 py-1 rounded-full border transition-colors",
            freqFilter === "all"
              ? "bg-zinc-900 text-white border-zinc-900"
              : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"
          )}
        >
          全部 {contacts.length}
        </button>
        {FREQUENCY_BUCKETS.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setFreqFilter(b.id)}
            title={b.hint}
            className={cn(
              "text-[11px] px-2.5 py-1 rounded-full border transition-colors",
              freqFilter === b.id
                ? cn(b.className, "border-transparent font-semibold")
                : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"
            )}
          >
            {b.label} {freqCounts[b.id] ?? 0}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        contacts.length === 0 ? (
          <EmptyState title="暂无联系人" description="点击右上角添加你的第一个联系人" />
        ) : (
          <EmptyState title="没有匹配的联系人" description="试试调整搜索词或筛选条件" />
        )
      ) : (
        <div className="min-h-[calc(100vh-16rem)] flex flex-col">
          <TableCount count={sorted.length} label="位联系人" />
          {selectedContact ? (
            <ResizableSplitPane
              storageKey="lifeos-contacts-split"
              defaultLeftWidth={560}
              minLeft={320}
              minRight={420}
              className="flex-1 min-h-0 mt-2 border border-zinc-200 rounded-xl bg-white overflow-hidden"
              left={
                view === "partner" ? (
                  <div className="h-full overflow-auto">
                    <PartnerBoard
                      selectedId={selectedId}
                      version={partnerVersion}
                      onSelect={(id) => openProfile(id, "partner")}
                      onAdded={() => void load(true)}
                    />
                  </div>
                ) : view === "circles" ? (
                  <div className="h-full overflow-auto">
                    <ContactCircleMap
                      contacts={sorted}
                      categories={categories}
                      selectedId={selectedId}
                      onSelect={(id) => openProfile(id)}
                      onEdit={(id) => {
                        const person = contacts.find((c) => c.id === id);
                        if (person) openEdit(person);
                      }}
                      onLog={(id) => {
                        const person = contacts.find((c) => c.id === id);
                        if (person) openLog(person);
                      }}
                      onDelete={(id) => void remove(id)}
                      onMove={(id, categoryId) => void moveToCircle(id, categoryId)}
                    />
                  </div>
                ) : (
                  <div className="p-2">{contactGroupedTables}</div>
                )
              }
              right={
                <ContactProfilePanel
                  key={selectedContact.id}
                  contact={selectedContact}
                  tab={profileTab}
                  onTabChange={setProfileTab}
                  onClose={closeProfile}
                  onContactUpdate={patchContactNotes}
                  onEdit={() => openEdit(selectedContact)}
                  onLog={() => openLog(selectedContact)}
                  onLogSaved={() => {
                    void load(true);
                    setPartnerVersion((v) => v + 1);
                  }}
                />
              }
            />
          ) : (
            <div className="mt-2 border border-zinc-200 rounded-xl bg-white overflow-hidden">
              {view === "partner" ? (
                <PartnerBoard
                  selectedId={selectedId}
                  version={partnerVersion}
                  onSelect={(id) => openProfile(id, "partner")}
                  onAdded={() => void load(true)}
                />
              ) : view === "circles" ? (
                <ContactCircleMap
                  contacts={sorted}
                  categories={categories}
                  selectedId={selectedId}
                  onSelect={(id) => openProfile(id)}
                  onEdit={(id) => {
                    const person = contacts.find((c) => c.id === id);
                    if (person) openEdit(person);
                  }}
                  onLog={(id) => {
                    const person = contacts.find((c) => c.id === id);
                    if (person) openLog(person);
                  }}
                  onDelete={(id) => void remove(id)}
                  onMove={(id, categoryId) => void moveToCircle(id, categoryId)}
                />
              ) : (
                <div className="p-2">{contactGroupedTables}</div>
              )}
            </div>
          )}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => { if (!saving) { setModalOpen(false); setMutationError(null); } }} title={editing ? "编辑联系人" : "添加联系人"} wide>
        <div className="grid grid-cols-2 gap-4">
          <Field className="col-span-2">
            <Label>姓名 *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field>
            <Label>电话</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
          <Field>
            <Label>邮箱</Label>
            <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field>
            <Label>职位</Label>
            <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
          </Field>
          <Field>
            <Label>分类</Label>
            <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">无分类</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field>
            <Label>联系周期</Label>
            <Select
              value={String(form.contactFrequencyDays)}
              onChange={(e) => setForm({ ...form, contactFrequencyDays: +e.target.value })}
            >
              {FREQUENCY_PRESETS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
              {!FREQUENCY_PRESETS.some((p) => p.value === form.contactFrequencyDays) && (
                <option value={form.contactFrequencyDays}>
                  自定义（{form.contactFrequencyDays} 天）
                </option>
              )}
            </Select>
            <p className="text-[11px] text-zinc-400 mt-1">
              {getFrequencyBucket(form.contactFrequencyDays).hint}
            </p>
          </Field>
          <Field>
            <Label>生日</Label>
            <Input type="date" value={form.birthday} onChange={(e) => setForm({ ...form, birthday: e.target.value })} />
          </Field>
          <Field className="col-span-2">
            <Label>单位（标签，逗号分隔）</Label>
            <Input
              value={form.institutions}
              onChange={(e) => setForm({ ...form, institutions: e.target.value })}
              placeholder={UI_COPY.contacts.schoolPlaceholder}
            />
            <p className="text-[11px] text-zinc-400 mt-1">{UI_COPY.contacts.schoolHint}</p>
          </Field>
          <Field className="col-span-2">
            <Label>地点（标签，逗号分隔）</Label>
            <Input
              value={form.cities}
              onChange={(e) => setForm({ ...form, cities: e.target.value })}
              placeholder={UI_COPY.contacts.cityPlaceholder}
            />
            <p className="text-[11px] text-zinc-400 mt-1">与单位分开；Singapore / 新加坡 会归一为「新加坡」</p>
          </Field>
          <Field>
            <Label>回应积极度 (1-5)</Label>
            <Input type="number" min={1} max={5} value={form.responseLevel} onChange={(e) => setForm({ ...form, responseLevel: e.target.value })} />
          </Field>
          <Field>
            <Label>重要程度 (1-5)</Label>
            <Input type="number" min={1} max={5} value={form.importance} onChange={(e) => setForm({ ...form, importance: +e.target.value })} />
          </Field>
          <Field className="col-span-2">
            <Label>其他标签（逗号分隔）</Label>
            <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="导师, 合作者" />
          </Field>
          <Field className="col-span-2">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={form.crush}
                onChange={(e) => setForm({ ...form, crush: e.target.checked })}
              />
              <span>
                <span className="text-sm text-zinc-800">心动</span>
                <span className="block text-xs text-zinc-500">
                  标记后可看往来分析。分析只基于你写下的备注和联系记录，不猜对方爱不爱。
                </span>
              </span>
            </label>
          </Field>
        </div>
        {mutationError && <p role="alert" className="mt-3 text-sm text-red-600">{mutationError}</p>}
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" disabled={saving} onClick={() => { setModalOpen(false); setMutationError(null); }}>取消</Button>
          <Button onClick={save} disabled={saving || !form.name.trim()}>{saving ? "保存中…" : "保存"}</Button>
        </div>
      </Modal>

      <Modal open={!!logModal} onClose={() => { if (!saving) { setLogModal(null); setMutationError(null); } }} title={`记录联系 — ${logModal?.name}`}>
        <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-3 mb-4">
          <p className="text-xs font-medium text-amber-900 mb-2">
            联系类型（默认续温；从对方优点出发，带一点可提供的实质）
          </p>
          <div className="space-y-2">
            {CONTACT_LOG_REASONS.map((r) => (
              <label key={r.key} className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={logReasons[r.key]}
                  onChange={(e) => toggleLogReason(r.key, e.target.checked)}
                />
                <span>
                  <span className="text-sm text-zinc-800">{r.label}</span>
                  <span className="block text-xs text-zinc-500">{r.hint}</span>
                </span>
              </label>
            ))}
          </div>
          {!hasContactLogReason(logReasons) && (
            <p className="text-xs text-amber-800 mt-2">建议勾选「续温 / Stay Connected」——连接本身就是进度。</p>
          )}
        </div>
        <Field>
          <Label>联系方式</Label>
          <Select value={logForm.type} onChange={(e) => setLogForm({ ...logForm, type: e.target.value })}>
            {Object.entries(CONTACT_TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </Field>
        <Field className="mt-4">
          <Label>联系日期（留空为现在）</Label>
          <Input aria-label="联系日期" type="date" value={logForm.contactedAt} max={new Date().toLocaleDateString("en-CA")} onChange={(e) => setLogForm({ ...logForm, contactedAt: e.target.value })} />
          <p className="mt-1 text-xs text-zinc-400">可补记过去的联系，不会覆盖更新的联系时间。</p>
        </Field>
        <Field className="mt-4">
          <Label>内容</Label>
          <Textarea value={logForm.content} onChange={(e) => setLogForm({ ...logForm, content: e.target.value })} placeholder="聊了什么、问了什么…" />
          <div className="flex flex-wrap gap-1.5 mt-2">
            {CONTACT_LOG_REASONS.map((r) => (
              <button
                key={r.key}
                type="button"
                className="text-xs px-2 py-1 rounded-md bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                onClick={() => setLogForm((prev) => ({ ...prev, content: r.template }))}
              >
                {r.label}模板
              </button>
            ))}
          </div>
        </Field>
        {mutationError && <p role="alert" className="mt-3 text-sm text-red-600">{mutationError}</p>}
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" disabled={saving} onClick={() => { setLogModal(null); setMutationError(null); }}>取消</Button>
          <Button
            disabled={saving}
            onClick={saveLog}
            className={cn(!hasContactLogReason(logReasons) && "bg-amber-600 hover:bg-amber-700")}
          >
            记录
          </Button>
        </div>
      </Modal>

      {catModal && <CircleManager categories={categories} contacts={contacts} onClose={() => setCatModal(false)} onSaved={() => load(true)} />}
      </CachedContent>
    </>
  );
}
