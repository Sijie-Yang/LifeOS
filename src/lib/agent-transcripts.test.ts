import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, writeFileSync, appendFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { listAgentsForDate, scanAgentStamps } from "./local-agents";
import { claudeWorkspaceFromHead } from "./agent-projects";

test("transcript scans append incrementally without duplicating the carried timestamp", () => {
  const dir = mkdtempSync(join(tmpdir(), "lifeos-agent-test-"));
  const file = join(dir, "session.jsonl");
  const pattern = /"timestamp":"([^"]+)"/;
  const start = Date.parse("2026-10-08T00:00:00Z");
  const end = Date.parse("2026-10-08T23:59:59Z");
  const line = (stamp: string) => JSON.stringify({timestamp:stamp})+'\n';
  try {
    writeFileSync(file,line('2026-10-08T01:00:00Z'));
    assert.deepEqual(scanAgentStamps(file,pattern,start,end),[start+3600000]);
    appendFileSync(file,line('2026-10-08T02:00:00Z'));
    assert.deepEqual(scanAgentStamps(file,pattern,start,end),[start+3600000,start+7200000]);
    assert.deepEqual(scanAgentStamps(file,pattern,start,end),[start+3600000,start+7200000]);
    writeFileSync(file,line('2026-10-08T03:00:00Z'));
    assert.deepEqual(scanAgentStamps(file,pattern,start,end),[start+10800000]);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});

test("transcript scans retain yesterday even when a session gets new activity today", () => {
  const dir = mkdtempSync(join(tmpdir(), "lifeos-agent-test-"));
  const file = join(dir, "session.jsonl");
  try {
    writeFileSync(file,'{"timestamp":"2026-10-07T22:00:00Z"}\n{"timestamp":"2026-10-08T03:00:00Z"}');
    assert.deepEqual(scanAgentStamps(file,/"timestamp":"([^"]+)"/,Date.parse('2026-10-07T00:00:00Z'),Date.parse('2026-10-07T23:59:59Z')),[Date.parse('2026-10-07T22:00:00Z')]);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});

test("claude workspace comes from the transcript cwd, else the project folder name", () => {
  assert.equal(claudeWorkspaceFromHead('{"type":"user","cwd":"/Users/me/Documents/demo-app","sessionId":"x"}', "-Users-me-Documents-demo-app"), "demo-app");
  assert.equal(claudeWorkspaceFromHead("", "-Users-me-Documents-notes-site-papers"), "notes-site-papers");
  assert.equal(claudeWorkspaceFromHead("", ""), "Claude");
  assert.equal(claudeWorkspaceFromHead('{"cwd":"/Users/me/Library/Application Support/Claude/scratch-workspaces/a/b"}', "-Users-me-Library-Application-Support-Claude-scratch-workspaces-a-b"), "Claude");
});

test("claude code sessions show up as agents with the first prompt as title", () => {
  const home = mkdtempSync(join(tmpdir(), "lifeos-claude-home-"));
  const saved = { claude: process.env.LIFEOS_CLAUDE_HOME, cursor: process.env.LIFEOS_CURSOR_HOME, codex: process.env.LIFEOS_CODEX_HOME, activity: process.env.LIFEOS_AGENT_ACTIVITY };
  // CI and .env.example set LIFEOS_AGENT_ACTIVITY=0, which would make the scan return nothing.
  process.env.LIFEOS_AGENT_ACTIVITY = "1";
  process.env.LIFEOS_CLAUDE_HOME = home;
  process.env.LIFEOS_CURSOR_HOME = join(home, "none");
  process.env.LIFEOS_CODEX_HOME = join(home, "none");
  try {
    const dir = join(home, "projects", "-Users-me-Documents-demo-app");
    mkdirSync(join(dir, "memory"), { recursive: true });
    writeFileSync(join(dir, "memory", "notes.jsonl"), '{"timestamp":"2025-03-03T01:00:00Z"}\n');
    writeFileSync(
      join(dir, "abc-123.jsonl"),
      '{"type":"queue-operation","timestamp":"2025-03-03T00:59:00Z","content":"ignored"}\n' +
        '{"type":"user","message":{"role":"user","content":"把习惯并列显示"},"timestamp":"2025-03-03T01:00:00Z","cwd":"/Users/me/Documents/demo-app","sessionId":"abc-123"}\n' +
        '{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"好"}]},"timestamp":"2025-03-03T01:20:00Z","cwd":"/Users/me/Documents/demo-app"}\n'
    );
    const agents = listAgentsForDate("2025-03-03").filter((a) => a.source === "claude");
    assert.equal(agents.length, 1);
    assert.equal(agents[0].id, "claude:abc-123");
    assert.equal(agents[0].project, "demo-app");
    assert.equal(agents[0].title, "把习惯并列显示");
    assert.equal(agents[0].status, "done");
    assert.ok(agents[0].marks!.includes("2025-03-03T01:20:00.000Z"));
  } finally {
    process.env.LIFEOS_CLAUDE_HOME = saved.claude;
    process.env.LIFEOS_CURSOR_HOME = saved.cursor;
    process.env.LIFEOS_CODEX_HOME = saved.codex;
    if (saved.activity === undefined) delete process.env.LIFEOS_AGENT_ACTIVITY;
    else process.env.LIFEOS_AGENT_ACTIVITY = saved.activity;
    rmSync(home, { recursive: true, force: true });
  }
});
