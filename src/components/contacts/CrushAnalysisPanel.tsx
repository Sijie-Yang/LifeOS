"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { fetchJson, invalidateFetchCache } from "@/components/ui/PageState";
import type { CrushAnalysis } from "@/lib/crush-analysis";
import { cn } from "@/lib/utils";

type Payload = {
  contactId: string;
  name: string;
  analysis: CrushAnalysis;
};

const KIND_TONE: Record<CrushAnalysis["relationKind"], string> = {
  insufficient: "bg-zinc-100 text-zinc-700",
  one_sided: "bg-rose-50 text-rose-800",
  friend_boundary: "bg-sky-50 text-sky-800",
  cooling: "bg-amber-50 text-amber-800",
  closed: "bg-emerald-50 text-emerald-800",
};

export function CrushAnalysisPanel({ contactId }: { contactId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      invalidateFetchCache(`/api/contacts/${contactId}/crush-analysis`);
      const next = await fetchJson<Payload>(`/api/contacts/${contactId}/crush-analysis`, {
        force: true,
      });
      setData(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "分析失败");
    }
  }, [contactId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return <p className="text-sm text-zinc-500 py-6">{error}</p>;
  }
  if (!data) {
    return <p className="text-sm text-zinc-400 py-6">在看往来和备注…</p>;
  }

  const a = data.analysis;
  return (
    <div className="space-y-4 pb-6">
      <div>
        <Badge className={cn("text-[11px]", KIND_TONE[a.relationKind])}>{a.relationLabel}</Badge>
        <p className="text-[11px] text-zinc-400 mt-1.5">
          证据 {a.evidenceLevel === "enough" ? "够用" : a.evidenceLevel === "moderate" ? "一般" : "薄"}
          {" · "}
          可得性 {a.availability === "closed" ? "你已收口" : a.availability === "low" ? "偏低" : "未知"}
        </p>
      </div>

      <ul className="space-y-3">
        {a.findings.map((f) => (
          <li key={f.title} className="rounded-xl border border-zinc-100 px-3 py-2.5">
            <p className="text-sm font-medium text-zinc-800">{f.title}</p>
            <p className="text-xs text-zinc-600 mt-1 leading-relaxed">{f.detail}</p>
            {f.evidence && (
              <p className="text-[11px] text-zinc-400 mt-1.5">依据：{f.evidence}</p>
            )}
          </li>
        ))}
      </ul>

      <div>
        <p className="text-xs font-medium text-zinc-500 mb-1.5">接下来</p>
        <ol className="list-decimal pl-4 space-y-1">
          {a.nextMoves.map((m) => (
            <li key={m} className="text-xs text-zinc-700 leading-relaxed">
              {m}
            </li>
          ))}
        </ol>
      </div>

      <div className="rounded-xl bg-zinc-50 px-3 py-2.5">
        {a.caveats.map((c) => (
          <p key={c} className="text-[11px] text-zinc-500 leading-relaxed">
            {c}
          </p>
        ))}
      </div>
    </div>
  );
}
