"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ListOrdered, BookMarked } from "lucide-react";

const TABS = [
  { href: "/reading", label: "当前关注", icon: ListOrdered, exact: true },
  { href: "/reading/notes", label: "笔记 Inbox", icon: BookMarked, exact: false },
] as const;

export function ReadingSubNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-2 mb-5">
      {TABS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors",
              active
                ? "bg-zinc-900 text-white border-zinc-900"
                : "bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
