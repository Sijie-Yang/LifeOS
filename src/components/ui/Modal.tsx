"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useEffect } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
  wider,
  widest,
  xl,
  xlWide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
  /** 比 wide 再宽一档（左右两栏的弹窗） */
  wider?: boolean;
  /** 再宽一档（带左右边栏的弹窗） */
  widest?: boolean;
  /** 超宽分栏布局（如项目编辑左表单 + 右 Markdown） */
  xl?: boolean;
  /** 在 xl 基础上再加宽（左侧扩展，右侧保持原 2/3 屏宽） */
  xlWide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const isXl = xl || false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-900/30 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          "relative w-full rounded-2xl border border-zinc-200 bg-white shadow-2xl flex flex-col",
          isXl && (xlWide ? "max-w-[103rem] h-[92vh] max-h-[92vh] overflow-hidden" : "max-w-[92rem] h-[92vh] max-h-[92vh] overflow-hidden"),
          !isXl && "max-h-[90vh] overflow-y-auto",
          !isXl && (widest ? "max-w-[96rem]" : wider ? "max-w-5xl" : wide ? "max-w-2xl" : "max-w-lg")
        )}
      >
        <div className="flex-shrink-0 flex items-center justify-between border-b border-zinc-100 bg-white/95 backdrop-blur px-5 py-4">
          <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className={cn(isXl ? "flex flex-col flex-1 min-h-0 overflow-hidden" : "p-5")}>{children}</div>
      </div>
    </div>
  );
}
