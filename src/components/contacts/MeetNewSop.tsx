"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { MEET_NEW_RECORD, MEET_NEW_SOP, type MeetDirection } from "@/lib/contact-sop";
import { cn } from "@/lib/utils";
import { UserPlus } from "lucide-react";

/** 联系人页：认识新人 SOP（向上 / 平级 / 向下 三个标签，各 4 步 + 一条可复制的跟进模板） */
export function MeetNewSop() {
  const [dir, setDir] = useState<MeetDirection>("up");
  const [copied, setCopied] = useState(false);
  const sop = MEET_NEW_SOP.find((s) => s.key === dir)!;

  async function copy() {
    try {
      await navigator.clipboard.writeText(sop.template);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Card className="mb-4 border-emerald-200 bg-emerald-50/40">
      <CardContent className="py-3">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <UserPlus className="h-4 w-4 text-emerald-700" />
          <p className="text-sm font-medium text-emerald-950">认识新人</p>
          <div className="flex gap-1">
            {MEET_NEW_SOP.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setDir(s.key)}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs",
                  s.key === dir ? "bg-emerald-600 text-white" : "bg-white text-emerald-800 hover:bg-emerald-100"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <span className="text-xs text-emerald-800/70">
            {sop.who} · 每 {sop.frequencyDays} 天续温
          </span>
        </div>
        <ol className="space-y-0.5 text-sm text-emerald-950">
          {sop.steps.map((step, i) => (
            <li key={step.when} className="flex gap-2">
              <span className="w-[4.5rem] shrink-0 text-xs leading-5 text-emerald-700">
                {i + 1}. {step.when}
              </span>
              <span>{step.what}</span>
            </li>
          ))}
          <li className="flex gap-2">
            <span className="w-[4.5rem] shrink-0 text-xs leading-5 text-emerald-700">5. 当天</span>
            <span>{MEET_NEW_RECORD}</span>
          </li>
        </ol>
        <div className="mt-2 flex items-start gap-2 rounded-md bg-white/70 px-2 py-1.5 text-xs text-zinc-600">
          <span className="flex-1">{sop.template}</span>
          <button type="button" onClick={copy} className="shrink-0 text-emerald-700 hover:underline">
            {copied ? "已复制" : "复制模板"}
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
