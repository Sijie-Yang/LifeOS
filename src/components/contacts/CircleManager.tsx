"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input, Label } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { mutateJson } from "@/components/ui/PageState";

type Category = { id: string; name: string; color: string };
export function CircleManager({ categories, contacts, onClose, onSaved }: {
  categories: Category[];
  contacts: { categoryId: string | null }[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", color: "#6366f1" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reset = () => { setEditing(null); setForm({ name: "", color: "#6366f1" }); };
  async function run(action: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true); setError(null);
    try { await action(); reset(); await onSaved(); }
    catch (e) { setError(e instanceof Error ? e.message : "保存失败"); }
    finally { setBusy(false); }
  }
  return (
    <Modal open onClose={() => { if (!busy) onClose(); }} title="管理圈子">
      <p className="mb-4 text-xs text-zinc-500">按生活、工作或共同经历组织关系；删除圈子后，成员会回到未分圈，联系记录保留。</p>
      <div className="mb-5 max-h-56 space-y-2 overflow-y-auto">
        {categories.length === 0 && <p className="text-sm text-zinc-400">还没有圈子，在下方创建第一个。</p>}
        {categories.map((c) => (
          <div key={c.id} className="flex items-center gap-2 rounded-lg border border-zinc-100 p-2">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
            <span className="min-w-0 flex-1 truncate text-sm">{c.name} <span className="text-xs text-zinc-400">{contacts.filter((p) => p.categoryId === c.id).length} 人</span></span>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setEditing(c.id); setForm({ name: c.name, color: c.color }); setError(null); }}>编辑</Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => {
              if (confirm(`删除「${c.name}」圈子？成员会移到未分圈，联系人和往来记录不会删除。`)) void run(() => mutateJson(`/api/categories/${c.id}`, { method: "DELETE" }));
            }}>删除</Button>
          </div>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); void run(() => mutateJson(editing ? `/api/categories/${editing}` : "/api/categories", { method: editing ? "PATCH" : "POST", body: JSON.stringify(form) })); }}>
        <div className="flex items-end gap-3">
          <Field className="flex-1"><Label>{editing ? "编辑圈子名称" : "新圈子名称"}</Label><Input aria-label="圈子名称" maxLength={60} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field><Label>颜色</Label><Input aria-label="圈子颜色" type="color" className="w-16" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></Field>
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          {editing && <Button type="button" variant="secondary" disabled={busy} onClick={reset}>取消编辑</Button>}
          <Button type="submit" disabled={busy || !form.name.trim()}>{busy ? "保存中…" : editing ? "保存圈子" : "创建圈子"}</Button>
        </div>
      </form>
    </Modal>
  );
}
