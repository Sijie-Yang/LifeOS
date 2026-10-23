"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";
import { parseInstitutions, parseCities } from "@/lib/contact-places";
import { Search, X } from "lucide-react";

export type ContactOption = {
  id: string;
  name: string;
  company?: string | null;
  institution?: string | null;
  city?: string | null;
  institutions?: string[];
  cities?: string[];
  email?: string | null;
};

type ContactSearchPickerProps = {
  contacts: ContactOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
};

type DropdownPos = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

function contactOrgs(c: ContactOption) {
  return c.institutions ?? parseInstitutions(c.institution ?? c.company);
}

function contactCities(c: ContactOption) {
  return c.cities ?? parseCities(c.city);
}

function contactSubtitle(c: ContactOption) {
  const places = [...contactOrgs(c), ...contactCities(c)];
  return [...places, c.email].filter(Boolean).join(" · ");
}

function matchesContact(c: ContactOption, q: string) {
  const haystack = [c.name, ...contactOrgs(c), ...contactCities(c), c.email]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function ContactSearchPicker({
  contacts,
  value,
  onChange,
  placeholder = "搜索姓名、单位、地点、邮箱…",
  className,
}: ContactSearchPickerProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<DropdownPos | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selected = contacts.find((c) => c.id === value);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!value) setQuery("");
    else if (selected) setQuery(selected.name);
  }, [value, selected]);

  const updateDropdownPos = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 4;
    const preferredHeight = 224;
    const spaceBelow = window.innerHeight - rect.bottom - gap - 8;
    const spaceAbove = rect.top - gap - 8;
    const openUp = spaceBelow < 120 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(96, Math.min(preferredHeight, openUp ? spaceAbove : spaceBelow));

    setDropdownPos({
      top: openUp ? rect.top - gap - maxHeight : rect.bottom + gap,
      left: rect.left,
      width: rect.width,
      maxHeight,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updateDropdownPos();
    const onLayoutChange = () => updateDropdownPos();
    window.addEventListener("scroll", onLayoutChange, true);
    window.addEventListener("resize", onLayoutChange);
    return () => {
      window.removeEventListener("scroll", onLayoutChange, true);
      window.removeEventListener("resize", onLayoutChange);
    };
  }, [open, updateDropdownPos, query]);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? contacts.filter((c) => matchesContact(c, q)) : contacts;
    return list.slice(0, 24);
  }, [contacts, query]);

  const pick = (id: string) => {
    const c = contacts.find((x) => x.id === id);
    onChange(id);
    setQuery(c?.name ?? "");
    setOpen(false);
  };

  const clear = () => {
    onChange("");
    setQuery("");
    setOpen(false);
  };

  const dropdown =
    mounted && open && contacts.length > 0 && dropdownPos
      ? createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: "fixed",
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
              maxHeight: dropdownPos.maxHeight,
            }}
            className="z-[100] overflow-y-auto rounded-xl border border-zinc-200 bg-white shadow-lg"
          >
            {filtered.length === 0 ? (
              <p className="px-3 py-2.5 text-sm text-zinc-500">没有匹配的联系人</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pick(c.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 hover:bg-indigo-50 transition-colors border-b border-zinc-50 last:border-0",
                    value === c.id && "bg-indigo-50"
                  )}
                >
                  <p className="text-sm font-medium text-zinc-900">{c.name}</p>
                  {contactSubtitle(c) && (
                    <p className="text-xs text-zinc-500 truncate mt-0.5">{contactSubtitle(c)}</p>
                  )}
                </button>
              ))
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className={cn("relative flex-1 min-w-[180px]", className)}>
      <div ref={anchorRef} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (value && e.target.value !== selected?.name) onChange("");
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="pl-9 pr-8"
        />
        {(query || value) && (
          <button
            type="button"
            onClick={clear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 rounded"
            aria-label="清除"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {dropdown}
    </div>
  );
}
