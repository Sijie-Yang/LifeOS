"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Bot, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { invalidateFetchCache, mutateJson } from "@/components/ui/PageState";
import { cn } from "@/lib/utils";
import { useAgentActivity } from "@/lib/use-agent-activity";
import { normalizeWorkspace, type AgentPayload, type LinkedAgentRun } from "@/lib/agent-projects";

const MATCH_LABEL = { manual: "已记住", name: "同名匹配", variant: "名称匹配", ambiguous: "存在重名", unmatched: "未关联" };
function clock(iso: string) { return format(new Date(iso), "HH:mm"); }

export function AgentRunList() {
  const [date, setDate] = useState("");
  const selectedDate = date || format(new Date(), "yyyy-MM-dd");
  const { data, error, loading, refresh } = useAgentActivity(selectedDate);
  const [source, setSource] = useState("all");
  const [project, setProject] = useState("all");
  const [search, setSearch] = useState("");
  const [mapping, setMapping] = useState<LinkedAgentRun | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const agents = data?.agents ?? [];
  const visible = agents.filter((agent) => (source === "all" || agent.source === source) &&
    (project === "all" || (project === "unmatched" ? !agent.match.projectId : agent.match.projectId === project)) &&
    `${agent.title} ${agent.project} ${agent.match.projectName ?? ""}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const summaries = useMemo(() => {
    const byProject = new Map<string, { id: string; name: string; total: number; active: number }>();
    for (const agent of data?.agents ?? []) {
      if (!agent.match.projectId) continue;
      const id = agent.match.projectId;
      const group = byProject.get(id) ?? { id, name: agent.match.projectName!, total: 0, active: 0 };
      group.total++; if (agent.status === "running") group.active++;
      byProject.set(id, group);
    }
    return [...byProject.values()].sort((a, b) => b.active - a.active || b.total - a.total);
  }, [data]);
  const active = agents.filter((a) => a.status === "running").length;
  const unmatched = new Set(agents.filter((a) => !a.match.projectId).map((a) => normalizeWorkspace(a.project))).size;

  return (
    <aside aria-label="Agent 工作台" className="rounded-2xl border border-zinc-200 bg-white p-3 lg:sticky lg:top-4">
      <div className="mb-3 flex items-center gap-2">
        <Bot className="h-4 w-4 text-emerald-700" />
        <h2 className="flex-1 text-sm font-semibold text-zinc-800">Agent 工作台</h2>
        <Button size="sm" variant="ghost" aria-label="刷新 Agent" disabled={refreshing} onClick={async () => { setRefreshing(true); try { await refresh(); } finally { setRefreshing(false); } }}><RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} /></Button>
      </div>
      <div className="mb-3 flex items-center gap-2">
        <Input aria-label="Agent 活动日期" type="date" value={selectedDate} max={format(new Date(), "yyyy-MM-dd")} onChange={(e) => setDate(e.target.value)} />
        {date && <Button size="sm" variant="ghost" onClick={() => setDate("")}>今天</Button>}
      </div>
      <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-zinc-500"><span>{agents.length} 个会话</span><span className="text-emerald-700">{active} 最近活跃</span><span>{summaries.length} 个项目</span><span>{unmatched} 个 workspace 待关联</span></div>
      {error && <div role="alert" className="mb-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">刷新失败{data ? "，保留上次结果" : ""}。{error}<button type="button" className="ml-1 underline" onClick={() => void refresh()}>重试</button></div>}
      {loading && <p role="status" className="mb-3 text-xs text-zinc-500">正在读取本地活动…</p>}
      {summaries.length > 0 && <div className="mb-3 flex flex-wrap gap-1.5">{summaries.map((group) => <button type="button" key={group.id} aria-pressed={project === group.id} onClick={() => setProject(project === group.id ? "all" : group.id)} className={cn("max-w-full truncate rounded-md px-2 py-1 text-[11px]", project === group.id ? "bg-indigo-100 text-indigo-800" : "bg-zinc-100 text-zinc-600")} title={`${group.total} 个会话，${group.active} 个最近活跃`}>{group.name} · {group.total}</button>)}</div>}
      <div className="mb-3 space-y-2">
        <Input aria-label="搜索 Agent" placeholder="搜索会话、workspace 或项目" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="flex gap-2">
          <Select aria-label="Agent 来源" value={source} onChange={(e) => setSource(e.target.value)}><option value="all">全部来源</option><option value="claude">Claude</option><option value="codex">Codex</option><option value="cursor">Cursor</option></Select>
          <Select aria-label="Agent 项目" value={project} onChange={(e) => setProject(e.target.value)}><option value="all">全部项目</option><option value="unmatched">待关联</option>{(data?.projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
        </div>
      </div>
      {!loading && !visible.length && <p className="py-3 text-xs text-zinc-400">{error && !data ? "暂时无法读取活动。" : agents.length ? "没有符合筛选条件的会话。" : "当天还没有活动记录。"}</p>}
      <ul className="max-h-[60vh] space-y-1.5 overflow-y-auto pr-1">
        {visible.map((agent) => <li key={agent.id} className={cn("rounded-xl border px-2.5 py-2", agent.status === "running" ? "border-emerald-200 bg-emerald-50" : "border-zinc-100 bg-zinc-50")}>
          <div className="flex items-baseline gap-2"><span className="shrink-0 text-[10px] uppercase text-zinc-500">{agent.source}</span><span className="min-w-0 flex-1 truncate text-xs text-zinc-800" title={agent.title}>{agent.title}</span></div>
          <p className="mt-1 truncate text-[10px] text-zinc-500" title={agent.project}>{agent.project} · {clock(agent.startedAt)}–{clock(agent.endedAt)}{agent.status === "running" ? " · 最近活跃" : ""}</p>
          <div className="mt-2 flex items-center gap-2">
            {agent.match.projectId ? <Link className="min-w-0 flex-1 truncate text-xs text-indigo-700 hover:underline" href={`/projects?id=${encodeURIComponent(agent.match.projectId)}`}>{agent.match.projectName}</Link> : <span className="flex-1 text-[11px] text-amber-700">{MATCH_LABEL[agent.match.method]}</span>}
            <button type="button" className="shrink-0 text-[11px] text-zinc-500 hover:text-indigo-700" aria-label={`关联 workspace ${agent.project}`} onClick={() => setMapping(agent)}>{agent.match.projectId ? MATCH_LABEL[agent.match.method] + " · 修改" : "关联项目"}</button>
          </div>
        </li>)}
      </ul>
      <p className="mt-3 text-[10px] leading-relaxed text-zinc-400">活跃状态根据本地记录更新时间估算，不代表任务完成。{data && `更新于 ${clock(data.now)}`} · 隐藏页面时暂停刷新</p>
      {mapping && data && <WorkspaceMapping key={mapping.project} agent={mapping} projects={data.projects} onClose={() => setMapping(null)} onSaved={async () => { await refresh(); setMapping(null); }} />}
    </aside>
  );
}

function WorkspaceMapping({ agent, projects, onClose, onSaved }: { agent: LinkedAgentRun; projects: AgentPayload["projects"]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [selected, setSelected] = useState(agent.match.projectId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(projectId: string | null) {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      await mutateJson("/api/agents/workspaces", { method: "PUT", body: JSON.stringify({ workspace: agent.project, projectId }) });
      invalidateFetchCache("/api/projects");
      await onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "保存失败"); }
    finally { setBusy(false); }
  }
  return <Modal open onClose={() => { if (!busy) onClose(); }} title="关联 workspace">
    <p className="mb-1 break-all text-sm font-medium text-zinc-800">{agent.project}</p>
    <p className="mb-4 text-xs leading-relaxed text-zinc-500">选择后记住这个 workspace 名称，应用于 Cursor 和 Codex 的历史与新会话。对应规则保存在项目的 workspace 标签中，随备份保留。</p>
    {agent.match.candidates.length > 0 && <p className="mb-3 text-xs text-amber-700">可能的项目：{agent.match.candidates.map((p) => p.name).join("、")}。请选择正确的一项。</p>}
    <Select aria-label="关联到 LifeOS 项目" value={selected} onChange={(e) => setSelected(e.target.value)}><option value="">请选择项目</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.status === "COMPLETED" ? "（已完成）" : ""}</option>)}</Select>
    {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
    <div className="mt-5 flex flex-wrap justify-end gap-2"><Button variant="ghost" disabled={busy} onClick={() => void save(null)}>恢复自动匹配</Button><Button disabled={busy || !selected} onClick={() => void save(selected)}>{busy ? "保存中…" : "记住关联"}</Button></div>
  </Modal>;
}
