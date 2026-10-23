"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchJson, invalidateFetchCache } from "@/components/ui/PageState";
import { cn } from "@/lib/utils";
import {
  PARTNER_CRITERIA,
  PARTNER_STAGES,
  parsePartnerProfile,
  partnerMust,
  partnerTotal,
  type PartnerProfile,
  type PartnerStage,
} from "@/lib/partner-score";

type ContactDetail = { id: string; partnerProfile: string | null; contactFrequencyDays: number };

/** 联系人档案里的「关系契合度」：阶段、渠道、逐项打分（底线 + 参考项）、总分与走势 */
export function PartnerScorePanel({ contactId, onSaved }: { contactId: string; onSaved?: () => void }) {
  const [profile, setProfile] = useState<PartnerProfile | null>(null);
  const [frequency, setFrequency] = useState<number | null>(null);
  const [source, setSource] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchJson<ContactDetail>(`/api/contacts/${contactId}`, { force: true }).then((c) => {
      if (cancelled) return;
      const p = parsePartnerProfile(c.partnerProfile) ?? { stage: "met", scores: {}, source: null, updatedAt: null, history: [] };
      setProfile(p);
      setSource(p.source ?? "");
      setFrequency(c.contactFrequencyDays);
    });
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  const save = useCallback(
    async (patch: Partial<PartnerProfile>, extra: Record<string, unknown> = {}) => {
      setSaving(true);
      try {
        const res = await fetch(`/api/contacts/${contactId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ partnerProfile: patch, ...extra }),
        });
        if (!res.ok) return;
        const c = (await res.json()) as ContactDetail;
        setProfile(parsePartnerProfile(c.partnerProfile));
        if (c.contactFrequencyDays) setFrequency(c.contactFrequencyDays);
        invalidateFetchCache("/api/contacts");
        onSaved?.();
      } finally {
        setSaving(false);
      }
    },
    [contactId, onSaved]
  );

  if (!profile) return <p className="py-6 text-sm text-zinc-400">加载评分…</p>;

  const total = partnerTotal(profile.scores);
  const must = partnerMust(profile.scores);
  const mustCount = PARTNER_CRITERIA.filter((c) => c.must).length;

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-100 bg-zinc-50/60 p-3">
        <div>
          <p className="text-[11px] text-zinc-500">总分</p>
          <p className="text-2xl font-semibold tabular-nums text-zinc-900">{total ?? "—"}</p>
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-xs font-medium",
              must.state === "pass" ? "text-emerald-700" : must.state === "fail" ? "text-rose-600" : "text-amber-700"
            )}
          >
            {must.state === "pass" ? `✓ ${mustCount} 项底线全部达标` : must.state === "fail" ? `✗ 不达标：${must.failed.join("、")}` : `底线还有 ${must.missing.length} 项没打分`}
          </p>
          {profile.history.length > 1 && (
            <p className="mt-0.5 text-[11px] text-zinc-500">
              走势：{profile.history.slice(-6).map((h) => `${h.date.slice(5).replace("-", "/")} ${h.total}`).join(" → ")}
            </p>
          )}
        </div>
        {saving && <span className="text-[11px] text-zinc-400">保存中…</span>}
      </div>

      <section>
        <p className="mb-1 text-xs font-semibold text-zinc-800">阶段</p>
        <div className="flex flex-wrap gap-1">
          {PARTNER_STAGES.map((s) => (
            <button
              key={s.key}
              type="button"
              title={s.hint}
              onClick={() => void save({ stage: s.key as PartnerStage })}
              className={cn(
                "rounded-md px-2 py-1 text-[11px]",
                profile.stage === s.key ? "bg-rose-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-zinc-500">{PARTNER_STAGES.find((s) => s.key === profile.stage)?.hint}</p>
      </section>

      <section className="grid gap-2 sm:grid-cols-2">
        <label className="text-[11px] text-zinc-500">
          怎么认识的
          <input
            value={source}
            onChange={(e) => setSource(e.target.value)}
            onBlur={() => source.trim() !== (profile.source ?? "") && void save({ source: source.trim() || null })}
            placeholder="朋友介绍 / 活动 / 交友应用…"
            className="mt-0.5 w-full rounded-md border border-zinc-200 px-2 py-1 text-sm text-zinc-900"
          />
        </label>
        <div className="text-[11px] text-zinc-500">
          线上联系周期
          <div className="mt-0.5 flex gap-1">
            {[2, 3, 7].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => void save({}, { contactFrequencyDays: d })}
                className={cn("rounded-md px-2 py-1 text-[11px]", frequency === d ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200")}
              >
                {d} 天
              </button>
            ))}
            <span className="self-center text-zinc-400">超过就会提醒联系</span>
          </div>
        </div>
      </section>

      {[true, false].map((isMust) => (
        <section key={String(isMust)}>
          <p className="mb-1.5 text-xs font-semibold text-zinc-800">
            {isMust ? "底线（相处的基本前提）" : "参考项"}
            <span className="ml-1 font-normal text-zinc-400">{isMust ? "· 括号里是最低要求" : "· 不卡底线，只算进总分"}</span>
          </p>
          <ul className="space-y-2">
            {PARTNER_CRITERIA.filter((c) => c.must === isMust).map((c) => {
              const v = profile.scores[c.key] ?? null;
              const below = c.must && v != null && v < c.min;
              return (
                <li key={c.key}>
                  <div className="flex items-center gap-2">
                    <span className={cn("w-32 shrink-0 text-[12px]", below ? "text-rose-600" : "text-zinc-700")}>
                      {c.label}
                      {c.must && <span className="ml-1 text-[10px] text-zinc-400">(≥{c.min})</span>}
                    </span>
                    <div className="flex flex-1 gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          title={`${n} · ${c.scale[n - 1]}`}
                          onClick={() => void save({ scores: { [c.key]: n } })}
                          className={cn(
                            "h-7 flex-1 rounded-md text-xs font-medium",
                            v === n
                              ? below
                                ? "bg-rose-500 text-white"
                                : "bg-indigo-600 text-white"
                              : c.must && n < c.min
                                ? "bg-zinc-50 text-zinc-400 hover:bg-zinc-100"
                                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                          )}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <p className="mt-0.5 pl-[8.5rem] text-[11px] text-zinc-500">
                    {v != null ? `${v} · ${c.scale[v - 1]}` : `还没打分 · ${c.must ? `最低要求 ${c.min}：${c.scale[c.min - 1]}` : "悬停按钮看每个分数的意思"}`}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <p className="text-[11px] leading-relaxed text-zinc-400">
        评分只给自己看，评的是两个人相处得怎么样，不是评判对方。按真实相处打，不按一面之缘猜；看行为，不只看说法。每次见面或深聊之后再更新。
      </p>
    </div>
  );
}
