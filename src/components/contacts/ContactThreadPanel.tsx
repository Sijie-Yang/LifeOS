"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Field, Label, Select, Textarea } from "@/components/ui/Input";
import { PageLoading } from "@/components/ui/PageState";
import {
  CONTACT_TYPES,
  OPPORTUNITY_STATUS,
  cn,
  daysSinceContact,
  formatDate,
  formatDateTime,
  isOverdue,
} from "@/lib/utils";
import {
  CONTACT_LOG_REASONS,
  hasContactLogReason,
  type ContactLogReason,
} from "@/lib/contact-sop";
import { MessageCircle } from "lucide-react";

export type ContactLog = {
  id: string;
  type: string;
  content: string | null;
  contactedAt: string;
};

export type ContactDetail = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  position: string | null;
  institution: string | null;
  city: string | null;
  notes: string | null;
  importance: number;
  contactFrequencyDays: number;
  lastContactAt: string | null;
  category: { id: string; name: string; color: string } | null;
  logs: ContactLog[];
  projects: Array<{ project: { id: string; name: string; status: string } }>;
  opportunities: Array<{
    role: string | null;
    opportunity: {
      id: string;
      title: string;
      status: string;
      deadline: string | null;
      nextAction: string | null;
    };
  }>;
  goals: Array<{ goal: { id: string; title: string; status: string; area: string } }>;
  meetingAttendees: Array<{
    meeting: { id: string; title: string; meetingDate: string; status: string };
  }>;
};

type Direction = "out" | "in";

export function parseLogDirection(content: string | null): {
  direction: Direction | null;
  body: string;
} {
  if (!content) return { direction: null, body: "" };
  if (content.startsWith("→ ") || content.startsWith("→")) {
    return { direction: "out", body: content.replace(/^→\s*/, "") };
  }
  if (content.startsWith("← ") || content.startsWith("←")) {
    return { direction: "in", body: content.replace(/^←\s*/, "") };
  }
  return { direction: null, body: content };
}

type Props = {
  contactId: string;
  /** Hide header meta (used when parent already shows profile header) */
  hideHeader?: boolean;
  /** Show notes summary at bottom (QuickView modal) */
  showNotesSummary?: boolean;
  /** Called when an in-panel link should close a parent modal */
  onNavigate?: () => void;
  /** Extra header actions (e.g. 完整页 link) */
  headerActions?: ReactNode;
  /** After a log is saved */
  onLogSaved?: () => void;
  className?: string;
};

export function ContactThreadPanel({
  contactId,
  hideHeader = false,
  showNotesSummary = false,
  onNavigate,
  headerActions,
  onLogSaved,
  className,
}: Props) {
  const [data, setData] = useState<ContactDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [direction, setDirection] = useState<Direction>("out");
  const [logType, setLogType] = useState("email");
  const [logContent, setLogContent] = useState("");
  const [logReasons, setLogReasons] = useState<Record<ContactLogReason, boolean>>({
    connect: false,
    specific: false,
    update: false,
    trigger: false,
  });

  const load = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/contacts/${id}`);
      if (!res.ok) throw new Error("加载失败");
      setData((await res.json()) as ContactDetail);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(contactId);
  }, [contactId, load]);

  const saveLog = async () => {
    if (!logContent.trim()) return;
    setSaving(true);
    try {
      const prefix = direction === "out" ? "→ " : "← ";
      const res = await fetch(`/api/contacts/${contactId}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: logType,
          content: `${prefix}${logContent.trim()}`,
        }),
      });
      if (!res.ok) throw new Error("记录失败");
      setLogContent("");
      setShowLog(false);
      setLogReasons({ connect: false, specific: false, update: false, trigger: false });
      await load(contactId);
      onLogSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "记录失败");
    } finally {
      setSaving(false);
    }
  };

  const overdue =
    data &&
    isOverdue(
      data.lastContactAt ? new Date(data.lastContactAt) : null,
      data.contactFrequencyDays
    );
  const days = data
    ? daysSinceContact(data.lastContactAt ? new Date(data.lastContactAt) : null)
    : null;

  const logsChronological = useMemo(() => {
    if (!data) return [];
    return [...data.logs].sort(
      (a, b) => new Date(a.contactedAt).getTime() - new Date(b.contactedAt).getTime()
    );
  }, [data]);

  if (loading && !data) {
    return <PageLoading label="加载往来…" />;
  }
  if (error && !data) {
    return <p className="text-sm text-rose-600 py-4 text-center">{error}</p>;
  }
  if (!data) return null;

  return (
    <div className={cn("space-y-4", className)}>
      {!hideHeader && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {data.category && (
                <Badge color={data.category.color}>{data.category.name}</Badge>
              )}
              <Badge className="bg-zinc-100 text-zinc-600">★{data.importance}</Badge>
              {overdue ? (
                <Badge className="bg-rose-50 text-rose-700">待跟进</Badge>
              ) : (
                <Badge className="bg-emerald-50 text-emerald-700">节奏正常</Badge>
              )}
            </div>
            <p className="text-xs text-zinc-500">
              {[data.position, data.institution || data.company, data.city]
                .filter(Boolean)
                .join(" · ") || "暂无职位/单位"}
            </p>
            <p className="text-xs text-zinc-500">
              {[data.email, data.phone].filter(Boolean).join(" · ") || "无邮箱/电话"}
              {" · "}
              {data.lastContactAt
                ? `上次 ${formatDate(data.lastContactAt)}${days != null ? `（${days} 天前）` : ""}`
                : "从未联系"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button size="sm" variant="secondary" onClick={() => setShowLog((v) => !v)}>
              <MessageCircle className="h-3.5 w-3.5 mr-1" />
              记一笔
            </Button>
            {headerActions}
          </div>
        </div>
      )}

      {hideHeader && (
        <div className="flex justify-end">
          <Button size="sm" variant="secondary" onClick={() => setShowLog((v) => !v)}>
            <MessageCircle className="h-3.5 w-3.5 mr-1" />
            记一笔
          </Button>
        </div>
      )}

      {(data.opportunities.length > 0 ||
        data.meetingAttendees.length > 0 ||
        data.projects.length > 0 ||
        data.goals.length > 0) && (
        <div className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-2.5 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            关联推进
          </p>
          {data.opportunities.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {data.opportunities.map(({ opportunity: o, role }) => (
                <Link
                  key={o.id}
                  href={`/opportunities?id=${o.id}`}
                  onClick={onNavigate}
                  className="inline-flex items-center gap-1 rounded-md border border-amber-100 bg-white px-2 py-1 text-[11px] text-amber-900 hover:border-amber-300"
                >
                  <span className="font-medium truncate max-w-[180px]">{o.title}</span>
                  <span className="text-amber-600/80">
                    {OPPORTUNITY_STATUS[o.status]?.label ?? o.status}
                  </span>
                  {role && <span className="text-zinc-400">{role}</span>}
                </Link>
              ))}
            </div>
          )}
          {data.meetingAttendees.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {[...data.meetingAttendees]
                .sort((a, b) => b.meeting.meetingDate.localeCompare(a.meeting.meetingDate))
                .slice(0, 12)
                .map(({ meeting: m }) => (
                  <Link
                    key={m.id}
                    href={`/meetings?id=${m.id}`}
                    onClick={onNavigate}
                    className="inline-flex items-center gap-1 rounded-md border border-sky-100 bg-white px-2 py-1 text-[11px] text-sky-900 hover:border-sky-300"
                  >
                    <span className="truncate max-w-[160px]">{m.title}</span>
                    <span className="text-sky-600/80">{m.meetingDate}</span>
                  </Link>
                ))}
            </div>
          )}
          {data.projects.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {data.projects.map(({ project: p }) => (
                <Link
                  key={p.id}
                  href={`/projects?id=${p.id}`}
                  onClick={onNavigate}
                  className="inline-flex rounded-md border border-indigo-100 bg-white px-2 py-1 text-[11px] text-indigo-800 hover:border-indigo-300"
                >
                  {p.name}
                </Link>
              ))}
            </div>
          )}
          {data.goals.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {data.goals.map(({ goal: g }) => (
                <Link
                  key={g.id}
                  href={`/goals/${g.id}`}
                  onClick={onNavigate}
                  className="inline-flex rounded-md border border-violet-100 bg-white px-2 py-1 text-[11px] text-violet-800 hover:border-violet-300"
                >
                  {g.title}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {showLog && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 px-3 py-3 space-y-3">
          <p className="text-xs font-medium text-amber-900">
            记录一来一回 · 续温优先；从对方优点出发，先想能提供什么
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDirection("out")}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 text-sm",
                direction === "out"
                  ? "border-indigo-300 bg-indigo-50 text-indigo-800"
                  : "border-zinc-200 bg-white text-zinc-600"
              )}
            >
              → 我发出
            </button>
            <button
              type="button"
              onClick={() => setDirection("in")}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 text-sm",
                direction === "in"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                  : "border-zinc-200 bg-white text-zinc-600"
              )}
            >
              ← 对方回复
            </button>
          </div>
          <div className="space-y-2">
            {CONTACT_LOG_REASONS.map((r) => (
              <label key={r.key} className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={logReasons[r.key]}
                  onChange={(e) =>
                    setLogReasons((prev) => ({ ...prev, [r.key]: e.target.checked }))
                  }
                />
                <span>
                  <span className="text-sm text-zinc-800">{r.label}</span>
                  <span className="block text-xs text-zinc-500">{r.hint}</span>
                </span>
              </label>
            ))}
          </div>
          <Field>
            <Label>方式</Label>
            <Select value={logType} onChange={(e) => setLogType(e.target.value)}>
              {Object.entries(CONTACT_TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field>
            <Label>内容</Label>
            <Textarea
              value={logContent}
              onChange={(e) => setLogContent(e.target.value)}
              placeholder={
                direction === "out"
                  ? "我发了什么 / ask 了什么…"
                  : "对方回了什么 / 下一步…"
              }
              rows={3}
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {CONTACT_LOG_REASONS.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  className="text-xs px-2 py-1 rounded-md bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50"
                  onClick={() => setLogContent(r.template)}
                >
                  {r.label}模板
                </button>
              ))}
            </div>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowLog(false)}>
              取消
            </Button>
            <Button
              size="sm"
              disabled={!logContent.trim() || saving}
              onClick={() => void saveLog()}
              className={cn(
                !hasContactLogReason(logReasons) && "bg-amber-600 hover:bg-amber-700"
              )}
            >
              {saving ? "保存中…" : "保存这条"}
            </Button>
          </div>
        </div>
      )}

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
          往来推进 · {logsChronological.length} 条
        </p>
        {logsChronological.length === 0 ? (
          <p className="text-sm text-zinc-500 py-8 text-center rounded-xl border border-dashed border-zinc-200">
            还没有往来记录。点「记一笔」写下第一封邮件或对方的回复。
          </p>
        ) : (
          <div className="space-y-2.5 max-h-[min(420px,50vh)] overflow-y-auto pr-1">
            {logsChronological.map((log) => {
              const { direction: dir, body } = parseLogDirection(log.content);
              const isOut = dir === "out";
              const isIn = dir === "in";
              return (
                <div
                  key={log.id}
                  className={cn(
                    "flex",
                    isOut && "justify-end",
                    isIn && "justify-start",
                    !dir && "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-xl border px-3 py-2",
                      isOut && "border-indigo-100 bg-indigo-50/70",
                      isIn && "border-emerald-100 bg-emerald-50/70",
                      !dir && "border-zinc-100 bg-white w-full max-w-full"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <span className="text-[10px] font-medium text-zinc-500">
                        {isOut ? "我 →" : isIn ? "← 对方" : CONTACT_TYPES[log.type] || log.type}
                        {dir && (
                          <span className="ml-1.5 font-normal">
                            · {CONTACT_TYPES[log.type] || log.type}
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] text-zinc-400 shrink-0">
                        {formatDateTime(log.contactedAt)}
                      </span>
                    </div>
                    {(body || log.content) && (
                      <p className="text-sm text-zinc-800 whitespace-pre-wrap">
                        {body || log.content}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showNotesSummary && data.notes && (
        <div className="rounded-xl border border-zinc-100 px-3 py-2">
          <p className="text-[11px] font-semibold text-zinc-500 mb-1">笔记摘要</p>
          <p className="text-xs text-zinc-600 line-clamp-4 whitespace-pre-wrap">{data.notes}</p>
        </div>
      )}

      {error && data && (
        <p className="text-xs text-rose-600">{error}</p>
      )}
    </div>
  );
}
