"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { PageLoading } from "@/components/ui/PageState";
import { ContactThreadPanel } from "@/components/contacts/ContactThreadPanel";
import { cn } from "@/lib/utils";
import { ExternalLink, UserRound } from "lucide-react";

type ContactQuickViewCtx = {
  openContact: (id: string) => void;
  closeContact: () => void;
};

const Ctx = createContext<ContactQuickViewCtx | null>(null);

export function useContactQuickView() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    return {
      openContact: (id: string) => {
        window.location.href = `/contacts?id=${id}`;
      },
      closeContact: () => {},
    };
  }
  return ctx;
}

export function ContactQuickViewProvider({ children }: { children: ReactNode }) {
  const [contactId, setContactId] = useState<string | null>(null);

  const openContact = useCallback((id: string) => setContactId(id), []);
  const closeContact = useCallback(() => setContactId(null), []);

  const value = useMemo(
    () => ({ openContact, closeContact }),
    [openContact, closeContact]
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <ContactQuickViewModal contactId={contactId} onClose={closeContact} />
    </Ctx.Provider>
  );
}

/** Clickable contact name — opens global quick view */
export function ContactName({
  id,
  name,
  className,
  role,
}: {
  id: string;
  name: string;
  className?: string;
  role?: string | null;
}) {
  const { openContact } = useContactQuickView();
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openContact(id);
      }}
      className={cn(
        "inline-flex items-center gap-0.5 max-w-full rounded-md px-1 -mx-1 text-left",
        "text-indigo-700 hover:text-indigo-900 hover:bg-indigo-50 underline-offset-2 hover:underline",
        "transition-colors",
        className
      )}
      title={`查看与 ${name} 的往来`}
    >
      <UserRound className="h-3 w-3 shrink-0 opacity-60" />
      <span className="truncate">
        {name}
        {role ? ` · ${role}` : ""}
      </span>
    </button>
  );
}

export function ContactNameList({
  people,
  className,
  empty = "—",
}: {
  people: Array<{ id: string; name: string; role?: string | null }>;
  className?: string;
  empty?: string;
}) {
  if (people.length === 0) {
    return <span className={cn("text-zinc-400", className)}>{empty}</span>;
  }
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-1 gap-y-0.5", className)}>
      {people.map((p, i) => (
        <span key={p.id} className="inline-flex items-center">
          <ContactName id={p.id} name={p.name} role={p.role} />
          {i < people.length - 1 && <span className="text-zinc-300 mx-0.5">、</span>}
        </span>
      ))}
    </span>
  );
}

function ContactQuickViewModal({
  contactId,
  onClose,
}: {
  contactId: string | null;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("联系人");

  useEffect(() => {
    if (!contactId) {
      setTitle("联系人");
      return;
    }
    let cancelled = false;
    void fetch(`/api/contacts/${contactId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { name?: string } | null) => {
        if (!cancelled && json?.name) setTitle(json.name);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  return (
    <Modal open={!!contactId} onClose={onClose} title={title} wide>
      {!contactId ? (
        <PageLoading label="加载往来…" />
      ) : (
        <ContactThreadPanel
          contactId={contactId}
          showNotesSummary
          onNavigate={onClose}
          headerActions={
            <Link href={`/contacts?id=${contactId}`} onClick={onClose}>
              <Button size="sm" variant="secondary">
                完整档案
                <ExternalLink className="h-3.5 w-3.5 ml-1" />
              </Button>
            </Link>
          }
        />
      )}
    </Modal>
  );
}
