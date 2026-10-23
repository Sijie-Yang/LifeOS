"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Select, Label, Field, Textarea } from "@/components/ui/Input";
import { parseQuickCapture, resolveProjectId } from "@/lib/quick-capture-parse";
import { toDateString } from "@/lib/utils";

type CaptureType = "note" | "habit" | "contact" | "task" | "smart";

export function QuickCapture() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<CaptureType>("smart");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const parsed = useMemo(
    () => (type === "smart" && title.trim() ? parseQuickCapture(title) : null),
    [type, title]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("lifeos:quick-capture", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("lifeos:quick-capture", onOpen);
    };
  }, []);

  const reset = useCallback(() => {
    setTitle("");
    setContent("");
    setType("smart");
  }, []);

  const saveSmart = async () => {
    if (!title.trim()) return;
    const p = parseQuickCapture(title);
    const projectId = await resolveProjectId(p.projectName);
    const date = p.date || toDateString();

    if (p.type === "meeting") {
      await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: p.title,
          meetingDate: date,
          meetingTime: p.time,
        }),
      });
      router.push("/meetings");
      return;
    }

    if (p.type === "task" || p.date || p.time || p.projectName) {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: p.title,
          dueDate: date,
          scheduledDate: date,
          projectId,
        }),
      });
      router.push("/tasks");
      return;
    }

    await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: p.title, content: content.trim() || null, type: "idea" }),
    });
    router.push("/notes");
  };

  const save = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      if (type === "smart") {
        await saveSmart();
      } else if (type === "note") {
        await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim(), content: content.trim() || null, type: "idea" }),
        });
        router.push("/notes");
      } else if (type === "contact") {
        await fetch("/api/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: title.trim(), notes: content.trim() || null, contactFrequencyDays: 30 }),
        });
        router.push("/contacts");
      } else if (type === "task") {
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title.trim() }),
        });
        router.push("/tasks");
      } else {
        await fetch("/api/habits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: title.trim(), description: content.trim() || null }),
        });
        router.push("/habits");
      }
      setOpen(false);
      reset();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] sm:pt-[20vh] px-4">
      <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-zinc-200 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3">
          <Zap className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium text-zinc-900">快速捕获</span>
          <span className="text-[10px] text-zinc-400 ml-auto">⌘⇧N</span>
          <button onClick={() => setOpen(false)} className="p-1 hover:bg-zinc-100 rounded ml-2">
            <X className="h-4 w-4 text-zinc-500" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <Field>
            <Label>类型</Label>
            <Select value={type} onChange={(e) => setType(e.target.value as CaptureType)}>
              <option value="smart">智能速记（推荐）</option>
              <option value="task">任务</option>
              <option value="note">灵感笔记</option>
              <option value="contact">联系人</option>
              <option value="habit">习惯</option>
            </Select>
          </Field>
          <Field>
            <Label>{type === "contact" ? "姓名" : type === "smart" ? "速记" : "标题"} *</Label>
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                type === "smart"
                  ? "明天 9:00 开会 #项目名"
                  : "一句话记录..."
              }
            />
          </Field>
          {type === "smart" && parsed && title.trim() && (
            <div className="rounded-lg bg-zinc-50 border border-zinc-100 px-3 py-2 text-xs text-zinc-600 space-y-0.5">
              <p>识别为：<span className="font-medium text-zinc-800">{parsed.type === "meeting" ? "会议" : parsed.type === "task" ? "任务" : "笔记"}</span></p>
              {parsed.date && <p>日期：{parsed.date}</p>}
              {parsed.time && <p>时间：{parsed.time}</p>}
              {parsed.projectName && <p>项目：#{parsed.projectName}</p>}
            </div>
          )}
          {(type === "note" || type === "task" || type === "smart") && (
            <Field>
              <Label>备注</Label>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[80px]" />
            </Field>
          )}
          {type !== "smart" && type !== "note" && type !== "task" && (
            <Field>
              <Label>备注</Label>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[80px]" />
            </Field>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>取消</Button>
            <Button onClick={save} disabled={!title.trim() || saving}>{saving ? "保存中..." : "保存"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
