import { PageSkeleton } from "@/components/ui/PageState";

export default function Loading() {
  return <div role="status" aria-label="正在加载页面" className="space-y-6">
    <span className="sr-only">正在加载页面…</span>
    <div className="h-8 w-40 animate-pulse rounded-lg bg-zinc-200" aria-hidden />
    <PageSkeleton />
  </div>;
}
