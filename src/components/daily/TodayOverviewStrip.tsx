"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { fetchJson } from "@/components/ui/PageState";
import { InsightCards, type InsightItem } from "@/components/insights/InsightCards";
import { ChevronDown, ChevronUp, Bell, Gift, FolderKanban } from "lucide-react";
import { cn } from "@/lib/utils";

type ReminderPayload = {
  overdueContacts: Array<{ id: string; name: string }>;
  upcomingBirthdays: Array<{ id: string; name: string; daysUntil: number }>;
  projectsDueSoon: Array<{ id: string; name: string; targetDate: string | null }>;
};

type Props = {
  className?: string;
};

/** Compact dashboard leftovers: insights + reminders, for the merged 今日 page. */
export function TodayOverviewStrip({ className }: Props) {
  const [insights, setInsights] = useState<InsightItem[]>([]);
  const [reminders, setReminders] = useState<ReminderPayload | null>(null);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [ins, rem] = await Promise.all([
        fetchJson<{ insights: InsightItem[] }>("/api/insights"),
        fetchJson<ReminderPayload>("/api/reminders"),
      ]);
      setInsights(ins.insights ?? []);
      setReminders(rem);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const overdueN = reminders?.overdueContacts.length ?? 0;
  const bdayN = reminders?.upcomingBirthdays.length ?? 0;
  const dueN = reminders?.projectsDueSoon.length ?? 0;
  const alertN = overdueN + bdayN + dueN;

  return (
    <Card className={cn("mb-4 border-zinc-200", className)}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
      >
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
          今日概览
        </span>
        <span className="text-xs text-zinc-500 truncate">
          {alertN > 0
            ? `待联系 ${overdueN} · 生日 ${bdayN} · 项目临近 ${dueN}`
            : "洞察与提醒"}
        </span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-zinc-400 ml-auto shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-zinc-400 ml-auto shrink-0" />
        )}
      </button>

      {expanded && (
        <CardContent className="pt-0 space-y-4">
          {insights.length > 0 && (
            <InsightCards insights={insights.slice(0, 3)} title="本周洞察" />
          )}

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2">
              <p className="text-[10px] font-semibold text-zinc-400 flex items-center gap-1 mb-1.5">
                <Bell className="h-3 w-3" /> 待联系
              </p>
              {overdueN === 0 ? (
                <p className="text-xs text-zinc-400">无逾期</p>
              ) : (
                <ul className="space-y-1">
                  {reminders!.overdueContacts.slice(0, 4).map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/contacts?open=${c.id}`}
                        className="text-xs text-indigo-700 hover:underline"
                      >
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2">
              <p className="text-[10px] font-semibold text-zinc-400 flex items-center gap-1 mb-1.5">
                <Gift className="h-3 w-3" /> 生日
              </p>
              {bdayN === 0 ? (
                <p className="text-xs text-zinc-400">近几日无</p>
              ) : (
                <ul className="space-y-1">
                  {reminders!.upcomingBirthdays.slice(0, 4).map((c) => (
                    <li key={c.id} className="text-xs text-zinc-700 flex gap-1.5">
                      <span>{c.name}</span>
                      <Badge className="bg-rose-50 text-rose-700 text-[10px] px-1 py-0">
                        {c.daysUntil === 0 ? "今天" : `${c.daysUntil}天后`}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-lg border border-zinc-100 bg-zinc-50/80 px-3 py-2">
              <p className="text-[10px] font-semibold text-zinc-400 flex items-center gap-1 mb-1.5">
                <FolderKanban className="h-3 w-3" /> 项目临近
              </p>
              {dueN === 0 ? (
                <p className="text-xs text-zinc-400">无临近截止</p>
              ) : (
                <ul className="space-y-1">
                  {reminders!.projectsDueSoon.slice(0, 4).map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/projects?open=${p.id}`}
                        className="text-xs text-indigo-700 hover:underline"
                      >
                        {p.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 text-[11px]">
            <Link href="/finance" className="text-zinc-500 hover:text-indigo-600">
              理财 →
            </Link>
            <Link href="/goals" className="text-zinc-500 hover:text-indigo-600">
              目标 →
            </Link>
            <Link href="/projects" className="text-zinc-500 hover:text-indigo-600">
              全部项目 →
            </Link>
            <Link href="/stream" className="text-zinc-500 hover:text-indigo-600">
              事件流 →
            </Link>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
