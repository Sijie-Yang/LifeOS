"use client";

import { contactDue, compareContactPriority, type MaintainableContact } from "@/lib/contact-maintenance";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type Person = MaintainableContact & { id: string; name: string; categoryId: string | null; category: { name: string; color: string } | null };
export function ContactMaintenance({ contacts, filtered, filter, onFilter, onSelect, onLog }: {
  contacts: Person[]; filtered: Person[]; filter: string;
  onFilter: (value: string) => void; onSelect: (id: string) => void; onLog: (id: string) => void;
}) {
  const now = new Date();
  const counts = { all: contacts.length, overdue: 0, soon: 0, never: 0, uncircled: 0 };
  for (const person of contacts) {
    const due = contactDue(person, now);
    if (due.status === "due") counts.overdue++;
    if (due.status === "soon") counts.soon++;
    if (due.status === "never") counts.never++;
    if (!person.categoryId) counts.uncircled++;
  }
  const queue = filtered.filter((person) => contactDue(person, now).status !== "ok")
    .sort((a, b) => compareContactPriority(a, b, now));
  return (
    <section className="mb-5 space-y-3" aria-label="关系维护概览">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        {([
          ["all", "全部关系"], ["overdue", "今天／逾期待联系"], ["soon", "未来 7 天"], ["never", "尚未联系"], ["uncircled", "未分圈"],
        ] as const).map(([key, label]) => (
          <button key={key} type="button" aria-pressed={filter === key} onClick={() => onFilter(key)} className={cn("rounded-xl border p-3 text-left transition-colors", filter === key ? "border-indigo-300 bg-indigo-50" : "border-zinc-200 bg-white hover:border-indigo-200")}>
            <span className="block text-xs text-zinc-500">{label}</span>
            <span className="mt-1 block text-2xl font-semibold tabular-nums text-zinc-800">{counts[key]}</span>
          </button>
        ))}
      </div>
      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="mb-2 flex items-center justify-between gap-2"><h2 className="text-sm font-semibold text-zinc-800">下一步联系</h2><span className="text-xs text-zinc-400">当前筛选 · {queue.length} 人待维护</span></div>
        <p className="mb-3 text-xs text-zinc-500">先处理到期关系，再建立首次联系；同一组内优先重要关系。记录后自动更新联系周期。</p>
        {queue.length === 0 ? <p className="py-2 text-sm text-emerald-700">当前筛选下暂无待维护关系。</p> : (
          <div className="divide-y divide-zinc-100">
            {queue.slice(0, 5).map((person) => {
              const due = contactDue(person, now);
              return <div key={person.id} className="flex items-center gap-3 py-2">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: person.category?.color ?? "#a1a1aa" }} />
                <button type="button" onClick={() => onSelect(person.id)} className="min-w-0 flex-1 truncate text-left text-sm font-medium text-indigo-700 hover:underline">{person.name}<span className="ml-2 text-xs font-normal text-zinc-400">{person.category?.name ?? "未分圈"}</span></button>
                <span className={cn("text-xs", due.status === "due" ? "text-amber-700" : "text-zinc-500")}>{due.label}</span>
                <Button size="sm" variant="secondary" onClick={() => onLog(person.id)}>记录联系</Button>
              </div>;
            })}
          </div>
        )}
      </div>
    </section>
  );
}
