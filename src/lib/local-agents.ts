import { claudeWorkspaceFromHead, codexWorkspaceFromHead } from "./agent-projects";
import { createRequire } from "node:module";
import fs from "fs";
import os from "os";
import path from "path";
import {
  AGENT_RUNNING_MS,
  agentIsRunning,
  agentTitle,
  codexStartedMs,
  codexThreadId,
  codexTitleFromHead,
  cursorProjectName,
  cursorTitleFromHead,
  sortAgents,
  type AgentRun,
} from "./agent-activity";

const require = createRequire(import.meta.url);

type HeaderRow = { composerId: string; lastUpdatedAt: number; name: string | null };
type SqliteDb = {
  prepare(sql: string): { all(): HeaderRow[] };
  close(): void;
};

const HEAD_BYTES = 48 * 1024;
const MAX_AGENTS = 80;

function readHead(file: string): string {
  const stat = fs.statSync(file);
  const sig = `${stat.size}:${stat.mtimeMs}`;
  const cached = headCache.get(file);
  if (cached?.sig === sig) return cached.head;
  const fd = fs.openSync(file, "r");
  try {
    const buf = Buffer.alloc(HEAD_BYTES);
    const n = fs.readSync(fd, buf, 0, HEAD_BYTES, 0);
    const head = buf.subarray(0, n).toString("utf8");
    if (headCache.size >= 512) headCache.delete(headCache.keys().next().value!);
    headCache.set(file, { sig, head });
    return head;
  } finally {
    fs.closeSync(fd);
  }
}

function walkJsonl(dir: string, depth: number, visit: (file: string, stat: fs.Stats) => void) {
  if (depth > 4 || !fs.existsSync(dir)) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJsonl(full, depth + 1, visit);
    else if (entry.isFile() && entry.name.endsWith(".jsonl")) {
      try {
        visit(full, fs.statSync(full));
      } catch {
        /* unreadable transcript */
      }
    }
  }
}

function dayStartMs(day: string): number {
  return new Date(`${day}T00:00:00`).getTime();
}


type CursorHeader = { name: string; updatedAt: number };

const stampCache = new Map<string, { sig: string; size: number; start: number; carry: string; stamps: number[] }>();
const headCache = new Map<string, { sig: string; head: string }>();
const dayCache = new Map<string, { at: number; agents: AgentRun[] }>();

function loadCursorHeaders(): Map<string, CursorHeader> {
  const headers = new Map<string, CursorHeader>();
  const file = process.env.LIFEOS_CURSOR_STATE_DB || path.join(
    os.homedir(),
    "Library/Application Support/Cursor/User/globalStorage/state.vscdb"
  );
  if (!fs.existsSync(file)) return headers;
  let db: SqliteDb | null = null;
  try {
    const { DatabaseSync } = require("node:sqlite") as {
      DatabaseSync: new (filename: string, options?: { readOnly?: boolean }) => SqliteDb;
    };
    db = new DatabaseSync(file, { readOnly: true });
    const rows = db
      .prepare(
        `SELECT composerId, lastUpdatedAt, json_extract(value, '$.name') AS name
         FROM composerHeaders`
      )
      .all();
    for (const row of rows) {
      if (!row.composerId || !row.name) continue;
      headers.set(row.composerId, { name: row.name, updatedAt: Number(row.lastUpdatedAt) || 0 });
    }
  } catch {
    return headers;
  } finally {
    db?.close();
  }
  return headers;
}

function loadCodexNames(): Map<string, string> {
  const names = new Map<string, string>();
  const file = path.join(process.env.LIFEOS_CODEX_HOME || path.join(os.homedir(), ".codex"), "session_index.jsonl");
  let text = "";
  try {
    text = fs.readFileSync(file, "utf8");
  } catch {
    return names;
  }
  for (const line of text.split("\n")) {
    if (!line.includes('"thread_name"')) continue;
    try {
      const row = JSON.parse(line) as { id?: string; thread_name?: string };
      if (row.id && row.thread_name?.trim()) names.set(row.id, row.thread_name.trim());
    } catch {
      /* skip a broken index line */
    }
  }
  return names;
}

export function scanAgentStamps(file: string, pattern: RegExp, start: number, end: number): number[] {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(file);
  } catch {
    return [];
  }
  const sig = `${stat.mtimeMs}:${stat.size}:${start}`;
  const cached = stampCache.get(file);
  if (cached?.sig === sig) return cached.stamps;
  const growing = cached?.start === start && stat.size > cached.size;
  const stamps = new Set<number>(growing ? cached.stamps : []);
  if (stat.size > 80 * 1024 * 1024) return [];
  const fd = fs.openSync(file, "r");
  const buf = Buffer.alloc(256 * 1024);
  let carry = growing ? cached.carry : "";
  let offset = growing ? cached.size : 0;
  try {
    let read = 0;
    while ((read = fs.readSync(fd, buf, 0, buf.length, offset)) > 0) {
      offset += read;
      const text = carry + buf.subarray(0, read).toString("utf8");
      const matcher = new RegExp(pattern.source, "g");
      for (const match of text.matchAll(matcher)) {
        const parsed = Date.parse(match[1] ?? "");
        if (parsed >= start && parsed <= end) stamps.add(parsed);
      }
      carry = text.slice(-160);
    }
  } catch { /* retry unreadable transcripts on the next scan */ }
  finally { fs.closeSync(fd); }
  const result = [...stamps];
  if (stampCache.size >= 512) stampCache.delete(stampCache.keys().next().value!);
  stampCache.set(file, { sig, size: offset, start, carry, stamps: result });
  return result;
}

const CURSOR_STAMP = /<timestamp>([^<]{8,90})<\/timestamp>/;
const CODEX_STAMP = /"timestamp":"([^"]+)"/;

/** Reuse recent scans across widgets; growing transcripts scan only newly appended bytes. */
export function listAgentsForDate(day: string, now = new Date()): AgentRun[] {
  if (process.env.LIFEOS_AGENT_ACTIVITY === "0") return [];
  const cached = dayCache.get(day);
  if (cached && now.getTime() >= cached.at && now.getTime() - cached.at < 5_000) return cached.agents;
  const start = dayStartMs(day);
  const end = new Date(`${day}T23:59:59.999`).getTime();
  const agents: AgentRun[] = [];
  collectCursor(agents, start, end, now);
  collectCodex(agents, start, end, now);
  collectClaude(agents, start, end, now);
  const result = sortAgents(agents).slice(0, MAX_AGENTS);
  if (dayCache.size >= 7) dayCache.delete(dayCache.keys().next().value!);
  dayCache.set(day, { at: now.getTime(), agents: result });
  return result;
}

function collectCursor(agents: AgentRun[], start: number, end: number, now: Date) {
  const headers = loadCursorHeaders();
  const root = path.join(process.env.LIFEOS_CURSOR_HOME || path.join(os.homedir(), ".cursor"), "projects");
  let projects: string[];
  try {
    projects = fs.readdirSync(root);
  } catch {
    return;
  }
  const groups = new Map<string, { project: string; files: string[]; mtimes: number[] }>();
  for (const project of projects) {
    const transcripts = path.join(root, project, "agent-transcripts");
    const projectName = cursorProjectName(project);
    walkJsonl(transcripts, 0, (file, stat) => {
      const parentId = path.relative(transcripts, file).split(path.sep)[0];
      if (!parentId) return;
      const group = groups.get(parentId) ?? { project: projectName, files: [], mtimes: [] };
      group.files.push(file);
      group.mtimes.push(stat.mtimeMs);
      groups.set(parentId, group);
    });
  }
  const nowMs = now.getTime();
  for (const [parentId, group] of groups) {
    const header = headers.get(parentId);
    const newest = Math.max(...group.mtimes);
    const headerAt = header?.updatedAt ?? 0;
    const touchedToday = group.mtimes.some((time) => time >= start && time <= end);
    const fresh = headerAt > 0 && nowMs - headerAt <= AGENT_RUNNING_MS;
    if (newest < start && !(headerAt >= start && headerAt <= end)) continue;
    const marks = new Set<number>();
    for (const file of group.files) {
      const fileMtime = fs.statSync(file).mtimeMs;
      if (fileMtime >= start && fileMtime <= end) marks.add(fileMtime);
      const parentFile = file.endsWith(`${parentId}.jsonl`) && !file.includes(`${path.sep}subagents${path.sep}`);
      if (parentFile || fileMtime >= start) {
        for (const stamp of scanAgentStamps(file, CURSOR_STAMP, start, end)) marks.add(stamp);
      }
    }
    if (headerAt >= start && headerAt <= end && (touchedToday || fresh)) marks.add(headerAt);
    if (marks.size === 0) continue;
    const times = [...marks];
    const parentFile = group.files.find(
      (file) => file.endsWith(`${parentId}.jsonl`) && !file.includes(`${path.sep}subagents${path.sep}`)
    );
    let fallback = group.project;
    if (!header?.name && parentFile) {
      try {
        fallback = cursorTitleFromHead(readHead(parentFile)) || fallback;
      } catch {
        /* keep the project name */
      }
    }
    const startMs = times.reduce((min, value) => Math.min(min, value), Infinity);
    const endMs = times.reduce((max, value) => Math.max(max, value), -Infinity);
    agents.push({
      id: `cursor:${parentId}`,
      source: "cursor",
      title: agentTitle(header?.name, fallback),
      project: group.project,
      startedAt: new Date(startMs).toISOString(),
      endedAt: new Date(endMs).toISOString(),
      status: nowMs <= end && agentIsRunning(newest, headerAt || null, nowMs) ? "running" : "done",
      marks: times.map((time) => new Date(time).toISOString()),
    });
  }
}

function collectCodex(agents: AgentRun[], start: number, end: number, now: Date) {
  const names = loadCodexNames();
  const root = path.join(process.env.LIFEOS_CODEX_HOME || path.join(os.homedir(), ".codex"), "sessions");
  walkJsonl(root, 0, (file, stat) => {
    if (stat.mtimeMs < start) return;
    const threadId = codexThreadId(path.basename(file));
    const custom = threadId ? names.get(threadId) : undefined;
    let head = "";
    try {
      head = readHead(file);
    } catch {
      head = "";
    }
    const project = codexWorkspaceFromHead(head);
    const namedStart = codexStartedMs(path.basename(file));
    const marks = new Set<number>(scanAgentStamps(file, CODEX_STAMP, start, end));
    if (stat.mtimeMs <= end) marks.add(stat.mtimeMs);
    if (namedStart != null && namedStart >= start && namedStart <= end) marks.add(namedStart);
    if (marks.size === 0) return;
    const times = [...marks];
    agents.push({
      id: `codex:${threadId || path.basename(file)}`,
      source: "codex",
      title: agentTitle(custom, codexTitleFromHead(head, project)),
      project,
      startedAt: new Date(times.reduce((min, value) => Math.min(min, value), Infinity)).toISOString(),
      endedAt: new Date(times.reduce((max, value) => Math.max(max, value), -Infinity)).toISOString(),
      status: now.getTime() <= end && agentIsRunning(stat.mtimeMs, null, now.getTime()) ? "running" : "done",
      marks: times.map((time) => new Date(time).toISOString()),
    });
  });
}

/**
 * Claude Code / Claude 桌面版：~/.claude/projects/<项目目录>/<sessionId>.jsonl，每行一个带 timestamp 的事件。
 * 只看项目目录下第一层的会话文件（memory/、tool-results/ 等子目录跳过）。
 */
function collectClaude(agents: AgentRun[], start: number, end: number, now: Date) {
  const root = path.join(process.env.LIFEOS_CLAUDE_HOME || path.join(os.homedir(), ".claude"), "projects");
  let folders: fs.Dirent[];
  try {
    folders = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return;
  }
  const nowMs = now.getTime();
  for (const folder of folders) {
    if (!folder.isDirectory()) continue;
    const dir = path.join(root, folder.name);
    let files: string[];
    try {
      files = fs.readdirSync(dir).filter((name) => name.endsWith(".jsonl"));
    } catch {
      continue;
    }
    for (const name of files) {
      const file = path.join(dir, name);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(file);
      } catch {
        continue;
      }
      if (stat.mtimeMs < start) continue;
      // Claude 每个工具调用都写时间戳，一天几千条；按分钟去重，半小时格子的粒度足够
      const marks = new Set<number>(scanAgentStamps(file, CODEX_STAMP, start, end).map((t) => t - (t % 60_000)));
      if (stat.mtimeMs <= end) marks.add(stat.mtimeMs - (stat.mtimeMs % 60_000));
      if (marks.size === 0) continue;
      let head = "";
      try {
        head = readHead(file);
      } catch {
        head = "";
      }
      const project = claudeWorkspaceFromHead(head, folder.name);
      const times = [...marks];
      agents.push({
        id: `claude:${name.replace(/\.jsonl$/, "")}`,
        source: "claude",
        title: agentTitle(null, codexTitleFromHead(head, project)),
        project,
        startedAt: new Date(times.reduce((min, value) => Math.min(min, value), Infinity)).toISOString(),
        endedAt: new Date(times.reduce((max, value) => Math.max(max, value), -Infinity)).toISOString(),
        status: nowMs <= end && agentIsRunning(stat.mtimeMs, null, nowMs) ? "running" : "done",
        marks: times.map((time) => new Date(time).toISOString()),
      });
    }
  }
}
