"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { GripVertical } from "lucide-react";

const HANDLE_WIDTH = 10;
const ROW_MIN_WIDTH = 720;

type ResizableSplitPaneProps = {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultLeftWidth?: number;
  minLeft?: number;
  minRight?: number;
  storageKey?: string;
  className?: string;
};

function clampLeft(width: number, containerWidth: number, minLeft: number, minRight: number) {
  const maxLeft = containerWidth - minRight - HANDLE_WIDTH;
  return Math.max(minLeft, Math.min(width, maxLeft));
}

export function ResizableSplitPane({
  left,
  right,
  defaultLeftWidth = 667,
  minLeft = 360,
  minRight = 480,
  storageKey,
  className,
}: ResizableSplitPaneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const leftWidthRef = useRef(defaultLeftWidth);
  const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
  const [dragging, setDragging] = useState(false);
  const [rowLayout, setRowLayout] = useState(false);

  leftWidthRef.current = leftWidth;

  const applyWidth = useCallback(
    (width: number) => {
      const container = containerRef.current;
      if (!container) {
        setLeftWidth(width);
        return;
      }
      const next = clampLeft(width, container.getBoundingClientRect().width, minLeft, minRight);
      setLeftWidth(next);
    },
    [minLeft, minRight]
  );

  useEffect(() => {
    if (!storageKey) return;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const n = Number(saved);
      if (!Number.isNaN(n) && n > 0) applyWidth(n);
    }
  }, [storageKey, applyWidth]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.getBoundingClientRect().width;
      setRowLayout(w >= ROW_MIN_WIDTH);
      applyWidth(leftWidthRef.current);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [applyWidth]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      applyWidth(e.clientX - rect.left);
    };

    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setDragging(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      if (storageKey) {
        localStorage.setItem(storageKey, String(leftWidthRef.current));
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [applyWidth, storageKey]);

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    setDragging(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex min-h-0 h-full overflow-hidden",
        rowLayout ? "flex-row" : "flex-col",
        className
      )}
    >
      <div
        className={cn(
          "min-w-0 min-h-0 overflow-y-auto overscroll-contain",
          rowLayout ? "max-h-full self-stretch flex-shrink-0" : "max-h-[min(46vh,440px)] flex-shrink-0"
        )}
        style={rowLayout ? { width: leftWidth } : undefined}
      >
        {left}
      </div>

      {rowLayout && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="拖拽调整左右宽度"
          onMouseDown={startDrag}
          className={cn(
            "flex-shrink-0 relative flex items-center justify-center w-2.5 cursor-col-resize touch-none select-none group self-stretch",
            dragging && "bg-indigo-50/80"
          )}
        >
          <div className="absolute inset-y-0 -left-2 -right-2" />
          <div
            className={cn(
              "flex h-10 w-4 items-center justify-center rounded-md border border-zinc-200 bg-white shadow-sm transition-colors",
              "group-hover:border-indigo-300 group-hover:bg-indigo-50",
              dragging && "border-indigo-400 bg-indigo-100"
            )}
          >
            <GripVertical className="h-3.5 w-3.5 text-zinc-400 group-hover:text-indigo-500" />
          </div>
        </div>
      )}

      <div
        className={cn(
          "min-w-0 flex-1 flex flex-col min-h-0 overflow-hidden border-zinc-100",
          rowLayout ? "border-t-0" : "border-t"
        )}
      >
        {right}
      </div>
    </div>
  );
}
