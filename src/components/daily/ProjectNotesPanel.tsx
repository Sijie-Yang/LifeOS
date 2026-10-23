"use client";

import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronDown, ChevronRight, Pin } from "lucide-react";
import { fetchJson } from "@/components/ui/PageState";
import { cn } from "@/lib/utils";

type NoteLite = { id: string; title: string; content: string | null; pinned: boolean; updatedAt: string };

/** 逐项目对齐右边栏：当前项目的全部笔记，点标题展开全文 */
export function ProjectNotesPanel({ projectId, rev }: { projectId: string; rev: number }) {
  const [state, setState] = useState<{ id: string; notes: NoteLite[] | null }>({ id: "", notes: null });
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let cancelled = false;
    fetchJson<{ notes?: NoteLite[] }>(`/api/projects/${projectId}`, { force: true })
      .then((d) => !cancelled && setState({ id: projectId, notes: d.notes ?? [] }))
      .catch(() => !cancelled && setState({ id: projectId, notes: [] }));
    return () => {
      cancelled = true;
    };
  }, [projectId, rev]);

  const notes = state.id === projectId ? state.notes : null;
  if (!notes) return <p className="text-xs text-zinc-400">加载笔记…</p>;
  if (notes.length === 0) return <p className="text-[11px] text-zinc-400">这个项目还没有笔记。</p>;

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <ul className="space-y-1">
      {notes.map((n) => {
        const expanded = open.has(n.id);
        return (
          <li key={n.id} className="rounded-lg border border-zinc-100">
            <button
              type="button"
              onClick={() => toggle(n.id)}
              className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-[12px] hover:bg-zinc-50"
            >
              {expanded ? (
                <ChevronDown className="h-3 w-3 shrink-0 text-zinc-400" />
              ) : (
                <ChevronRight className="h-3 w-3 shrink-0 text-zinc-400" />
              )}
              <span className={cn("min-w-0 flex-1 truncate", expanded && "font-medium text-zinc-900")}>{n.title}</span>
              {n.pinned && <Pin className="h-3 w-3 shrink-0 text-amber-500" />}
              <span className="shrink-0 text-[10px] tabular-nums text-zinc-400">{n.updatedAt.slice(5, 10).replace("-", "/")}</span>
            </button>
            {expanded && (
              <div className="markdown-preview border-t border-zinc-100 px-3 py-2 text-[12px] text-zinc-700 [&_h1]:!text-sm [&_h2]:!text-[13px] [&_h3]:!text-[12px]">
                {n.content?.trim() ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{n.content}</ReactMarkdown>
                ) : (
                  <p className="text-zinc-400">（空）</p>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
