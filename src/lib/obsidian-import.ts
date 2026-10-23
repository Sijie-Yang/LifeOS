import fs from "fs";
import path from "path";
import { prisma } from "./prisma";
import { getOrCreateProjectCategory } from "./project-categories";
import { applyProjectReorganize } from "./project-reorganize";
import { coerceCityField, coerceInstitutionField } from "./contact-places";
import { brandingProjectFilter } from "./branding";

export const DEFAULT_OBSIDIAN_VAULT =
  process.env.OBSIDIAN_VAULT ||
  path.join(process.cwd(), "data", "obsidian");

export const OBSIDIAN_HABIT_DEFS = [
  { key: "exercise", name: "运动" },
  { key: "reading", name: "阅读" },
  { key: "sleep_early", name: "早睡 (22:30前)" },
  { key: "wash_up", name: "洗漱" },
  { key: "supplements", name: "补剂" },
  { key: "daily_summary", name: "每日总结" },
  { key: "wardrobe_tidy", name: "衣屋整理" },
  { key: "no_cold_water", name: "不喝冷水" },
  { key: "bookkeeping", name: "记账" },
] as const;

const PROJECT_STATUS_MAP: Record<string, string> = {
  "In progress": "ACTIVE",
  Active: "ACTIVE",
  "Long-Term": "ACTIVE",
  Initiating: "PLANNING",
  "Not started": "PLANNING",
  Paused: "PAUSED",
  Archived: "COMPLETED",
  Submitted: "ACTIVE",
  Accepted: "COMPLETED",
  Refreshing: "ACTIVE",
};

const PRIORITY_MAP: Record<string, string> = {
  High: "HIGH",
  Medium: "MEDIUM",
  Low: "LOW",
  URGENT: "URGENT",
};

export function parseFrontmatter(raw: string): { attrs: Record<string, unknown>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { attrs: {}, body: raw };

  const attrs: Record<string, unknown> = {};
  const lines = match[1].split("\n");
  let currentKey: string | null = null;

  for (const line of lines) {
    const listMatch = line.match(/^\s+-\s+(.+)$/);
    if (listMatch && currentKey) {
      const arr = (attrs[currentKey] as string[]) || [];
      arr.push(stripQuotes(listMatch[1].trim()));
      attrs[currentKey] = arr;
      continue;
    }

    const kv = line.match(/^([a-zA-Z0-9_]+):\s*(.*)$/);
    if (!kv) continue;
    currentKey = kv[1];
    const val = kv[2].trim();
    if (!val) {
      attrs[currentKey] = [];
    } else if (val === "true") attrs[currentKey] = true;
    else if (val === "false") attrs[currentKey] = false;
    else if (/^\d+$/.test(val)) attrs[currentKey] = parseInt(val, 10);
    else attrs[currentKey] = stripQuotes(val);
  }

  return { attrs, body: match[2] };
}

function stripQuotes(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function safeDate(val: unknown): Date | null {
  if (val == null || val === "" || (Array.isArray(val) && val.length === 0)) return null;
  const d = new Date(String(val));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function extractWikiPaths(text: string): string[] {
  const paths: string[] = [];
  const re = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) paths.push(m[1]);
  return paths;
}

function readMd(filePath: string): { attrs: Record<string, unknown>; body: string } {
  return parseFrontmatter(fs.readFileSync(filePath, "utf-8"));
}

function relVaultPath(vault: string, filePath: string): string {
  return path.relative(vault, filePath).replace(/\\/g, "/");
}

async function alreadyImported(vaultPath: string): Promise<boolean> {
  const row = await prisma.obsidianImport.findUnique({ where: { path: vaultPath } });
  return !!row;
}

async function markImported(vaultPath: string, entityType: string, entityId: string) {
  await prisma.obsidianImport.upsert({
    where: { path: vaultPath },
    create: { path: vaultPath, entityType, entityId },
    update: { entityType, entityId },
  });
}

async function getOrCreateCategory(name: string, color = "#6366f1") {
  const existing = await prisma.contactCategory.findFirst({ where: { name } });
  if (existing) return existing.id;
  const cat = await prisma.contactCategory.create({ data: { name, color } });
  return cat.id;
}

const pathToContactId = new Map<string, string>();
const pathToProjectId = new Map<string, string>();
const pathToMeetingId = new Map<string, string>();
const habitKeyToId = new Map<string, string>();

export type ImportStats = {
  people: number;
  projects: number;
  meetings: number;
  posts: number;
  dailyLogs: number;
  habits: number;
  checkIns: number;
  reviews: number;
  sops: number;
  tasks: number;
  skipped: number;
};

export async function importObsidianVault(vaultPath: string): Promise<ImportStats> {
  const stats: ImportStats = {
    people: 0,
    projects: 0,
    meetings: 0,
    posts: 0,
    dailyLogs: 0,
    habits: 0,
    checkIns: 0,
    reviews: 0,
    sops: 0,
    tasks: 0,
    skipped: 0,
  };

  if (!fs.existsSync(vaultPath)) {
    throw new Error(`Vault not found: ${vaultPath}`);
  }

  // ── Habits (Obsidian boolean keys) ──
  for (const def of OBSIDIAN_HABIT_DEFS) {
    let habit = await prisma.habit.findFirst({ where: { name: def.name } });
    if (!habit) {
      habit = await prisma.habit.create({
        data: { name: def.name, color: "#10b981", frequency: "DAILY" },
      });
      stats.habits++;
    }
    habitKeyToId.set(def.key, habit.id);
  }

  // ── People ──
  const peopleDir = path.join(vaultPath, "People");
  if (fs.existsSync(peopleDir)) {
    for (const file of fs.readdirSync(peopleDir).filter((f) => f.endsWith(".md"))) {
      const full = path.join(peopleDir, file);
      const rel = relVaultPath(vaultPath, full);
      if (await alreadyImported(rel)) { stats.skipped++; continue; }

      const { attrs, body } = readMd(full);
      const name = String(attrs.name || file.replace(".md", "").replace(/_/g, " "));
      const tags = Array.isArray(attrs.people_category)
        ? attrs.people_category.map(String)
        : attrs.people_category
          ? [String(attrs.people_category)]
          : [];
      const roles = Array.isArray(attrs.role) ? attrs.role.join(", ") : String(attrs.role || "");
      const institution = coerceInstitutionField(
        Array.isArray(attrs.institution) ? attrs.institution.map(String) : String(attrs.institution || "")
      );
      const city = coerceCityField(
        Array.isArray(attrs.city) ? attrs.city.map(String) : String(attrs.city || "")
      );

      let categoryId: string | null = null;
      if (tags[0]) categoryId = await getOrCreateCategory(tags[0]);

      const contact = await prisma.contact.create({
        data: {
          name,
          company: null,
          position: roles || null,
          institution,
          city,
          categoryId,
          lastContactAt: safeDate(attrs.last_contact),
          birthday: safeDate(attrs.birthday),
          responseLevel: typeof attrs.response_level === "number" ? attrs.response_level : null,
          importance: typeof attrs.response_level === "number" ? attrs.response_level : 3,
          tags: JSON.stringify(tags),
          notes: body.trim() || null,
        },
      });

      pathToContactId.set(`People/${file.replace(".md", "")}`, contact.id);
      pathToContactId.set(rel, contact.id);
      await markImported(rel, "contact", contact.id);
      stats.people++;
    }
  }

  // ── Projects ──
  const projectsDir = path.join(vaultPath, "Projects");
  if (fs.existsSync(projectsDir)) {
    for (const file of fs.readdirSync(projectsDir).filter((f) => f.endsWith(".md"))) {
      const full = path.join(projectsDir, file);
      const rel = relVaultPath(vaultPath, full);
      if (await alreadyImported(rel)) { stats.skipped++; continue; }

      const { attrs, body } = readMd(full);
      const baseName = file.replace(".md", "");
      const name = String(attrs.name || baseName);
      const status = PROJECT_STATUS_MAP[String(attrs.status || "")] || "PLANNING";
      const priority = PRIORITY_MAP[String(attrs.priority || "")] || "MEDIUM";

      const categoryName = attrs.category ? String(attrs.category) : null;
      const cat = categoryName ? await getOrCreateProjectCategory(categoryName) : null;

      const project = await prisma.project.create({
        data: {
          name,
          description: body.trim() || null,
          status,
          priority,
          categoryId: cat?.id ?? null,
          ideaDate: safeDate(attrs.idea_date),
          archiveDate: safeDate(attrs.archive_date),
          wishFinishTime: attrs.wish_finish_time ? String(attrs.wish_finish_time) : null,
          tags: JSON.stringify(categoryName ? [categoryName] : []),
        },
      });

      await applyProjectReorganize(project.id, body.trim() || null, {
        categoryName,
        projectName: name,
      });

      pathToProjectId.set(`Projects/${baseName}`, project.id);
      pathToProjectId.set(rel, project.id);
      await markImported(rel, "project", project.id);
      stats.projects++;
    }
  }

  // ── Meetings ──
  const meetingsDir = path.join(vaultPath, "Meetings");
  if (fs.existsSync(meetingsDir)) {
    for (const file of fs.readdirSync(meetingsDir).filter((f) => f.endsWith(".md"))) {
      const full = path.join(meetingsDir, file);
      const rel = relVaultPath(vaultPath, full);
      if (await alreadyImported(rel)) { stats.skipped++; continue; }

      const { attrs, body } = readMd(full);
      const title = String(attrs.name || file.replace(".md", ""));
      const peopleLinks = Array.isArray(attrs.people) ? attrs.people : attrs.people ? [attrs.people] : [];
      const attendeeIds: string[] = [];
      for (const p of peopleLinks) {
        const paths = extractWikiPaths(String(p));
        for (const wp of paths) {
          const cid = pathToContactId.get(wp);
          if (cid) attendeeIds.push(cid);
        }
      }

      let referrerId: string | null = null;
      if (attrs.referrer) {
        for (const wp of extractWikiPaths(String(attrs.referrer))) {
          referrerId = pathToContactId.get(wp) || null;
          if (referrerId) break;
        }
      }

      let projectId: string | null = null;
      if (attrs.project) {
        for (const wp of extractWikiPaths(String(attrs.project))) {
          projectId = pathToProjectId.get(wp) || null;
          if (projectId) break;
        }
      }

      const meeting = await prisma.meeting.create({
        data: {
          title,
          category: String(attrs.category || "Other"),
          status: String(attrs.status || "Scheduled"),
          priority: PRIORITY_MAP[String(attrs.priority || "")] || "MEDIUM",
          meetingDate: String(attrs.meeting_date || title.slice(0, 10)),
          meetingTime: attrs.meeting_time ? String(attrs.meeting_time) : null,
          timezone: String(attrs.timezone || "GMT+8"),
          durationMin: attrs.duration_min ? String(attrs.duration_min) : null,
          meetingFormat: attrs.format ? String(attrs.format) : null,
          location: attrs.location ? String(attrs.location) : null,
          purpose: attrs.purpose ? String(attrs.purpose) : null,
          content: body.trim() || null,
          logDate: attrs.log ? String(attrs.log).match(/\d{4}-\d{2}-\d{2}/)?.[0] || null : null,
          projectId,
          referrerId,
          obsidianPath: rel,
          attendees: attendeeIds.length
            ? { create: attendeeIds.map((contactId) => ({ contactId })) }
            : undefined,
        },
      });

      pathToMeetingId.set(rel, meeting.id);
      await markImported(rel, "meeting", meeting.id);
      stats.meetings++;

      const taskCount = await importTasksFromMarkdown(body, { meetingId: meeting.id, source: rel });
      stats.tasks += taskCount;
    }
  }

  // ── Posts ──
  const postsDir = path.join(vaultPath, "Posts");
  if (fs.existsSync(postsDir)) {
    for (const file of fs.readdirSync(postsDir).filter((f) => f.endsWith(".md"))) {
      const full = path.join(postsDir, file);
      const rel = relVaultPath(vaultPath, full);
      if (await alreadyImported(rel)) { stats.skipped++; continue; }

      const { attrs, body } = readMd(full);
      let projectId: string | null = null;
      if (attrs.project) {
        for (const wp of extractWikiPaths(String(attrs.project))) {
          projectId = pathToProjectId.get(wp) || null;
          if (projectId) break;
        }
      }
      if (!projectId) {
        const branding = await prisma.project.findFirst({
          where: brandingProjectFilter,
          select: { id: true },
        });
        projectId = branding?.id ?? null;
      }

      const note = await prisma.note.create({
        data: {
          title: String(attrs.name || file.replace(".md", "")),
          content: body.trim() || null,
          type: "note",
          projectId,
        },
      });

      await markImported(rel, "note", note.id);
      stats.posts++;
    }
  }

  // ── Daily logs + habit check-ins ──
  const logRoot = path.join(vaultPath, "Log");
  if (fs.existsSync(logRoot)) {
    const dailyFiles: string[] = [];
    function walkLog(dir: string) {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory() && ent.name !== "Templates") walkLog(full);
        else if (ent.isFile() && /^\d{4}-\d{2}-\d{2}\.md$/.test(ent.name)) dailyFiles.push(full);
      }
    }
    walkLog(logRoot);

    for (const full of dailyFiles) {
      const rel = relVaultPath(vaultPath, full);
      if (await alreadyImported(rel)) { stats.skipped++; continue; }

      const { attrs, body } = readMd(full);
      const date = String(attrs.date || path.basename(full, ".md"));

      await prisma.dailyLog.create({
        data: { date, content: body.trim() || null, obsidianPath: rel },
      });

      for (const def of OBSIDIAN_HABIT_DEFS) {
        if (attrs[def.key] === true) {
          const habitId = habitKeyToId.get(def.key)!;
          await prisma.habitCheckIn.upsert({
            where: { habitId_date: { habitId, date } },
            create: { habitId, date, completed: true },
            update: { completed: true },
          });
          stats.checkIns++;
        }
      }

      const taskCount = await importTasksFromMarkdown(body, { source: rel });
      stats.tasks += taskCount;

      await markImported(rel, "dailyLog", date);
      stats.dailyLogs++;
    }

    // Weekly / monthly / quarterly / yearly reviews (non-daily md under Log/)
    const reviewFiles: string[] = [];
    function walkReview(dir: string) {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        if (ent.name === "Templates") continue;
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) walkReview(full);
        else if (ent.isFile() && ent.name.endsWith(".md") && !/^\d{4}-\d{2}-\d{2}\.md$/.test(ent.name)) {
          reviewFiles.push(full);
        }
      }
    }
    walkReview(logRoot);

    for (const full of reviewFiles) {
      const rel = relVaultPath(vaultPath, full);
      if (await alreadyImported(rel)) { stats.skipped++; continue; }

      const { body } = readMd(full);
      const base = path.basename(full, ".md");

      if (base.includes("Week-")) {
        const weekMatch = base.match(/Week-(\d+)/);
        const yearMatch = rel.match(/Log\/(\d{4})\//);
        if (weekMatch && yearMatch) {
          const year = parseInt(yearMatch[1], 10);
          const weekNum = parseInt(weekMatch[1], 10);
          const jan4 = new Date(year, 0, 4);
          const weekStart = new Date(jan4);
          weekStart.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7) + (weekNum - 1) * 7);
          const weekStartStr = weekStart.toISOString().slice(0, 10);
          await prisma.weeklyReview.upsert({
            where: { weekStart: weekStartStr },
            create: { weekStart: weekStartStr, wins: body.trim() },
            update: { wins: body.trim() },
          });
          stats.reviews++;
        }
      } else if (/^\d{4}-Q[1-4]$/.test(base)) {
        await prisma.periodReview.upsert({
          where: { periodType_periodKey: { periodType: "quarter", periodKey: base } },
          create: { periodType: "quarter", periodKey: base, wins: body.trim() },
          update: { wins: body.trim() },
        });
        stats.reviews++;
      } else if (/^\d{4}-\d{2}$/.test(base)) {
        await prisma.periodReview.upsert({
          where: { periodType_periodKey: { periodType: "month", periodKey: base } },
          create: { periodType: "month", periodKey: base, wins: body.trim() },
          update: { wins: body.trim() },
        });
        stats.reviews++;
      } else if (/^\d{4}$/.test(base)) {
        await prisma.periodReview.upsert({
          where: { periodType_periodKey: { periodType: "year", periodKey: base } },
          create: { periodType: "year", periodKey: base, wins: body.trim() },
          update: { wins: body.trim() },
        });
        stats.reviews++;
      }

      await markImported(rel, "review", base);
    }
  }

  // ── SOP ──
  const sopDir = path.join(vaultPath, "SOP");
  if (fs.existsSync(sopDir)) {
    for (const file of fs.readdirSync(sopDir).filter((f) => f.endsWith(".md") && f !== "_Index.md")) {
      const full = path.join(sopDir, file);
      const rel = relVaultPath(vaultPath, full);
      if (await alreadyImported(rel)) { stats.skipped++; continue; }

      const { body } = readMd(full);
      const note = await prisma.note.create({
        data: {
          title: file.replace(".md", "").replace(/_/g, " "),
          content: body.trim() || null,
          type: "sop",
        },
      });
      await markImported(rel, "note", note.id);
      stats.sops++;
    }
  }

  return stats;
}

async function importTasksFromMarkdown(
  markdown: string,
  ctx: { meetingId?: string; source: string }
): Promise<number> {
  let count = 0;
  const lines = markdown.split("\n");
  for (const line of lines) {
    const m = line.match(/^-\s+\[([ xX])\]\s+(.+)$/);
    if (!m) continue;
    const completed = m[1].toLowerCase() === "x";
    let title = m[2]
      .replace(/⏳\s*\d{4}-\d{2}-\d{2}/g, "")
      .replace(/📅\s*\d{4}-\d{2}-\d{2}/g, "")
      .replace(/🔼|🔽|⏬/g, "")
      .replace(/✅\s*\d{4}-\d{2}-\d{2}/g, "")
      .replace(/\[\[[^\]|]+(?:\|[^\]]+)?\]\]/g, "")
      .trim();

    const dueMatch = m[2].match(/📅\s*(\d{4}-\d{2}-\d{2})/);
    const schedMatch = m[2].match(/⏳\s*(\d{4}-\d{2}-\d{2})/);
    const priority = m[2].includes("🔼") ? "HIGH" : m[2].includes("🔽") ? "LOW" : "MEDIUM";

    if (!title) continue;

    await prisma.taskItem.create({
      data: {
        title,
        completed,
        dueDate: dueMatch?.[1] || null,
        scheduledDate: schedMatch?.[1] || null,
        priority,
        meetingId: ctx.meetingId || null,
        source: ctx.source,
        completedAt: completed ? new Date() : null,
      },
    });
    count++;
  }
  return count;
}
