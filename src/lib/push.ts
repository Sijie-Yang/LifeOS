/**
 * 推送到手机 / 手表：通过 ntfy（iPhone 装 ntfy App 订阅同一个频道；Apple Watch 自动同步通知）。
 * 配置在 .env：NTFY_TOPIC（只有你知道的频道名），可选 NTFY_SERVER（默认 https://ntfy.sh）。
 */
export type PushMessage = {
  title: string;
  message: string;
  /** 1 最低 … 3 默认 … 5 最高（会持续响） */
  priority?: 1 | 2 | 3 | 4 | 5;
  /** ntfy 的 emoji 标签，如 "alarm_clock" */
  tags?: string[];
  /** 点通知打开的链接 */
  click?: string;
};

export function pushConfigured(): boolean {
  return Boolean(process.env.NTFY_TOPIC?.trim());
}

export async function sendPush(msg: PushMessage): Promise<{ ok: boolean; error?: string }> {
  const topic = process.env.NTFY_TOPIC?.trim();
  if (!topic) return { ok: false, error: "没有配置 NTFY_TOPIC" };
  const server = (process.env.NTFY_SERVER?.trim() || "https://ntfy.sh").replace(/\/$/, "");
  try {
    // JSON 发布：标题和正文都能用中文
    const res = await fetch(server, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, ...msg }),
    });
    return res.ok ? { ok: true } : { ok: false, error: `ntfy ${res.status}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "发送失败" };
  }
}
