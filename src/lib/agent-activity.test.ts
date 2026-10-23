import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  activityStartMs,
  agentGreen,
  agentIsRunning,
  agentSlotCounts,
  agentStatus,
  agentTitle,
  codexStartedMs,
  codexThreadId,
  codexTitleFromHead,
  cursorProjectName,
  cursorTitleFromHead,
  expandActivity,
  sortAgents,
} from "./agent-activity";

describe("agent activity", () => {
  it("keeps running agents above finished ones", () => {
    const sorted = sortAgents([
      { status: "done" as const, endedAt: "2026-10-06T10:00:00.000Z" },
      { status: "running" as const, endedAt: "2026-10-06T09:00:00.000Z" },
      { status: "done" as const, endedAt: "2026-10-06T12:00:00.000Z" },
    ]);
    assert.deepEqual(
      sorted.map((item) => item.status),
      ["running", "done", "done"]
    );
    assert.equal(sorted[1].endedAt, "2026-10-06T12:00:00.000Z");
  });

  it("treats a write in the last two minutes as running", () => {
    const now = Date.parse("2026-10-06T09:00:00.000Z");
    assert.equal(agentStatus(now - 60_000, now), "running");
    assert.equal(agentStatus(now - 3 * 60_000, now), "done");
  });

  it("paints github greens and counts overlapping half-hours", () => {
    assert.equal(agentGreen(0), "#ebedf0");
    assert.equal(agentGreen(1), "#9be9a8");
    assert.equal(agentGreen(4), "#216e39");
    const day = "2026-10-06";
    const counts = agentSlotCounts(
      [
        { startedAt: "2026-10-06T08:10:00", endedAt: "2026-10-06T08:40:00" },
        { startedAt: "2026-10-06T08:20:00", endedAt: "2026-10-06T08:25:00" },
      ],
      day
    );
    assert.equal(counts["08:00"], 2);
    assert.equal(counts["08:30"], 1);
    assert.equal(counts["09:00"], undefined);
  });

  it("reads a cursor project and the first user query", () => {
    assert.equal(cursorProjectName("Users-alice-Documents-notes-site"), "notes-site");
    assert.equal(
      cursorTitleFromHead('<timestamp>x</timestamp><user_query>\\n监测 Cursor 和 Codex\\n</user_query>'),
      "监测 Cursor 和 Codex"
    );
  });

  it("skips codex instruction wrappers and parses the rollout clock", () => {
    const head = [
      '{"type":"session_meta","payload":{"cwd":"/Users/alice/Documents/notes-site-platform"}}',
      '{"type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"AGENTS.md instructions"}]}}',
      '{"type":"response_item","payload":{"type":"message","role":"user","content":[{"type":"input_text","text":"把首页预览修好"}]}}',
    ].join("\n");
    assert.equal(codexTitleFromHead(head, "notes-site-platform"), "把首页预览修好");
    const started = codexStartedMs("rollout-2026-10-06T08-31-37-01a10e9f.jsonl");
    assert.equal(started, new Date("2026-10-06T08:31:37").getTime());
  });

  it("uses the custom name and the codex thread id", () => {
    assert.equal(agentTitle("LifeOS", "第一句提问"), "LifeOS");
    assert.equal(agentTitle("  ", "第一句提问"), "第一句提问");
    assert.equal(
      codexThreadId("rollout-2026-10-06T08-31-37-01a10e9f-82d9-7f13-ad5e-54b24bc9ce9e.jsonl"),
      "01a10e9f-82d9-7f13-ad5e-54b24bc9ce9e"
    );
  });

  it("joins nearby activity and leaves long gaps empty", () => {
    const at = (hour: number, minute: number) => new Date(2026, 9, 6, hour, minute).getTime();
    const slots = expandActivity([at(17, 35), at(17, 49), at(20, 7)], "2026-10-06");
    assert.ok(slots.includes("17:30"));
    assert.equal(slots.includes("18:30"), false);
    assert.ok(slots.includes("20:00"));
  });

  it("stays running while a cursor turn has started but the transcript has not flushed", () => {
    const now = Date.parse("2026-10-06T12:10:00.000Z");
    const file = Date.parse("2026-10-06T09:52:00.000Z");
    const header = Date.parse("2026-10-06T12:07:00.000Z");
    assert.equal(agentIsRunning(file, header, now), true);
    assert.equal(agentIsRunning(file, header, header + 21 * 60 * 1000), false);
    assert.equal(agentStatus(file, now), "done");
  });

  it("only marks the latest half-hour when a session started before today", () => {
    const dayStart = new Date("2026-10-06T00:00:00").getTime();
    const ended = new Date("2026-10-06T09:26:00").getTime();
    const started = new Date("2026-10-04T08:00:00").getTime();
    assert.equal(activityStartMs(started, ended, dayStart), ended);
  });
});
