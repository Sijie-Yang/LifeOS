import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyzeCrushContact } from "./crush-analysis";

const NOW = new Date("2026-09-07T12:00:00+08:00");

describe("analyzeCrushContact", () => {
  it("stays insufficient with no notes or logs", () => {
    const result = analyzeCrushContact({
      name: "A",
      notes: null,
      importance: 3,
      responseLevel: null,
      lastContactAt: null,
      contactFrequencyDays: 30,
      now: NOW,
      logs: [],
      meetings: [],
    });
    assert.equal(result.relationKind, "insufficient");
    assert.equal(result.evidenceLevel, "thin");
    assert.equal(result.availability, "unknown");
  });

  it("marks closed when notes already say there is no real interest", () => {
    const result = analyzeCrushContact({
      name: "A",
      notes: "TA 没有实质性意思，只当朋友。\n不再过度解读。",
      importance: 5,
      responseLevel: 2,
      lastContactAt: "2026-08-01",
      contactFrequencyDays: 14,
      now: NOW,
      logs: [
        { type: "message", content: "续温", contactedAt: "2026-08-01T10:00:00+08:00" },
        { type: "message", content: "续温", contactedAt: "2026-07-10T10:00:00+08:00" },
      ],
      meetings: [],
    });
    assert.equal(result.relationKind, "closed");
    assert.equal(result.availability, "closed");
    assert.ok(result.findings.some((f) => f.title.includes("边界")));
    assert.ok(result.nextMoves.some((m) => m.includes("少打开")));
  });

  it("treats user-only outreach as one-sided, not mutual love", () => {
    const result = analyzeCrushContact({
      name: "A",
      notes: "有点心动，偶尔会走神。",
      importance: 5,
      responseLevel: 2,
      lastContactAt: "2026-09-01",
      contactFrequencyDays: 7,
      now: NOW,
      logs: [
        { type: "message", content: "续温", contactedAt: "2026-09-01T10:00:00+08:00" },
        { type: "message", content: "续温", contactedAt: "2026-08-20T10:00:00+08:00" },
        { type: "message", content: "续温", contactedAt: "2026-08-10T10:00:00+08:00" },
      ],
      meetings: [],
    });
    assert.equal(result.relationKind, "one_sided");
    assert.equal(result.availability, "low");
    assert.ok(result.caveats.some((c) => c.includes("聊天原文")));
  });
});
