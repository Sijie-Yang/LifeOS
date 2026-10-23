"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, X, Upload } from "lucide-react";
import { invalidateFetchCache } from "@/lib/fetch-cache";
import { useContactQuickView } from "@/components/contacts/ContactQuickView";

type SearchResult = {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

const TYPE_LABELS: Record<string, string> = {
  contact: "联系人",
  project: "项目",
  note: "笔记",
  planStep: "项目步骤",
  goal: "目标",
  habit: "习惯",
  transaction: "交易",
  meeting: "会议",
  travel: "旅行",
  task: "任务",
  opportunity: "机会",
  library: "文献",
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const { openContact } = useContactQuickView();

  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("lifeos:open-search", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("lifeos:open-search", onOpen);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const t = setTimeout(async () => {
      setResults([]);
      setSearchError(null);
      if (!open || !query.trim()) { setLoading(false); return; }
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        if (!res.ok) throw new Error("搜索暂时不可用，请稍后重试");
        const data = await res.json();
        if (!controller.signal.aborted) setResults(data.results ?? []);
      } catch (error) {
        if (!controller.signal.aborted) setSearchError(error instanceof Error ? error.message : "搜索失败");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => { clearTimeout(t); controller.abort(); };
  }, [query, open]);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 hover:border-zinc-300 transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">搜索...</span>
        <kbd className="hidden sm:inline text-[10px] bg-white border border-zinc-200 rounded px-1.5 py-0.5">⌘K</kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-zinc-200 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3">
          <Search className="h-4 w-4 text-zinc-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索联系人、项目、笔记、任务、目标..."
            className="flex-1 text-sm outline-none bg-transparent"
          />
          <button onClick={() => setOpen(false)} className="p-1 hover:bg-zinc-100 rounded">
            <X className="h-4 w-4 text-zinc-500" />
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto py-2">
          {loading && <p className="text-sm text-zinc-400 px-4 py-3">搜索中...</p>}
          {searchError && <p role="alert" className="text-sm text-red-600 px-4 py-3">{searchError}</p>}
          {!loading && !searchError && query && results.length === 0 && (
            <p className="text-sm text-zinc-400 px-4 py-3">无结果</p>
          )}
          {results.map((r) => (
            <Link
              key={`${r.type}-${r.id}`}
              href={r.href}
              onClick={(e) => {
                if (r.type === "contact") {
                  e.preventDefault();
                  setOpen(false);
                  openContact(r.id);
                  return;
                }
                setOpen(false);
              }}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50 transition-colors"
            >
              <span className="text-[10px] font-medium uppercase tracking-wide text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                {TYPE_LABELS[r.type] || r.type}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-900 truncate">{r.title}</p>
                <p className="text-xs text-zinc-400 truncate">{r.subtitle}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export function BackupButton() {
  return (
    <a
      href="/api/backup"
      download
      className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-xs text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 transition-colors"
    >
      导出数据备份
    </a>
  );
}

export function RestoreButton() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setRestoring(true);
    setMessage(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (data?.format !== "lifeos" || data?.version !== "2.0" || !data.tables || typeof data.tables !== "object") {
        throw new Error("请选择完整的 LifeOS 2.0 备份。旧版备份请先在数据库副本中迁移，不能直接覆盖恢复。");
      }
      const tables = Object.values(data.tables);
      if (!tables.every(Array.isArray)) throw new Error("备份的数据表格式无效");
      const count = tables.reduce<number>((total, rows) => total + (rows as unknown[]).length, 0);
      if (!confirm(`将使用「${file.name}」中的 ${tables.length} 张表、${count} 条记录覆盖当前全部数据。\n建议先导出当前备份。确定恢复？`)) return;
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "恢复失败");
      invalidateFetchCache();
      setMessage("恢复成功，正在刷新...");
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "恢复失败");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={restoring}
        onClick={() => {
          inputRef.current?.click();
        }}
        className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-xs text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 transition-colors disabled:opacity-50"
      >
        <Upload className="h-3.5 w-3.5" />
        {restoring ? "恢复中..." : "从备份恢复"}
      </button>
      {message && <p className="text-[10px] text-zinc-400 px-3 pt-1">{message}</p>}
    </div>
  );
}
