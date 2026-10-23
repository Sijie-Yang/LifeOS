/**
 * 房间平面图：按分区打清洁分（1 乱 · 2 差 · 3 中 · 4 良 · 5 净），按分数生成当天的清洁策略。
 * 这是一份「示例卧室」模板（示意图，不按比例）：北面窗户 + 窗台、窗下的床、西墙书架、
 * 西南角书桌 + 椅子、南墙边洗衣篮、床尾矮柜，东侧一段走廊（两个衣柜）通向房门。
 * 卧室外的公共区域（卫生间、客厅、厨房）画在平面图下方单独一排，打分、策略、打勾和卧室分区一样。
 * 分区 key 会存进 DailyLog.roomZones / roomDone，改布局时保留 key、只改名称和坐标。
 */

export type RoomZoneKey =
  | "bed"
  | "windowsill"
  | "floor"
  | "shelf"
  | "desk"
  | "chairs"
  | "laundry"
  | "dresser"
  | "wardrobe"
  | "wardrobe2"
  | "hall"
  | "bathroom"
  | "living"
  | "kitchen";

export type RoomScore = 1 | 2 | 3 | 4 | 5;

/** 分区打分 {"bed": 1, …}，没打的不出现 */
export type RoomZones = Partial<Record<RoomZoneKey, RoomScore>>;

export type RoomZone = {
  key: RoomZoneKey;
  name: string;
  /** 平面图里的短标签（分区太小放不下全名时用） */
  short?: string;
  /** 合格是什么样（打 4–5 分的标准） */
  standard: string;
  /** 平面图里的矩形，viewBox 0 0 420 380（卧室 y 20–300，公共区域一排在 y 334–370） */
  rect: { x: number; y: number; w: number; h: number };
  /** 没达标时要做的事：按分数分档，分钟是动手时间 */
  fix: { low: { text: string; minutes: number }; mid: { text: string; minutes: number } };
};

export const ROOM_ZONES: RoomZone[] = [
  {
    key: "windowsill",
    name: "窗台",
    standard: "窗台基本清空，只留一两件固定摆放的东西",
    rect: { x: 22, y: 24, w: 256, h: 34 },
    fix: { low: { text: "窗台清空，杂物归位，擦一遍", minutes: 5 }, mid: { text: "多出来的东西收走", minutes: 2 } },
  },
  {
    key: "bed",
    name: "床",
    standard: "被子铺平，床上没有衣服和杂物",
    rect: { x: 86, y: 62, w: 192, h: 112 },
    fix: {
      low: { text: "床上的衣服分三堆：再穿的挂回衣柜、脏的进洗衣篮、不穿的收纳；然后铺床", minutes: 15 },
      mid: { text: "把床上的东西归位，铺平被子", minutes: 5 },
    },
  },
  {
    key: "floor",
    name: "地面",
    standard: "垃圾桶不满，地上没有散落的鞋、包和杂物",
    rect: { x: 120, y: 178, w: 128, h: 24 },
    fix: { low: { text: "倒垃圾、鞋归位、包挂起来，扫一遍地", minutes: 5 }, mid: { text: "地上的东西归位", minutes: 2 } },
  },
  {
    key: "shelf",
    name: "书架",
    standard: "每层一类，不塞杂物",
    rect: { x: 22, y: 176, w: 24, h: 80 },
    fix: { low: { text: "分层整理一次：书、设备、杂物各归一层", minutes: 20 }, mid: { text: "把乱放的东西归回各层", minutes: 5 } },
  },
  {
    key: "chairs",
    name: "椅子",
    standard: "椅背不挂衣服，椅子推回桌下",
    rect: { x: 52, y: 228, w: 90, h: 30 },
    fix: { low: { text: "椅背衣服收走，椅子推回", minutes: 3 }, mid: { text: "椅子推回桌下", minutes: 1 } },
  },
  {
    key: "desk",
    name: "书桌",
    standard: "桌面只留正在用的东西，线缆不缠成一团",
    rect: { x: 22, y: 262, w: 120, h: 36 },
    fix: { low: { text: "杯子餐具拿去厨房，桌面擦一遍，线缆理顺", minutes: 10 }, mid: { text: "收走用完的东西，顺手理一下线", minutes: 5 } },
  },
  {
    key: "laundry",
    name: "洗衣篮",
    standard: "篮子不满、不溢出",
    rect: { x: 210, y: 262, w: 68, h: 36 },
    fix: { low: { text: "今天洗一桶，晾好", minutes: 10 }, mid: { text: "把溢出的衣服压回篮子，安排明天洗", minutes: 2 } },
  },
  {
    key: "dresser",
    name: "床边矮柜",
    short: "矮柜",
    standard: "柜面只留每天用的东西，抽屉关上",
    rect: { x: 252, y: 178, w: 26, h: 50 },
    fix: { low: { text: "柜面清空分类，抽屉关上", minutes: 5 }, mid: { text: "柜面多余的收进抽屉", minutes: 2 } },
  },
  {
    key: "wardrobe",
    name: "衣柜 1",
    standard: "柜门关上，柜底不堆衣服",
    rect: { x: 286, y: 202, w: 52, h: 26 },
    fix: { low: { text: "柜底堆的衣服挂起或叠好，关门", minutes: 10 }, mid: { text: "关门，柜底的衣服收一下", minutes: 3 } },
  },
  {
    key: "wardrobe2",
    name: "衣柜 2",
    standard: "柜门关上，柜底不堆衣服",
    rect: { x: 342, y: 202, w: 54, h: 26 },
    fix: { low: { text: "柜底堆的衣服挂起或叠好，关门", minutes: 10 }, mid: { text: "关门，柜底的衣服收一下", minutes: 3 } },
  },
  {
    key: "hall",
    name: "走廊 · 房门",
    standard: "地面通畅，门后不堆东西",
    rect: { x: 286, y: 232, w: 110, h: 62 },
    fix: { low: { text: "走廊地面清空，门后的东西归位", minutes: 5 }, mid: { text: "地上的东西归位", minutes: 2 } },
  },
  // 公共区域：不在卧室里，平面图下方单独一排
  {
    key: "bathroom",
    name: "卫生间",
    standard: "台面干、马桶干净、垃圾不满、毛巾挂好",
    rect: { x: 20, y: 334, w: 120, h: 36 },
    fix: { low: { text: "刷马桶、擦台面、倒垃圾", minutes: 10 }, mid: { text: "擦台面，毛巾挂好", minutes: 3 } },
  },
  {
    key: "living",
    name: "客厅",
    standard: "沙发和茶几上没有散放的私人物品",
    rect: { x: 150, y: 334, w: 120, h: 36 },
    fix: { low: { text: "私人物品拿回房间，擦桌", minutes: 5 }, mid: { text: "把自己的东西拿回房间", minutes: 2 } },
  },
  {
    key: "kitchen",
    name: "厨房",
    standard: "水槽没有积着的脏碗，台面干净",
    rect: { x: 280, y: 334, w: 120, h: 36 },
    fix: { low: { text: "洗掉积着的碗、杯、锅，擦台面", minutes: 10 }, mid: { text: "洗掉用过的杯子餐具", minutes: 3 } },
  },
];

export const ROOM_SCORE_LABELS: Record<RoomScore, string> = { 1: "乱", 2: "差", 3: "中", 4: "良", 5: "净" };

const ZONE_KEYS = new Set<string>(ROOM_ZONES.map((z) => z.key));

export function isRoomZoneKey(value: unknown): value is RoomZoneKey {
  return typeof value === "string" && ZONE_KEYS.has(value);
}

export function parseRoomScore(value: unknown): RoomScore | null {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > 5) return null;
  return n as RoomScore;
}

export function parseRoomZones(value: unknown): RoomZones {
  let raw = value;
  if (typeof value === "string") {
    try {
      raw = JSON.parse(value);
    } catch {
      return {};
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: RoomZones = {};
  for (const [k, v] of Object.entries(raw)) {
    const score = parseRoomScore(v);
    if (isRoomZoneKey(k) && score) out[k] = score;
  }
  return out;
}

/** 改一个分区的分；score 为 null 清掉 */
export function setRoomZone(zones: RoomZones, key: string, score: unknown): RoomZones {
  if (!isRoomZoneKey(key)) return zones;
  const next = { ...zones };
  const parsed = parseRoomScore(score);
  if (parsed) next[key] = parsed;
  else delete next[key];
  return next;
}

/** 整体清洁度 0–100：已打分分区的平均；没打分返回 null */
export function roomOverall(zones: RoomZones): number | null {
  const scores = ROOM_ZONES.map((z) => zones[z.key]).filter((s): s is RoomScore => Boolean(s));
  if (scores.length === 0) return null;
  return Math.round(((scores.reduce((a, b) => a + b, 0) / scores.length - 1) / 4) * 100);
}

export type RoomTask = {
  key: RoomZoneKey;
  zone: string;
  score: RoomScore;
  /** must = 今天必做（1–2 分）；quick = 顺手做（3 分）；keep = 保持（4–5 分） */
  tier: "must" | "quick" | "keep";
  text: string;
  minutes: number;
};

/**
 * 按分数生成清洁策略：先做最乱的，1–2 分必做，3 分顺手，4–5 分保持。
 * 没打分的分区不出现（先打分再出策略）。
 */
export function roomStrategy(zones: RoomZones): RoomTask[] {
  const tasks: RoomTask[] = [];
  for (const z of ROOM_ZONES) {
    const score = zones[z.key];
    if (!score) continue;
    if (score <= 2) tasks.push({ key: z.key, zone: z.name, score, tier: "must", ...z.fix.low });
    else if (score === 3) tasks.push({ key: z.key, zone: z.name, score, tier: "quick", ...z.fix.mid });
    else tasks.push({ key: z.key, zone: z.name, score, tier: "keep", text: `保持：${z.standard}`, minutes: 0 });
  }
  const order = { must: 0, quick: 1, keep: 2 };
  return tasks.sort((a, b) => order[a.tier] - order[b.tier] || a.score - b.score);
}

/** 当天动手总分钟数（不含机洗等等待时间） */
export function roomMinutes(tasks: RoomTask[]): number {
  return tasks.reduce((sum, t) => sum + t.minutes, 0);
}

/** 今天打勾的分区（清洁策略里的任务做完了） */
export function parseRoomDone(value: unknown): RoomZoneKey[] {
  let raw = value;
  if (typeof value === "string") {
    try {
      raw = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter(isRoomZoneKey))];
}

export function toggleRoomDone(done: RoomZoneKey[], key: string, on: boolean): RoomZoneKey[] {
  if (!isRoomZoneKey(key)) return done;
  return on ? [...new Set([...done, key])] : done.filter((k) => k !== key);
}

/** 打勾后这个分区按「良」算（原来已经 ≥4 的不变） */
export function markZoneCleaned(zones: RoomZones, key: RoomZoneKey): RoomZones {
  const cur = zones[key];
  return cur && cur >= 4 ? zones : { ...zones, [key]: 4 };
}

/** 每个分区最近一次打勾的日期（logs 需按日期升序） */
export function roomLastDone(logs: Array<{ date: string; roomDone: string }>): Partial<Record<RoomZoneKey, string>> {
  const out: Partial<Record<RoomZoneKey, string>> = {};
  for (const l of logs) for (const k of parseRoomDone(l.roomDone)) out[k] = l.date;
  return out;
}

/** 全屋整理的方法，缩成一行 */
export const ROOM_METHOD = "整理 = 让东西离开：垃圾 → 送回原位 → 不用的进捐赠箱 → 两问（会先去哪找？记得自己有吗？）→ 让容器装得下；垃圾袋和捐赠箱当天出门。";
