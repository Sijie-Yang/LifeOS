import { cn } from "@/lib/utils";

export function Badge({
  children,
  className,
  color,
}: {
  children: React.ReactNode;
  className?: string;
  color?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        className
      )}
      style={color ? { backgroundColor: `${color}18`, color } : undefined}
    >
      {children}
    </span>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-2 w-full rounded-full bg-zinc-100 overflow-hidden", className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-3 text-4xl opacity-40">📭</div>
      <p className="text-zinc-700 font-medium">{title}</p>
      {description && <p className="text-sm text-zinc-500 mt-1">{description}</p>}
    </div>
  );
}
