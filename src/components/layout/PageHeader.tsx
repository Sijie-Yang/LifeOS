"use client";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 md:mb-8 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-zinc-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}
