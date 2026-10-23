"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchJson, invalidateFetchCache } from "@/components/ui/PageState";
import { cn } from "@/lib/utils";
import { PARTNER_CRITERIA, PARTNER_STAGES, type MustStatus, type PartnerStage } from "@/lib/partner-score";

type BoardItem = {
  id: string;
  name: string;
  city: string | null;
  institution: string | null;
  stage: PartnerStage;
  source: string | null;
  total: number | null;
  must: MustStatus;
  daysSince: number | null;
  frequencyDays: number;
  overdue: boolean;
  logs14: number;
};

const MUST_COUNT = PARTNER_CRITERIA.filter((c) => c.must).length;

const STAGE_LABEL = Object.fromEntries(PARTNER_STAGES.map((s) => [s.key, s.label])) as Record<PartnerStage, string>;

/** 联系人页「约会」视图：阶段分布、今天该联系谁、按契合度排序；点名字打开档案的「关系契合度」 */
export function PartnerBoard({
  selectedId,
  version,
  onSelect,
  onAdded,
}: {
  selectedId: string | null;
  /** 外面改过联系人后 +1，看板跟着刷新 */
  version: number;
  onSelect: (id: string) => void;
  onAdded: () => void;
}) {
  const [data, setData] = useState<{ categoryId: string; items: BoardItem[] } | null>(null);
  const [name, setName] = useState("");
  const [rev, setRev] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchJson<{ categoryId: string; items: BoardItem[] }>("/api/contacts/partner-board", { force: true }).then(
      (d) => !cancelled && setData(d)
    );
    return () => {
      cancelled = true;
    };
  }, [version, rev]);

  const add = useCallback(async () => {
    const n = name.trim();
    if (!n || !data) return;
    setName("");
    await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: n, categoryId: data.categoryId, contactFrequencyDays: 3 }),
    });
    invalidateFetchCache("/api/contacts");
    setRev((r) => r + 1);
    onAdded();
  }, [name, data, onAdded]);

  if (!data) return <p className="p-4 text-sm text-zinc-400">加载约会看板…</p>;

  const active = data.items.filter((i) => i.stage !== "closed");
  const due = active.filter((i) => i.overdue);
  const counts = PARTNER_STAGES.map((s) => ({ ...s, n: data.items.filter((i) => i.stage === s.key).length }));

  return (
    <div className="space-y-4 p-3">
      <div className="flex flex-wrap gap-1.5">
        {counts.map((s) => (
          <span key={s.key} className={cn("rounded-full px-2.5 py-1 text-[11px]", s.n ? "bg-rose-50 text-rose-700" : "bg-zinc-50 text-zinc-400")} title={s.hint}>
            {s.label} {s.n}
          </span>
        ))}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="新认识一个人：输入名字或昵称，回车加入「约会对象」"
          className="flex-1 rounded-lg border border-zinc-200 px-2.5 py-1.5 text-sm"
        />
        <button type="submit" disabled={!name.trim()} className="rounded-lg bg-rose-600 px-3 text-xs font-medium text-white disabled:opacity-40">
          加入
        </button>
      </form>

      {due.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
          <p className="mb-1 text-xs font-semibold text-amber-800">今天该线上联系（超过联系周期）</p>
          <div className="flex flex-wrap gap-1.5">
            {due.map((i) => (
              <button key={i.id} type="button" onClick={() => onSelect(i.id)} className="rounded-md bg-white px-2 py-1 text-[12px] text-zinc-800 shadow-sm hover:bg-amber-100">
                {i.name}
                <span className="ml-1 text-[10px] text-amber-700">{i.daysSince == null ? "从没联系" : `${i.daysSince} 天`}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {data.items.length === 0 ? (
        <p className="text-sm text-zinc-500">还没有记录。认识新的人就在上面输入名字加入，然后在档案里评估契合度。</p>
      ) : (
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-zinc-100 text-left text-[11px] text-zinc-400">
              <th className="py-1.5 font-normal">#</th>
              <th className="font-normal">名字</th>
              <th className="font-normal">阶段</th>
              <th className="text-right font-normal">契合度</th>
              <th className="pl-3 font-normal">底线</th>
              <th className="text-right font-normal">上次联系</th>
              <th className="text-right font-normal" title="最近 14 天的往来记录数">14 天往来</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((i, idx) => (
              <tr
                key={i.id}
                onClick={() => onSelect(i.id)}
                className={cn(
                  "cursor-pointer border-b border-zinc-50 hover:bg-zinc-50",
                  i.id === selectedId && "bg-rose-50/60",
                  i.stage === "closed" && "text-zinc-400"
                )}
              >
                <td className="py-1.5 tabular-nums text-zinc-400">{idx + 1}</td>
                <td className="font-medium">
                  {i.name}
                  {i.source && <span className="ml-1 text-[10px] font-normal text-zinc-400">{i.source}</span>}
                </td>
                <td>{STAGE_LABEL[i.stage]}</td>
                <td className="text-right font-semibold tabular-nums">{i.total ?? "—"}</td>
                <td className="pl-3">
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[10px]",
                      i.must.state === "pass" ? "bg-emerald-50 text-emerald-700" : i.must.state === "fail" ? "bg-rose-50 text-rose-700" : "bg-zinc-100 text-zinc-500"
                    )}
                    title={i.must.state === "fail" ? `不达标：${i.must.failed.join("、")}` : i.must.state === "pending" ? `没打分：${i.must.missing.join("、")}` : `${MUST_COUNT} 项底线全部达标`}
                  >
                    {i.must.state === "pass" ? "达标" : i.must.state === "fail" ? `${i.must.failed.length} 项不达标` : `待打分 ${i.must.missing.length}`}
                  </span>
                </td>
                <td className={cn("text-right tabular-nums", i.overdue && i.stage !== "closed" ? "text-amber-700" : "text-zinc-500")}>
                  {i.daysSince == null ? "—" : i.daysSince === 0 ? "今天" : `${i.daysSince} 天前`}
                </td>
                <td className="text-right tabular-nums text-zinc-500">{i.logs14}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="text-[11px] text-zinc-400">排序：阶段越深越靠前，同阶段按契合度。点名字打开档案里的「关系契合度」。</p>
    </div>
  );
}
