"use client";

import Link, { useLinkStatus } from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  Activity,
  ChevronDown,
  ChevronRight,
  Menu,
  Plus,
  Search,
  Sparkles,
  Archive,
  Waves,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlobalSearch, BackupButton, RestoreButton } from "@/components/layout/GlobalSearch";
import { QuickCapture } from "@/components/layout/QuickCapture";
import { PomodoroProvider } from "@/components/focus/PomodoroContext";
import { PomodoroWidget } from "@/components/focus/PomodoroWidget";
import { PomodoroFullscreen } from "@/components/focus/PomodoroFullscreen";
import { PomodoroRemoteBridge } from "@/components/focus/PomodoroRemoteBridge";
import {
  NAV_LIBRARY,
  NAV_SECTIONS,
  activeSectionKey,
  libraryItemActive,
  navItemActive,
  primaryNavHrefs,
  type NavItemDef,
} from "@/lib/nav-sections";
import { prefetchNavRoute, scheduleIdlePrefetch } from "@/lib/nav-prefetch";

const LIBRARY_OPEN_KEY = "lifeos:nav-library-open";
const LIBRARY_OPEN_EVENT = "lifeos:nav-library-toggle";

function subscribeLibraryPref(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(LIBRARY_OPEN_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(LIBRARY_OPEN_EVENT, onChange);
  };
}

function NavigationPending() {
  const { pending } = useLinkStatus();
  return pending ? <span role="status" aria-label="正在打开页面" className="ml-auto h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-indigo-200 border-t-indigo-600" /> : null;
}

function SubLink({
  item,
  active,
  onNavigate,
}: {
  item: NavItemDef;
  active: boolean;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      prefetch
      onClick={onNavigate}
      onMouseEnter={() => prefetchNavRoute(item.href)}
      onFocus={() => prefetchNavRoute(item.href)}
      onTouchStart={() => prefetchNavRoute(item.href)}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] transition-colors",
        active ? "bg-zinc-100 font-medium text-zinc-900" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{item.label}</span>
      <NavigationPending />
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const scale = useSearchParams().get("scale");
  const current = activeSectionKey(pathname, scale);
  const inLibrary = current === null && libraryItemActive(pathname);
  const libraryPref = useSyncExternalStore(
    subscribeLibraryPref,
    () => window.localStorage.getItem(LIBRARY_OPEN_KEY) === "1",
    () => false
  );
  const libraryOpen = inLibrary || libraryPref;

  useEffect(() => {
    return scheduleIdlePrefetch(primaryNavHrefs());
  }, []);

  const toggleLibrary = () => {
    window.localStorage.setItem(LIBRARY_OPEN_KEY, libraryOpen ? "0" : "1");
    window.dispatchEvent(new Event(LIBRARY_OPEN_EVENT));
  };

  return (
    <>
      <div className="space-y-1">
        {NAV_SECTIONS.map((section) => {
          const Icon = section.icon;
          const active = current === section.key;
          return (
            <div key={section.key}>
              <Link
                href={section.href}
                prefetch
                onClick={onNavigate}
                onMouseEnter={() => prefetchNavRoute(section.href)}
                onFocus={() => prefetchNavRoute(section.href)}
                onTouchStart={() => prefetchNavRoute(section.href)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors",
                  active
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{section.label}</span>
                  {active && (
                    <span className="block truncate text-[11px] font-normal text-indigo-500/80">
                      {section.hint}
                    </span>
                  )}
                </span>
                <NavigationPending />
              </Link>
              {active && section.items.length > 0 && (
                <div className="ml-4 mt-1 mb-2 space-y-0.5 border-l border-zinc-100 pl-2">
                  {section.items.map((item) => (
                    <SubLink
                      key={item.href}
                      item={item}
                      active={navItemActive(item.href, pathname, scale, item.exact)}
                      onNavigate={onNavigate}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        <button
          type="button"
          onClick={toggleLibrary}
          aria-expanded={libraryOpen}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 hover:text-zinc-600"
        >
          <Archive className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">库 · {NAV_LIBRARY.length}</span>
          {libraryOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        {libraryOpen && (
          <div className="mt-1 space-y-0.5">
            {NAV_LIBRARY.map((item) => (
              <SubLink
                key={item.href}
                item={item}
                active={navItemActive(item.href, pathname, null)}
                onNavigate={onNavigate}
              />
            ))}
            <div className="mt-3 space-y-1 border-t border-zinc-100 pt-3">
              <BackupButton />
              <RestoreButton />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <aside className="flex h-full w-64 flex-col border-r border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-zinc-100">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-400">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div>
          <p className="font-semibold text-zinc-900">LifeOS</p>
          <p className="text-[11px] text-zinc-500">专注 · 链接 · 平和</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-4">
        <div className="mb-4 px-1">
          <GlobalSearch />
        </div>
        <Suspense fallback={null}>
          <NavLinks onNavigate={onNavigate} />
        </Suspense>
      </nav>
      <p className="border-t border-zinc-100 px-4 py-3 text-center text-[11px] text-zinc-400">
        ⌘⇧N 快速捕获 · ⌘K 搜索
      </p>
    </aside>
  );
}

const CAPTURE_ACTIONS = [
  { event: "lifeos:quick-capture", label: "快速捕获", hint: "⌘⇧N", icon: Zap, tone: "text-amber-600" },
  { event: "lifeos:urge-capture", label: "冲动来了", hint: "90 秒冲浪", icon: Waves, tone: "text-orange-600" },
  { event: "lifeos:wellness-checkin", label: "今日状态", hint: "精力 · 内耗 · 睡眠", icon: Activity, tone: "text-violet-600" },
] as const;

function CaptureMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
      {open && (
        <div className="w-48 rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-xl">
          {CAPTURE_ACTIONS.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.event}
                type="button"
                onClick={() => {
                  setOpen(false);
                  window.dispatchEvent(new CustomEvent(action.event));
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-zinc-50"
              >
                <Icon className={cn("h-4 w-4 shrink-0", action.tone)} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-zinc-800">{action.label}</span>
                  <span className="block text-[11px] text-zinc-400">{action.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg transition-all",
          open ? "rotate-45 bg-zinc-700 hover:bg-zinc-800" : "bg-indigo-600 hover:bg-indigo-700"
        )}
        aria-label="捕获"
        aria-expanded={open}
        title="快速捕获 · 冲动 · 今日状态"
      >
        <Plus className="h-5 w-5" />
      </button>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f4f6f9]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-indigo-200/40 blur-3xl" />
        <div className="absolute top-1/2 -left-40 h-80 w-80 rounded-full bg-emerald-200/30 blur-3xl" />
      </div>

      <div className="hidden md:block fixed inset-y-0 left-0 z-40">
        <Sidebar />
      </div>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 border-b border-zinc-200 bg-white/95 backdrop-blur px-4 py-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-lg hover:bg-zinc-100"
          aria-label="打开菜单"
        >
          <Menu className="h-5 w-5 text-zinc-700" />
        </button>
        <span className="font-semibold text-zinc-900 flex-1">LifeOS</span>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent("lifeos:open-search"))}
          className="p-2 rounded-lg hover:bg-zinc-100"
          aria-label="搜索"
        >
          <Search className="h-5 w-5 text-zinc-600" />
        </button>
      </header>

      <main className="relative md:ml-64 min-h-screen p-4 md:p-8">{children}</main>
      <QuickCapture />
      <PomodoroProvider>
        <PomodoroWidget />
        <PomodoroFullscreen />
        <PomodoroRemoteBridge />
      </PomodoroProvider>
      <CaptureMenu />
    </div>
  );
}
