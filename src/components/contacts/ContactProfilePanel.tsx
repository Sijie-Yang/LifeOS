"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { MarkdownEditor } from "@/components/ui/MarkdownEditor";
import { ContactThreadPanel } from "@/components/contacts/ContactThreadPanel";
import { CONTACT_NOTES_TRIGGER_TEMPLATE } from "@/lib/contact-sop";
import { cn, formatDate } from "@/lib/utils";
import { parseTags } from "@/lib/tags";
import { parseCities, parseInstitutions } from "@/lib/contact-places";
import { CrushAnalysisPanel } from "@/components/contacts/CrushAnalysisPanel";
import { CRUSH_TAG, hasCrushTag } from "@/lib/contact-crush";
import { PartnerScorePanel } from "@/components/contacts/PartnerScorePanel";
import { PARTNER_CATEGORY } from "@/lib/partner-score";
import { Heart, Pencil, MessageSquare, X } from "lucide-react";

export type ContactProfileTab = "notes" | "thread" | "crush" | "partner";

export type ContactProfileSummary = {
  id: string;
  name: string;
  institution: string | null;
  company: string | null;
  city: string | null;
  institutions?: string[];
  cities?: string[];
  position: string | null;
  notes: string | null;
  tags: string;
  category: { name: string; color: string } | null;
  lastContactAt: string | null;
  responseLevel?: number | null;
};

type Props = {
  contact: ContactProfileSummary;
  tab: ContactProfileTab;
  onTabChange: (tab: ContactProfileTab) => void;
  onClose: () => void;
  onContactUpdate: (id: string, patch: { notes?: string | null; tags?: string }) => void;
  onEdit: () => void;
  /** Page-level log modal (optional shortcut from header) */
  onLog?: () => void;
  onLogSaved?: () => void;
};

export function ContactProfilePanel({
  contact,
  tab,
  onTabChange,
  onClose,
  onContactUpdate,
  onEdit,
  onLog,
  onLogSaved,
}: Props) {
  const [notes, setNotes] = useState(contact.notes || "");
  const latestNotes = useRef(contact.notes || "");
  const currentContact = useRef(contact.id);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const baseline = useRef(contact.notes || "");

  useEffect(() => {
    const value = contact.notes || "";
    // A previous autosave response must not replace text typed while it was in flight.
    if (currentContact.current === contact.id && latestNotes.current !== baseline.current) return;
    currentContact.current = contact.id;
    latestNotes.current = value;
    setNotes(value);
    baseline.current = value;
    setSaved(false);
  }, [contact.id, contact.notes]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const persist = useCallback(
    async (contactId: string, value: string) => {
      setSaving(true);
      setSaveError(null);
      try {
        const res = await fetch(`/api/contacts/${contactId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: value.trim() || null }),
        });
        if (!res.ok) throw new Error("保存失败");
        baseline.current = value;
        onContactUpdate(contactId, { notes: value.trim() || null });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "保存失败，请重试");
      } finally {
        setSaving(false);
      }
    },
    [onContactUpdate]
  );

  useEffect(() => {
    if (notes === baseline.current) return;
    const timer = setTimeout(() => {
      void persist(contact.id, notes);
    }, 800);
    return () => clearTimeout(timer);
  }, [notes, contact.id, persist]);

  const updateNotes = (value: string) => {
    latestNotes.current = value;
    setNotes(value);
  };

  const insertTriggerTemplate = () => {
    if (notes.includes("待联系触发：")) return;
    updateNotes(
      notes.trim()
        ? `${notes.trim()}\n\n${CONTACT_NOTES_TRIGGER_TEMPLATE}`
        : CONTACT_NOTES_TRIGGER_TEMPLATE
    );
  };

  const tags = parseTags(contact.tags);
  const crush = hasCrushTag(tags);
  /** 「约会对象」圈子里的人才有关系契合度评估 */
  const partner = contact.category?.name === PARTNER_CATEGORY;
  const orgs = contact.institutions ?? parseInstitutions(contact.institution);
  const cities = contact.cities ?? parseCities(contact.city);

  const toggleCrush = async () => {
    const res = await fetch(`/api/contacts/${contact.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ crush: !crush }),
    });
    if (!res.ok) return;
    const next = (await res.json()) as { tags?: string };
    if (next.tags) onContactUpdate(contact.id, { tags: next.tags });
    if (!crush) onTabChange("crush");
    else if (tab === "crush") onTabChange("notes");
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      <div className="shrink-0 px-4 pt-3 pb-2 border-b border-zinc-100">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-zinc-900 truncate">{contact.name}</h2>
            {contact.position && (
              <p className="text-xs text-zinc-500 mt-0.5 truncate">{contact.position}</p>
            )}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {contact.category && (
                <Badge color={contact.category.color}>{contact.category.name}</Badge>
              )}
              {contact.responseLevel != null && contact.responseLevel >= 5 && (
                <Badge className="bg-amber-100 text-amber-900">对方主动</Badge>
              )}
              {orgs.map((t) => (
                <Badge key={`org-${t}`} className="bg-zinc-100 text-zinc-700">
                  {t}
                </Badge>
              ))}
              {cities.map((t) => (
                <Badge key={`city-${t}`} className="bg-sky-50 text-sky-800">
                  {t}
                </Badge>
              ))}
              {tags
                .filter((t) => t !== CRUSH_TAG)
                .map((t) => (
                <Badge key={t} className="bg-zinc-100 text-zinc-600">
                  {t}
                </Badge>
              ))}
              {contact.lastContactAt && (
                <span className="text-[11px] text-zinc-400 self-center">
                  上次联系 {formatDate(contact.lastContactAt)}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void toggleCrush()}
              title={crush ? "取消心动标记" : "标记心动并看往来分析"}
            >
              <Heart
                className={cn("h-3.5 w-3.5", crush ? "fill-rose-500 text-rose-500" : "text-zinc-400")}
              />
            </Button>
            {onLog && (
              <Button size="sm" variant="ghost" onClick={onLog} title="记录联系">
                <MessageSquare className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onEdit} title="编辑资料">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose} title="关闭档案 (Esc)">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex gap-1 mt-3">
          {(
            [
              { key: "notes" as ContactProfileTab, label: "档案备注" },
              { key: "thread" as ContactProfileTab, label: "往来" },
              ...(crush ? [{ key: "crush" as ContactProfileTab, label: "心动分析" }] : []),
              ...(partner ? [{ key: "partner" as ContactProfileTab, label: "关系契合度" }] : []),
            ]
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => onTabChange(t.key)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors",
                tab === t.key
                  ? "bg-indigo-50 text-indigo-800"
                  : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "partner" && partner ? (
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
          <PartnerScorePanel contactId={contact.id} onSaved={onLogSaved} />
        </div>
      ) : tab === "crush" && crush ? (
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
          <CrushAnalysisPanel contactId={contact.id} />
        </div>
      ) : tab === "notes" ? (
        <div className="flex flex-col flex-1 min-h-0 px-4 py-3">
          <div className="flex items-center justify-between gap-2 mb-2 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={insertTriggerTemplate}
            >
              插入待联系触发模板
            </Button>
            <span className="text-[11px] text-zinc-400">
              {saving && "保存中…"}
              {!saving && saved && <span className="text-emerald-600">已保存 ✓</span>}
              {!saving && !saved && notes !== (contact.notes || "") && "未保存的更改…"}
            </span>
          </div>
          {saveError && <div role="alert" className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">
            <span>{saveError}，文字仍保留在编辑器中。</span>
            <Button size="sm" variant="ghost" disabled={saving} onClick={() => void persist(contact.id, notes)}>重试保存</Button>
          </div>}
          <MarkdownEditor
            label="备注"
            value={notes}
            onChange={updateNotes}
            fillHeight
            placeholder={
              "支持 Markdown\n\n## 背景\n\n## 待联系触发\n- 对方优点 / 优势：\n- 我能提供什么："
            }
            className="flex-1 min-h-0"
          />
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
          <ContactThreadPanel
            contactId={contact.id}
            hideHeader
            onLogSaved={onLogSaved}
          />
        </div>
      )}
    </div>
  );
}
