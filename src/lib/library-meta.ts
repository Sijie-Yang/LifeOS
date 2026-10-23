export const LIBRARY_KINDS = ["paper", "book", "article", "slides", "other"] as const;
export const LIBRARY_STATUSES = ["to_read", "reading", "done"] as const;

export const LIBRARY_KIND_LABEL: Record<string, string> = {
  paper: "论文",
  book: "书",
  article: "文章",
  slides: "幻灯",
  other: "其他",
};

export const LIBRARY_STATUS_LABEL: Record<string, { label: string; color: string }> = {
  to_read: { label: "待读", color: "bg-zinc-100 text-zinc-700" },
  reading: { label: "在读", color: "bg-amber-100 text-amber-800" },
  done: { label: "已读", color: "bg-emerald-100 text-emerald-700" },
};

/** 文献库主类别（写入 tags，列表优先展示） */
export const LIBRARY_CATEGORIES = [
  // 书
  { id: "思想人文", label: "思想人文", kinds: ["book"] as const, color: "bg-amber-100 text-amber-900" },
  { id: "AI技术", label: "AI技术", kinds: ["book"] as const, color: "bg-indigo-100 text-indigo-800" },
  { id: "创业跃迁", label: "创业跃迁", kinds: ["book"] as const, color: "bg-orange-100 text-orange-800" },
  { id: "成长关系", label: "成长关系", kinds: ["book"] as const, color: "bg-rose-100 text-rose-800" },
  // 论文
  { id: "深度学习", label: "深度学习", kinds: ["paper"] as const, color: "bg-violet-100 text-violet-800" },
  { id: "机器人VLA", label: "机器人 / VLA", kinds: ["paper"] as const, color: "bg-emerald-100 text-emerald-800" },
  { id: "GeoAI", label: "GeoAI / 空间数据", kinds: ["paper"] as const, color: "bg-cyan-100 text-cyan-800" },
  { id: "科研其他", label: "科研其他", kinds: ["paper", "article", "slides", "other"] as const, color: "bg-zinc-100 text-zinc-700" },
] as const;

export type LibraryCategoryId = (typeof LIBRARY_CATEGORIES)[number]["id"];

const CATEGORY_IDS = new Set(LIBRARY_CATEGORIES.map((c) => c.id));

export function libraryCategoryDef(id: string | null | undefined) {
  if (!id) return null;
  return LIBRARY_CATEGORIES.find((c) => c.id === id) ?? null;
}

/** 从 tags 取出主类别（第一个命中的类别 id） */
export function extractLibraryCategory(tags: string[]): string | null {
  for (const t of tags) {
    if (CATEGORY_IDS.has(t as LibraryCategoryId)) return t;
  }
  return null;
}

/** 写入/替换主类别，保留其它 tags */
export function withLibraryCategory(tags: string[], category: string | null): string[] {
  const rest = tags.filter((t) => !CATEGORY_IDS.has(t as LibraryCategoryId) && t !== "深读书");
  const next = [...rest];
  if (category) next.unshift(category);
  return next;
}

export function categoriesForKind(kind: string) {
  return LIBRARY_CATEGORIES.filter((c) => (c.kinds as readonly string[]).includes(kind));
}
