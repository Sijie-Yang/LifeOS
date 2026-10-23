import { promises as fs } from "fs";
import path from "path";
import { parseBotReport, type BotReport } from "@/lib/bot-report";

/** 日报目录：$LIFEOS_BOT_REPORTS_DIR，默认 <项目根>/data/bot-reports */
export function reportsDir(): string {
  return process.env.LIFEOS_BOT_REPORTS_DIR || path.join(process.cwd(), "data", "bot-reports");
}

export async function readReportFiles(date: string): Promise<{ raw: unknown[]; files: string[]; errors: string[] }> {
  const dir = path.join(reportsDir(), date);
  const errors: string[] = [];
  let files: string[] = [];
  try {
    files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json")).sort();
  } catch {
    return { raw: [], files: [], errors: [`没有日报目录：${dir}`] };
  }
  const raw: unknown[] = [];
  const ok: string[] = [];
  for (const f of files) {
    try {
      raw.push(JSON.parse(await fs.readFile(path.join(dir, f), "utf8")));
      ok.push(f);
    } catch (e) {
      errors.push(`${f} 读不出 JSON：${e instanceof Error ? e.message : e}`);
    }
  }
  return { raw, files: ok, errors };
}

/** 读 + 解析；日期不对的跳过 */
export async function loadReports(date: string): Promise<{ reports: BotReport[]; files: string[]; errors: string[] }> {
  const { raw, files, errors } = await readReportFiles(date);
  const reports: BotReport[] = [];
  for (const item of raw) {
    const { report, error } = parseBotReport(item, date);
    if (error) errors.push(error);
    else if (report!.date !== date) errors.push(`${report!.bot} 的日报日期 ${report!.date} ≠ ${date}，跳过`);
    else reports.push(report!);
  }
  return { reports, files, errors };
}
