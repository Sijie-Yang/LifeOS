import type { LucideIcon } from "lucide-react";
import {
  Activity,
  BookMarked,
  Camera,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChefHat,
  ClipboardList,
  Coffee,
  Crosshair,
  FolderKanban,
  Globe2,
  Library,
  ListChecks,
  Plane,
  RefreshCw,
  Repeat,
  Route,
  StickyNote,
  Sun,
  Target,
  TrendingUp,
  Users,
  Wallet,
  Waves,
  Zap,
} from "lucide-react";

export type NavItemDef = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

export type NavSectionKey = "now" | "stream" | "advance" | "people" | "review";

export type NavSectionDef = {
  key: NavSectionKey;
  label: string;
  hint: string;
  href: string;
  icon: LucideIcon;
  items: NavItemDef[];
};

/** Five primary surfaces; everything else lives in the library drawer. */
export const NAV_SECTIONS: NavSectionDef[] = [
  {
    key: "now",
    label: "现在",
    hint: "此刻该做什么",
    href: "/timeline?scale=day",
    icon: Sun,
    items: [
      { href: "/timeline?scale=day", label: "今日", icon: CalendarDays },
      { href: "/habits", label: "习惯", icon: Repeat },
    ],
  },
  {
    key: "stream",
    label: "事件流",
    hint: "事件 · 时间 · 人物 · SOP",
    href: "/stream",
    icon: Activity,
    items: [],
  },
  {
    key: "advance",
    label: "推进",
    hint: "理性推进人生自由",
    href: "/projects",
    icon: FolderKanban,
    items: [
      { href: "/projects", label: "项目", icon: FolderKanban },
      { href: "/loop", label: "项目闭环", icon: RefreshCw },
      { href: "/tasks", label: "任务", icon: CheckCircle2 },
      { href: "/goals", label: "人生目标", icon: Target },
      { href: "/timeline", label: "长期排期", icon: CalendarRange },
    ],
  },
  {
    key: "people",
    label: "关系",
    hint: "只留有情感和价值的链接",
    href: "/contacts",
    icon: Users,
    items: [
      { href: "/contacts", label: "联系人", icon: Users },
      { href: "/meetings", label: "会议", icon: Users },
      { href: "/opportunities", label: "机会", icon: Crosshair },
      { href: "/social", label: "业余 Networking", icon: Coffee },
    ],
  },
  {
    key: "review",
    label: "复盘",
    hint: "定方向，再看数字",
    href: "/review",
    icon: ClipboardList,
    items: [
      { href: "/review", label: "周复盘", icon: ClipboardList, exact: true },
      { href: "/review/month", label: "月复盘", icon: ClipboardList },
      { href: "/review/quarter", label: "季复盘", icon: ClipboardList },
      { href: "/review/year", label: "年复盘", icon: ClipboardList },
      { href: "/review/trends", label: "数据趋势", icon: TrendingUp },
      { href: "/strategy", label: "人生策略", icon: Route },
      { href: "/power", label: "权力地图", icon: Zap },
      { href: "/foresight", label: "三十年前瞻", icon: Globe2 },
      { href: "/briefing", label: "每日简报", icon: Sun },
    ],
  },
];

/** Reachable on demand; folded by default so they do not compete for attention. */
export const NAV_LIBRARY: NavItemDef[] = [
  { href: "/records", label: "记录中心", icon: Camera },
  { href: "/urges", label: "冲动管理", icon: Waves },
  { href: "/checklists", label: "SOP", icon: ListChecks },
  { href: "/cooking", label: "厨艺菜单", icon: ChefHat },
  { href: "/travel", label: "旅行", icon: Plane },
  { href: "/notes", label: "笔记", icon: StickyNote },
  { href: "/reading", label: "信息阅读", icon: BookMarked },
  { href: "/library", label: "文献库", icon: Library },
  { href: "/finance", label: "理财记账", icon: Wallet },
];

export function navItemActive(
  href: string,
  pathname: string,
  scale: string | null,
  exact?: boolean
): boolean {
  if (href.startsWith("/timeline")) {
    if (pathname !== "/timeline") return false;
    const want = new URL(href, "https://lifeos.local").searchParams.get("scale");
    // 旧的 scale=week 链接现在落到今日
    const current = scale === "week" ? "day" : scale;
    if (want === "day") return current === "day" || current === "powers";
    return current !== "day" && current !== "powers";
  }
  if (href === "/") return pathname === "/";
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function sectionOwns(section: NavSectionDef, pathname: string, scale: string | null) {
  if (navItemActive(section.href, pathname, scale)) return true;
  return section.items.some((item) => navItemActive(item.href, pathname, scale));
}

/** Which primary section the current route belongs to; null means the library. */
export function activeSectionKey(pathname: string, scale: string | null): NavSectionKey | null {
  if (pathname === "/" || pathname === "/daily" || pathname.startsWith("/schedule")) return "now";
  if (pathname.startsWith("/plan") || pathname.startsWith("/calendar")) return "now";
  for (const section of NAV_SECTIONS) {
    if (sectionOwns(section, pathname, scale)) return section.key;
  }
  return null;
}

export function libraryItemActive(pathname: string): boolean {
  return NAV_LIBRARY.some((item) => navItemActive(item.href, pathname, null));
}

export function primaryNavHrefs(): string[] {
  return NAV_SECTIONS.map((section) => section.href);
}
