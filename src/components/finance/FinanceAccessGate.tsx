"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

type AccessState = {
  weekCount: number;
  limit: number;
  overLimit: boolean;
  investmentPolicy: string | null;
};

export function FinanceAccessGate({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  const [access, setAccess] = useState<AccessState | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!active) return;
    setDismissed(false);
    void fetch("/api/finance/access", { method: "POST" })
      .then((r) => r.json())
      .then(setAccess)
      .catch(() => null);
  }, [active]);

  if (!active || !access?.overLimit || dismissed) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40">
        <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-zinc-200 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-zinc-900">冷静一下</h3>
          <p className="text-sm text-zinc-600 leading-relaxed">
            你本周已查看投资 <strong>{access.weekCount}</strong> 次（温和上限 {access.limit} 次）。
            你的原则说：
          </p>
          {access.investmentPolicy ? (
            <blockquote className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-900 italic">
              「{access.investmentPolicy}」
            </blockquote>
          ) : (
            <p className="text-sm text-zinc-500">尚未设定投资原则，可在设置中填写。</p>
          )}
          <p className="text-xs text-zinc-400">这不是封锁，只是给冲动一点缓冲时间。</p>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setDismissed(true)}>
              我已冷静，继续查看
            </Button>
          </div>
        </div>
      </div>
      {children}
    </>
  );
}

export function InvestmentPolicyBanner({
  policy,
  weekCount,
  limit,
}: {
  policy: string | null;
  weekCount?: number;
  limit?: number;
}) {
  if (!policy && weekCount == null) return null;
  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
      {policy && (
        <p className="text-sm text-amber-900">
          <span className="font-medium">投资原则：</span>
          {policy}
        </p>
      )}
      {weekCount != null && limit != null && (
        <p className="text-xs text-amber-700 mt-1">本周已查看 {weekCount}/{limit} 次</p>
      )}
    </div>
  );
}
