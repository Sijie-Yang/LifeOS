export const RECORD_DOMAINS = ["reading", "research", "body", "social"] as const;
export type RecordDomain = (typeof RECORD_DOMAINS)[number];

export const RECORD_DOMAIN_META: Record<
  RecordDomain,
  {
    label: string;
    hint: string;
    color: string;
    placeholders: { title: string; content: string; metaHint: string };
  }
> = {
  reading: {
    label: "阅读",
    hint: "书第几章 / 哪篇论文",
    color: "bg-amber-100 text-amber-900 border-amber-200",
    placeholders: {
      title: "例：Models · Ch.7",
      content: "读完后关书重建：问题、结论、接口…",
      metaHint: "书名 / 章节 或 论文标题",
    },
  },
  research: {
    label: "研究",
    hint: "今日研究推进了什么",
    color: "bg-indigo-100 text-indigo-900 border-indigo-200",
    placeholders: {
      title: "例：实验 B 组跑完，换了对比图",
      content: "做了什么、卡在哪、下一步…",
      metaHint: "项目名 / 里程碑",
    },
  },
  body: {
    label: "身材·健康·气质",
    hint: "拍照打卡比文字更有用",
    color: "bg-rose-100 text-rose-900 border-rose-200",
    placeholders: {
      title: "例：晨练后正面",
      content: "体感、睡眠、训练备注（可选）",
      metaHint: "正面 / 侧面 / 全身",
    },
  },
  social: {
    label: "社交",
    hint: "自拍、合影、场合",
    color: "bg-emerald-100 text-emerald-900 border-emerald-200",
    placeholders: {
      title: "例：实验室 seminar 合影",
      content: "见了谁、谈了什么（可选）",
      metaHint: "人物 / 地点",
    },
  },
};

export function isRecordDomain(v: string): v is RecordDomain {
  return (RECORD_DOMAINS as readonly string[]).includes(v);
}

export function parseRecordMeta(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export type LifeRecordDto = {
  id: string;
  date: string;
  domain: RecordDomain;
  title: string;
  content: string | null;
  photoUrl: string | null;
  photoMime: string | null;
  meta: Record<string, unknown>;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

export function toRecordDto(row: {
  id: string;
  date: string;
  domain: string;
  title: string;
  content: string | null;
  photoPath: string | null;
  photoMime: string | null;
  meta: string;
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}): LifeRecordDto {
  return {
    id: row.id,
    date: row.date,
    domain: (isRecordDomain(row.domain) ? row.domain : "research") as RecordDomain,
    title: row.title,
    content: row.content,
    photoUrl: row.photoPath ? `/api/records/${row.id}/photo` : null,
    photoMime: row.photoMime,
    meta: parseRecordMeta(row.meta),
    pinned: row.pinned,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
