import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, planTrackerSync, mapStatus } from "./tracker-sync";
import { parseAlignOps } from "./align-ops";

const csv = 'Priority,Track,Institution/Company,Position,Location,Deadline,Required materials,Fit notes,URL,Status,Referees needed,Notes\n' +
  '3 - Academic,Academic,"Example University, Geo Lab",Postdoc GeoAI,Example City,rolling,,,,Next up,,\n' +
  '1 - AI/LLM lab,Industry (AI lab),Acme AI,Agent 研究员,Remote,rolling,,,https://x.y/1,To review,,"a, ""b"""\n';

describe("tracker-sync", () => {
  it("parses quoted csv", () => {
    const rows = parseCsv(csv);
    assert.equal(rows.length, 2);
    assert.equal(rows[1].Notes, 'a, "b"');
  });
  it("matches by brand + detail and creates the rest", () => {
    const plan = planTrackerSync(parseCsv(csv), [
      { id: "o1", title: "Example University · Geo Lab · Postdoc", status: "Active", priority: "MEDIUM", deadline: null, source: null, category: "Career" },
    ]);
    assert.equal(plan.matched.length, 1);
    assert.equal(plan.created.length, 1);
    assert.equal(parseAlignOps(plan.ops).errors.length, 0);
  });
  it("maps statuses", () => {
    assert.equal(mapStatus("Submitted 2026-10-16"), "Active");
    assert.equal(mapStatus("On hold"), "Watching");
  });
});

describe("patch ops", () => {
  it("whitelists fields and rejects description", () => {
    const { ops, errors } = parseAlignOps([
      { op: "update_project", projectId: "p", set: { status: "IN_PROGRESS", workdays: [1, 3] } },
      { op: "update_project", projectId: "p", set: { description: "x" } },
      { op: "update_contact", contactId: "c", set: { importance: 5, city: "Singapore" } },
      { op: "create_opportunity", set: { title: "T", status: "Bogus" } },
    ]);
    assert.equal(ops.length, 2);
    assert.equal(errors.length, 2);
  });
});
