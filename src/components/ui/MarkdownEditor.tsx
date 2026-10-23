"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Code2, Eye } from "lucide-react";
import { Label } from "@/components/ui/Input";
import { MarkdownToc } from "@/components/ui/MarkdownToc";
import { extractMarkdownHeadings } from "@/lib/markdown-toc";
import { cn } from "@/lib/utils";
import type { MarkdownViewMode } from "@/components/ui/MarkdownMdxBody";

const MarkdownMdxBody = dynamic(
  () => import("@/components/ui/MarkdownMdxBody").then((m) => m.MarkdownMdxBody),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center text-sm text-zinc-400 p-6">
        加载编辑器…
      </div>
    ),
  }
);

type MarkdownEditorProps = {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  minHeight?: number;
  /** 填满父容器高度（用于侧栏布局） */
  fillHeight?: boolean;
  /** 旁路标题目录（默认：≥2 个标题时自动显示） */
  showToc?: boolean;
  /** 初始模式，默认预览式编辑 */
  defaultMode?: MarkdownViewMode;
  className?: string;
};

export function MarkdownEditor({
  value,
  onChange,
  label = "内容",
  placeholder = "支持 Markdown：标题、列表、表格、任务 `- [ ]`…",
  minHeight = 280,
  fillHeight = false,
  showToc = true,
  defaultMode = "rich-text",
  className,
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<MarkdownViewMode>(defaultMode);
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const headings = useMemo(() => extractMarkdownHeadings(value), [value]);
  const tocVisible = showToc && headings.length >= 2;

  const scrollToHeading = useCallback(
    (id: string) => {
      const heading = headings.find((h) => h.id === id);
      if (!heading) return;

      const go = () => {
        const root = scrollRootRef.current;
        if (!root) return;
        const nodes = root.querySelectorAll("h1, h2, h3, h4, h5, h6");
        for (const el of nodes) {
          if (el.textContent?.trim() === heading.text) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
            setActiveId(id);
            return;
          }
        }
      };

      if (mode !== "rich-text") {
        setMode("rich-text");
        // wait for rich-text remount
        window.setTimeout(go, 80);
      } else {
        go();
      }
    },
    [headings, mode]
  );

  useEffect(() => {
    if (!tocVisible || mode !== "rich-text") {
      setActiveId(null);
      return;
    }
    const root = scrollRootRef.current;
    if (!root) return;

    const nodes = Array.from(root.querySelectorAll("h1, h2, h3, h4, h5, h6"));
    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const text = visible[0]?.target?.textContent?.trim();
        if (!text) return;
        const hit = headings.find((h) => h.text === text);
        if (hit) setActiveId(hit.id);
      },
      { root, rootMargin: "-8% 0px -70% 0px", threshold: [0, 1] }
    );

    for (const n of nodes) observer.observe(n);
    return () => observer.disconnect();
  }, [tocVisible, headings, mode, value]);

  return (
    <div className={cn("flex flex-col min-h-0", fillHeight && "h-full", className)}>
      {label ? (
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <Label className="mb-0">{label}</Label>
          <ModeToggle mode={mode} onChange={setMode} />
        </div>
      ) : (
        <div className="flex justify-end mb-1.5">
          <ModeToggle mode={mode} onChange={setMode} />
        </div>
      )}

      <div
        className={cn(
          "grid gap-0 rounded-xl border border-zinc-200 overflow-hidden bg-white flex-1 min-h-0",
          tocVisible ? "grid-cols-1 md:grid-cols-[minmax(0,1fr)_11rem]" : "grid-cols-1",
          fillHeight && "h-full"
        )}
        style={fillHeight ? undefined : { minHeight }}
      >
        <div
          ref={scrollRootRef}
          className={cn(
            "flex flex-col min-h-[180px] md:min-h-0 overflow-hidden",
            tocVisible && "md:border-r border-zinc-200"
          )}
        >
          <MarkdownMdxBody
            value={value}
            onChange={onChange}
            mode={mode}
            placeholder={placeholder}
            className={cn(
              "lifeos-mdx flex-1 min-h-0 overflow-y-auto",
              fillHeight && "h-full"
            )}
            contentClassName="markdown-preview lifeos-mdx-content"
          />
        </div>

        {tocVisible && (
          <MarkdownToc
            headings={headings}
            activeId={activeId}
            onNavigate={scrollToHeading}
            className="hidden md:flex max-h-full"
          />
        )}
      </div>
    </div>
  );
}

function ModeToggle({
  mode,
  onChange,
}: {
  mode: MarkdownViewMode;
  onChange: (mode: MarkdownViewMode) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 text-xs">
      <button
        type="button"
        onClick={() => onChange("rich-text")}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors",
          mode === "rich-text"
            ? "bg-white text-zinc-900 shadow-sm font-medium"
            : "text-zinc-500 hover:text-zinc-800"
        )}
        title="预览式编辑（所见即所得）"
      >
        <Eye className="h-3.5 w-3.5" />
        预览
      </button>
      <button
        type="button"
        onClick={() => onChange("source")}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors",
          mode === "source"
            ? "bg-white text-zinc-900 shadow-sm font-medium"
            : "text-zinc-500 hover:text-zinc-800"
        )}
        title="源码编辑（Markdown）"
      >
        <Code2 className="h-3.5 w-3.5" />
        源码
      </button>
    </div>
  );
}
