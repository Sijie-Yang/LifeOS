import type { AgentRun } from "./agent-activity";
import { parseTags, stringifyTags } from "./tags";

export type AgentProject = { id: string; name: string; status: string; tags: string };
export type ProjectMatch = {
  projectId: string | null;
  projectName: string | null;
  method: "manual" | "name" | "variant" | "ambiguous" | "unmatched";
  candidates: { id: string; name: string }[];
};
export type LinkedAgentRun = AgentRun & { match: ProjectMatch };
export type AgentPayload = {
  date: string; now: string; agents: LinkedAgentRun[]; counts: Record<string, number>;
  projects: { id: string; name: string; status: string }[];
};

export const WORKSPACE_TAG_PREFIX = "workspace:";
export function normalizeWorkspace(name: string): string {
  return name.normalize("NFKC").toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]/gu, "");
}

export function workspaceAliases(tags: string): string[] {
  return parseTags(tags).filter((tag) => tag.startsWith(WORKSPACE_TAG_PREFIX))
    .map((tag) => tag.slice(WORKSPACE_TAG_PREFIX.length)).filter(Boolean);
}

/** Preserve normal project tags while moving this workspace's explicit binding. */
export function updateWorkspaceTags(tags: string, workspace: string, attach: boolean): string {
  const key = normalizeWorkspace(workspace);
  const next = parseTags(tags).filter((tag) => !tag.startsWith(WORKSPACE_TAG_PREFIX) || normalizeWorkspace(tag.slice(WORKSPACE_TAG_PREFIX.length)) !== key);
  if (attach) next.push(`${WORKSPACE_TAG_PREFIX}${workspace.trim()}`);
  return stringifyTags(next);
}

function projectKey(name: string) {
  return normalizeWorkspace(name.replace(/^\s*(?:19|20)\d{2}[\s_.-]+/, ""));
}

export function matchAgentProject(workspace: string, projects: AgentProject[]): ProjectMatch {
  const key = normalizeWorkspace(workspace);
  const empty: ProjectMatch = { projectId: null, projectName: null, method: "unmatched", candidates: [] };
  if (!key) return empty;
  const manual = projects.filter((p) => workspaceAliases(p.tags).some((alias) => normalizeWorkspace(alias) === key));
  if (!manual.length && ["codex", "cursor", "claude"].includes(key)) return empty;
  const exact = projects.filter((p) => projectKey(p.name) === key);
  const trimmed = normalizeWorkspace(workspace.replace(/(?:[-_\s]+(?:platform|frontend|backend|web|app|repo|workspace))+$/i, ""));
  const variant = trimmed.length >= 5 && trimmed !== key ? projects.filter((p) => projectKey(p.name) === trimmed) : [];
  const matches = manual.length ? manual : exact.length ? exact : variant;
  if (matches.length === 1) {
    return { projectId: matches[0].id, projectName: matches[0].name, method: manual.length ? "manual" : exact.length ? "name" : "variant", candidates: [] };
  }
  if (matches.length > 1) return { ...empty, method: "ambiguous", candidates: matches.map(({ id, name }) => ({ id, name })) };
  // Partial names are suggestions only; short project codes must never match arbitrary words.
  const candidates = projects.filter((p) => {
    const other = projectKey(p.name);
    return Math.min(other.length, key.length) >= 5 && (key.includes(other) || other.includes(key));
  }).map(({ id, name }) => ({ id, name }));
  return { ...empty, candidates };
}

export function linkAgentProjects(agents: AgentRun[], projects: AgentProject[]): LinkedAgentRun[] {
  const matches = new Map<string, ProjectMatch>();
  return agents.map((agent) => {
    if (!matches.has(agent.project)) matches.set(agent.project, matchAgentProject(agent.project, projects));
    return { ...agent, match: matches.get(agent.project)! };
  });
}

export function workspaceNameFromPath(cwd: string): string {
  return cwd.replace(/[\\/]+$/, "").split(/[\\/]/).at(-1) || "Codex";
}

/** Claude Code 的会话记录每条都带 cwd，取第一条有 cwd 的；没有就按项目目录名（-Users-x-Documents-foo → foo） */
export function claudeWorkspaceFromHead(head: string, folder: string): string {
  // 桌面版技能的临时工作区（…/Claude/scratch-workspaces/…）不是项目，统一算 Claude
  if (/scratch-workspaces/.test(folder)) return "Claude";
  const match = head.match(/"cwd":"((?:[^"\\]|\\.)*)"/);
  if (match) {
    try {
      return workspaceNameFromPath(JSON.parse(`"${match[1]}"`));
    } catch {
      /* fall through to the folder name */
    }
  }
  const stripped = folder.replace(/^-?Users-[^-]+-/, "").replace(/^Documents-/, "");
  return stripped || "Claude";
}

export function codexWorkspaceFromHead(head: string): string {
  for (const line of head.split("\n")) {
    try {
      const entry = JSON.parse(line);
      if (entry.type === "session_meta" && typeof entry.payload?.cwd === "string") return workspaceNameFromPath(entry.payload.cwd);
    } catch { /* partial or malformed JSONL */ }
  }
  return "Codex";
}
