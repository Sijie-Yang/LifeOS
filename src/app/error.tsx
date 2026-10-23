"use client";

import Link from "next/link";

export default function PageError({ error, unstable_retry }: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div role="alert" className="mx-auto max-w-lg p-8">
      <h1 className="text-xl font-semibold text-zinc-900">页面暂时无法显示</h1>
      <p className="mt-3 text-sm text-zinc-600">可以重试加载，或返回今日计划。若刚才正在编辑，请先检查保存结果再继续。</p>
      {error.digest && <p className="mt-2 text-xs text-zinc-500">错误编号：{error.digest}</p>}
      <div className="mt-6 flex gap-4 text-sm">
        <button onClick={unstable_retry} className="rounded-lg bg-indigo-600 px-4 py-2 text-white">重新加载</button>
        <Link href="/timeline?scale=day" className="rounded-lg border border-zinc-200 px-4 py-2">返回今日</Link>
      </div>
    </div>
  );
}
