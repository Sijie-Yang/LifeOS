"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildHeadingTree,
  collectExpandableIds,
  headingAncestorIds,
  type MdHeading,
  type MdHeadingNode,
} from "@/lib/markdown-toc";

type MarkdownTocProps = {
  headings: MdHeading[];
  activeId?: string | null;
  onNavigate: (id: string) => void;
  className?: string;
};

const INDENT_PX = 12;

function TocNode({
  node,
  depth,
  activeId,
  collapsed,
  onToggle,
  onNavigate,
}: {
  node: MdHeadingNode;
  depth: number;
  activeId?: string | null;
  collapsed: Set<string>;
  onToggle: (id: string) => void;
  onNavigate: (id: string) => void;
}) {
  const hasChildren = node.children.length > 0;
  const isCollapsed = hasChildren && collapsed.has(node.id);
  const isActive = activeId === node.id;

  return (
    <li className="relative">
      {depth > 0 && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-0 bottom-0 w-px bg-zinc-200"
          style={{ left: (depth - 1) * INDENT_PX + 10 }}
        />
      )}
      <div
        className="flex items-start gap-0.5"
        style={{ paddingLeft: depth * INDENT_PX }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node.id);
            }}
            className="mt-0.5 shrink-0 rounded p-0.5 text-zinc-400 hover:bg-white hover:text-zinc-700"
            aria-label={isCollapsed ? "展开" : "折叠"}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
        ) : (
          <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center">
            <span className="h-1 w-1 rounded-full bg-zinc-300" />
          </span>
        )}
        <button
          type="button"
          onClick={() => onNavigate(node.id)}
          title={node.text}
          className={cn(
            "min-w-0 flex-1 text-left rounded-md px-1.5 py-1 leading-snug transition-colors",
            "hover:bg-white hover:text-zinc-900",
            isActive
              ? "bg-white text-indigo-700 font-medium shadow-sm ring-1 ring-indigo-100"
              : "text-zinc-500",
            node.level === 1 && !isActive && "font-medium text-zinc-700",
            node.level <= 2 ? "text-[11px]" : "text-[10px]",
            node.level >= 4 && !isActive && "text-zinc-400"
          )}
        >
          <span className="line-clamp-2">{node.text}</span>
        </button>
      </div>
      {hasChildren && !isCollapsed && (
        <ul className="mt-0.5 space-y-0.5">
          {node.children.map((child) => (
            <TocNode
              key={child.id}
              node={child}
              depth={depth + 1}
              activeId={activeId}
              collapsed={collapsed}
              onToggle={onToggle}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function MarkdownToc({ headings, activeId, onNavigate, className }: MarkdownTocProps) {
  const tree = useMemo(() => buildHeadingTree(headings), [headings]);
  const expandableIds = useMemo(() => collectExpandableIds(tree), [tree]);
  const headingKey = useMemo(() => headings.map((h) => h.id).join("|"), [headings]);

  /** Collapsed set — empty = all expanded */
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  // New note / heading set: expand all by default
  useEffect(() => {
    setCollapsed(new Set());
  }, [headingKey]);

  // Keep the path to the active heading open
  useEffect(() => {
    if (!activeId) return;
    const ancestors = headingAncestorIds(tree, activeId);
    if (ancestors.length === 0) return;
    setCollapsed((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of ancestors) {
        if (next.delete(id)) changed = true;
      }
      return changed ? next : prev;
    });
  }, [activeId, tree]);

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allExpanded = collapsed.size === 0;
  const allCollapsed =
    expandableIds.length > 0 && expandableIds.every((id) => collapsed.has(id));

  if (headings.length < 2) return null;

  return (
    <nav
      className={cn(
        "flex flex-col min-h-0 border-l border-zinc-100 bg-zinc-50/40",
        className
      )}
      aria-label="文章目录"
    >
      <div className="flex items-center justify-between gap-1 px-2 py-1.5 border-b border-zinc-100 shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
          目录
        </span>
        {expandableIds.length > 0 && (
          <button
            type="button"
            onClick={() =>
              setCollapsed(allExpanded ? new Set(expandableIds) : new Set())
            }
            className="text-[10px] text-zinc-400 hover:text-zinc-700 px-1 py-0.5 rounded hover:bg-white"
            title={allExpanded ? "全部折叠" : "全部展开"}
          >
            {allCollapsed ? "展开" : allExpanded ? "折叠" : "展开"}
          </button>
        )}
      </div>
      <ul className="flex-1 min-h-0 overflow-y-auto py-1.5 px-1 space-y-0.5">
        {tree.map((node) => (
          <TocNode
            key={node.id}
            node={node}
            depth={0}
            activeId={activeId}
            collapsed={collapsed}
            onToggle={toggle}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
    </nav>
  );
}
