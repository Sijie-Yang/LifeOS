import {
  READING_PROJECT_MATCH,
  type ReadingFocusItem,
  type ReadingFocusKind,
  type ReadingNoteDto,
  type ReadingProjectKey,
} from "@/lib/reading-types";

export type { ReadingProjectKey } from "@/lib/reading-types";
export {
  READING_PROJECT_KEYS,
  READING_PROJECT_MATCH,
  type ReadingFocusItem,
  type ReadingFocusKind,
  type ReadingNoteDto,
  type ReadingPayload,
  type ReadingProjectDto,
} from "@/lib/reading-types";

/** 项目笔记里的 SOP / 模板 / 信息源列表 — 不用 readingTag */
export const READING_STRUCTURAL_TYPES = new Set([
  "sop",
  "template",
  "source",
  "overview",
]);

export type ReadingTagDef = {
  id: string;
  label: string;
  color: string;
  keywords: string[];
};

/** Info Reading：主信息源名 */
export const INFO_READING_TAGS: ReadingTagDef[] = [
  { id: "podcast", label: "播客", color: "bg-violet-100 text-violet-800", keywords: ["播客", "podcast", "Podcast"] },
  { id: "interview", label: "访谈 / 对谈", color: "bg-indigo-100 text-indigo-800", keywords: ["访谈", "对谈", "interview"] },
  { id: "lecture", label: "公开课", color: "bg-emerald-100 text-emerald-800", keywords: ["公开课", "讲座", "lecture"] },
  { id: "philosophy", label: "哲学", color: "bg-fuchsia-100 text-fuchsia-800", keywords: ["哲学", "philosophy"] },
  { id: "strategy", label: "商业 / 战略", color: "bg-red-100 text-red-800", keywords: ["战略", "竞争优势", "商业模式"] },
  { id: "naval", label: "Naval", color: "bg-slate-100 text-slate-700", keywords: ["nav.al", "Naval"] },
  { id: "pg", label: "Paul Graham", color: "bg-slate-100 text-slate-700", keywords: ["paulgraham", "Paul Graham"] },
  { id: "the-batch", label: "The Batch", color: "bg-cyan-100 text-cyan-800", keywords: ["The Batch", "deeplearning.ai/the-batch"] },
  { id: "quanta", label: "Quanta", color: "bg-blue-100 text-blue-800", keywords: ["quantamagazine", "Quanta"] },
  { id: "james-clear", label: "James Clear", color: "bg-green-100 text-green-800", keywords: ["jamesclear", "James Clear"] },
  { id: "aeon", label: "Aeon", color: "bg-stone-100 text-stone-700", keywords: ["aeon.co", "Aeon"] },
  { id: "other", label: "其他", color: "bg-zinc-100 text-zinc-600", keywords: [] },
];

/** Science Info：按主题分（书太多，不按单本书打标签） */
export const SCIENCE_INFO_TAGS: ReadingTagDef[] = [
  {
    id: "quantum-opt",
    label: "量子优化",
    color: "bg-fuchsia-100 text-fuchsia-800",
    keywords: [
      "量子",
      "QUBO",
      "QAOA",
      "Ising",
      "annealing",
      "退火",
      "Combarro",
      "Glover",
      "Farhi",
      "PennyLane",
      "Qiskit",
      "quantum optimization",
      "Quantum Machine Learning",
    ],
  },
  { id: "semiconductor", label: "半导体", color: "bg-violet-100 text-violet-800", keywords: ["半导体", "Chip War", "芯片", "Fab", "Van Zant", "Pierret", "台积电", "ASML"] },
  { id: "industry40", label: "工业 4.0", color: "bg-sky-100 text-sky-800", keywords: ["工业 4.0", "Industry 4.0", "Gilchrist", "RAMI", "数字孪生", "MES", "PLC"] },
  { id: "opto", label: "光电器件", color: "bg-amber-100 text-amber-800", keywords: ["光电子", "optoelectronic", "Bhattacharya", "Photonics", "Saleh", "VCSEL", "LiDAR"] },
  { id: "circuits", label: "电路", color: "bg-orange-100 text-orange-800", keywords: ["电路", "Art of Electronics", "Horowitz", "Johns & Martin", "运放", "PCB"] },
  { id: "robotics", label: "机器人", color: "bg-emerald-100 text-emerald-800", keywords: ["机器人", "Modern Robotics", "Probabilistic Robotics", "SLAM", "机械臂"] },
  { id: "paper", label: "论文 / 预印本", color: "bg-indigo-100 text-indigo-800", keywords: ["arxiv", "doi.org", "doi:", "论文", "preprint", "Abstract"] },
  { id: "research", label: "科研 · 我的课题", color: "bg-cyan-100 text-cyan-800", keywords: ["Physical AI", "世界模型", "World Model"] },
  { id: "other", label: "其他", color: "bg-zinc-100 text-zinc-600", keywords: [] },
];

/** 深读书：一书一笔记，书名写在标题里，不再按书打标签 */
export const DEEP_BOOK_TAGS: ReadingTagDef[] = [];

export function readingTagsForProject(key: ReadingProjectKey): ReadingTagDef[] {
  if (key === "science-info") return SCIENCE_INFO_TAGS;
  if (key === "deep-books") return DEEP_BOOK_TAGS;
  return INFO_READING_TAGS;
}

export function isReadingStructuralType(type: string) {
  return READING_STRUCTURAL_TYPES.has(type);
}

/** 阅读页统一显示「系统」；其他项目笔记仍用原类型名 */
export function readingStructuralLabel(_type: string) {
  return "系统";
}

export function readingStructuralColor(_type: string) {
  return "bg-violet-100 text-violet-700";
}

export function getReadingTagDef(key: ReadingProjectKey, tagId: string | null | undefined) {
  if (!tagId) return null;
  return readingTagsForProject(key).find((t) => t.id === tagId) ?? null;
}

/** 从标题 + 正文推断信息源 / 主题标签 */
export function inferReadingTag(
  projectKey: ReadingProjectKey,
  title: string,
  content: string | null
): string {
  // 深读书：一书一笔记，书名在标题，不推断标签
  if (projectKey === "deep-books") return "";

  const haystack = `${title}\n${content ?? ""}`.toLowerCase();
  const tags = readingTagsForProject(projectKey).filter((t) => t.id !== "other");

  // 正文 ## 信息源 / ## 主题 行
  const sourceLine =
    content?.match(/^##\s*(?:信息源|主题|槽位)\s*\n+(.+)/m)?.[1]?.trim() ?? "";
  if (sourceLine) {
    for (const tag of tags) {
      if (tag.keywords.some((k) => sourceLine.toLowerCase().includes(k.toLowerCase()))) {
        return tag.id;
      }
      if (sourceLine.toLowerCase().includes(tag.label.toLowerCase())) {
        return tag.id;
      }
    }
  }

  for (const tag of tags) {
    if (tag.keywords.some((k) => haystack.includes(k.toLowerCase()))) {
      return tag.id;
    }
  }

  return "other";
}

export const LEARNING_PROJECT_NAME = "Learning";

export function resolveProjectKey(name: string): ReadingProjectKey | null {
  if (name.includes("深读书")) return "deep-books";
  if (name.includes("Info Reading")) return "info-reading";
  if (name.includes("Science Info")) return "science-info";
  return null;
}

const SCIENCE_TAG_IDS = new Set(SCIENCE_INFO_TAGS.map((t) => t.id).filter((id) => id !== "other"));
const INFO_TAG_IDS = new Set(INFO_READING_TAGS.map((t) => t.id).filter((id) => id !== "other"));

/** Reading notes live under one Learning project; infer the old reading lane from note/step text. */
export function resolveReadingLane(input: {
  title?: string | null;
  content?: string | null;
  readingTag?: string | null;
}): ReadingProjectKey | null {
  const title = input.title?.trim() ?? "";
  const content = input.content ?? "";
  const tag = input.readingTag ?? "";
  const hay = `${title}\n${content}`;

  if (SCIENCE_TAG_IDS.has(tag)) return "science-info";
  if (INFO_TAG_IDS.has(tag)) return "info-reading";

  if (
    /书籍计划|一本读透/.test(hay) ||
    /读透[《]/.test(title) ||
    /^\d+\s*·\s*读透/.test(title) ||
    title.includes("Models ·")
  ) {
    return "deep-books";
  }
  if (/^Science\s*·/i.test(title) || title.includes("Science Info")) return "science-info";
  if (/^Info\s*·/i.test(title) || title.includes("Info Reading")) return "info-reading";
  if (/^AI\s*·/.test(title) || title.includes("项目概览 · AI") || title.includes("项目概览 · English")) {
    return null;
  }

  const scienceGuess = inferReadingTag("science-info", title, content);
  if (scienceGuess && scienceGuess !== "other") return "science-info";
  const infoGuess = inferReadingTag("info-reading", title, content);
  if (infoGuess && infoGuess !== "other") return "info-reading";
  return null;
}

export function resolveStepLane(title: string): ReadingProjectKey | null {
  return resolveReadingLane({ title });
}

export const BOOK_CHAPTER_TEMPLATE = `## 文件

Reading Library / \`书名.pdf\`

## 全书一句话

## 逐章精炼

**Ch1 · …**  
…

## 接到我

## 读透验收

- [ ]
`;

export const SCIENCE_CLIP_TEMPLATE = `## 主题

（半导体 / 工业 4.0 / 光电器件 / 电路 / 机器人 / 论文）

## 链接 / DOI

## 论文一句

## 方法 / 数据

## 和我的课题的关系

## 待精读

- [ ] 读 Abstract + Figure
- [ ] 记进笔记
`;

export const INFO_CLIP_TEMPLATE = `## 信息源

（播客 / 访谈 / 公开课 / Newsletter / …）

## 链接

## 摘录 / 要点

## 为什么点开

## 槽位

- [ ] 观点  - [ ] 成长  - [ ] 前沿  - [ ] 慢读

## 下一步

- [ ] 写成分享
- [ ] 转 Science Info
`;

const PROJECT_PRIO_RANK: Record<string, number> = {
  HIGH: 0,
  MEDIUM: 100,
  LOW: 200,
};

export type ReadingFocusStepInput = {
  id: string;
  title: string;
  sortOrder: number;
  done: boolean;
  mappedDate: string | null;
};

export type ReadingFocusProjectInput = {
  key: ReadingProjectKey;
  id: string;
  priority: string;
  steps: ReadingFocusStepInput[];
};

type FocusBucket = {
  key: string;
  kind: ReadingFocusKind;
  projectKey: ReadingProjectKey;
  title: string;
  readingTag: string | null;
  steps: ReadingFocusStepInput[];
  projectPriority: string;
};

/** Parse plan-step titles into book / domain / source focus entities. */
export function parseReadingFocusFromStep(
  projectKey: ReadingProjectKey,
  title: string
): { kind: ReadingFocusKind; title: string; readingTag: string | null; key: string } {
  const raw = title.replace(/^\d+\s*·\s*/, "").trim();

  if (projectKey === "deep-books") {
    const m = raw.match(/《([^》]+)》/) || raw.match(/读透[《]?([^》]+)[》]?/);
    const book = m?.[1]?.trim() || raw.replace(/^读透\s*/, "").trim() || raw;
    return { kind: "book", title: book, readingTag: null, key: `book:${book.toLowerCase()}` };
  }

  if (projectKey === "science-info") {
    const body = raw.replace(/^Science\s*·\s*/i, "").trim();
    // "Chip War — Ch 1–4 · …" / "Glover — Paper · …" → named work
    const bookM = body.match(
      /^(.+?)\s*[—–-]\s*(Ch\.?|Chapter|第|Paper|Tutorial|原文|动手|扫)/i
    );
    if (bookM) {
      const book = bookM[1]!.trim();
      return { kind: "book", title: book, readingTag: inferReadingTag("science-info", body, null) || "other", key: `sci-book:${book.toLowerCase()}` };
    }
    const tag = inferReadingTag("science-info", body, null);
    const def = getReadingTagDef("science-info", tag);
    return {
      kind: "domain",
      title: def?.label ?? body.split(/[·—–-]/)[0]!.trim(),
      readingTag: tag || null,
      key: `domain:${tag || body.slice(0, 24)}`,
    };
  }

  // info-reading
  const body = raw.replace(/^Info\s*·\s*/i, "").trim();
  const name = body.split(/[（(]/)[0]!.trim();
  const tag = inferReadingTag("info-reading", name, null);
  const def = getReadingTagDef("info-reading", tag);
  return {
    kind: "source",
    title: def && tag !== "other" ? def.label : name,
    readingTag: tag || null,
    key: `source:${tag || name.toLowerCase()}`,
  };
}

function findMatchingNote(
  notes: ReadingNoteDto[],
  projectKey: ReadingProjectKey,
  focusTitle: string,
  readingTag: string | null
): ReadingNoteDto | null {
  const pool = notes.filter(
    (n) => n.projectKey === projectKey && !isReadingStructuralType(n.type)
  );
  if (readingTag) {
    const byTag = pool.find(
      (n) =>
        (n.readingTag ?? (n.projectKey === "learning" ? null : inferReadingTag(n.projectKey, n.title, n.content))) === readingTag
    );
    if (byTag) return byTag;
  }
  const lower = focusTitle.toLowerCase();
  return (
    pool.find((n) => n.title.toLowerCase().includes(lower) || lower.includes(n.title.toLowerCase().slice(0, 12))) ??
    null
  );
}

/**
 * Build ranked focus queue from open plan steps + notes.
 * Priority: project.priority → step order; 深读书 first open = isNow (iron law).
 */
export function buildReadingFocus(
  projects: ReadingFocusProjectInput[],
  notes: ReadingNoteDto[]
): ReadingFocusItem[] {
  const buckets = new Map<string, FocusBucket>();

  for (const project of projects) {
    const open = project.steps.filter((s) => !s.done).sort((a, b) => a.sortOrder - b.sortOrder);
    for (const step of open) {
      const parsed = parseReadingFocusFromStep(project.key, step.title);
      const bucketKey = `${project.key}:${parsed.key}`;
      let bucket = buckets.get(bucketKey);
      if (!bucket) {
        bucket = {
          key: bucketKey,
          kind: parsed.kind,
          projectKey: project.key,
          title: parsed.title,
          readingTag: parsed.readingTag,
          steps: [],
          projectPriority: project.priority,
        };
        buckets.set(bucketKey, bucket);
      }
      bucket.steps.push(step);
    }
  }

  const items: ReadingFocusItem[] = [];
  for (const bucket of buckets.values()) {
    bucket.steps.sort((a, b) => a.sortOrder - b.sortOrder);
    const next = bucket.steps[0]!;
    const note = findMatchingNote(notes, bucket.projectKey, bucket.title, bucket.readingTag);
    const base = PROJECT_PRIO_RANK[bucket.projectPriority] ?? 150;
    const rank = base + next.sortOrder;
    items.push({
      id: bucket.key,
      kind: bucket.kind,
      projectKey: bucket.projectKey,
      title: bucket.title,
      subtitle: next.title,
      rank,
      projectPriority: bucket.projectPriority,
      isNow: false,
      stepId: next.id,
      noteId: note?.id ?? null,
      readingTag: bucket.readingTag,
      openSteps: bucket.steps.length,
      mappedDate: next.mappedDate,
    });
  }

  items.sort((a, b) => a.rank - b.rank || a.title.localeCompare(b.title, "zh"));

  // Iron law: first deep-books focus is NOW
  const firstBook = items.find((i) => i.projectKey === "deep-books");
  if (firstBook) firstBook.isNow = true;
  // Also mark first item of each other lane if mapped to today-ish (optional): first overall non-book as secondary now
  const firstOther = items.find((i) => i.projectKey !== "deep-books");
  if (firstOther && !firstOther.isNow) {
    // keep only deep book as isNow for clarity of iron law
  }

  // Cap homepage list
  return items.slice(0, 12);
}

export function readingFocusKindLabel(kind: ReadingFocusKind) {
  if (kind === "book") return "书";
  if (kind === "domain") return "领域";
  return "信息源";
}

export function readingFocusKindClass(kind: ReadingFocusKind) {
  if (kind === "book") return "bg-amber-100 text-amber-900";
  if (kind === "domain") return "bg-sky-100 text-sky-800";
  return "bg-violet-100 text-violet-800";
}
