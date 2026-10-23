import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  NAV_LIBRARY,
  NAV_SECTIONS,
  activeSectionKey,
  libraryItemActive,
  navItemActive,
} from "./nav-sections";

describe("nav sections", () => {
  it("keeps every previous sidebar route reachable", () => {
    const hrefs = new Set([
      ...NAV_SECTIONS.flatMap((s) => [s.href, ...s.items.map((i) => i.href)]),
      ...NAV_LIBRARY.map((i) => i.href),
    ]);
    for (const href of [
      "/timeline?scale=day", "/projects", "/loop", "/habits",
      "/timeline", "/records", "/urges", "/cooking", "/tasks", "/checklists",
      "/meetings", "/travel", "/strategy", "/power", "/foresight", "/briefing", "/review",
      "/review/month", "/review/quarter", "/review/year", "/review/trends", "/contacts",
      "/opportunities", "/social", "/notes", "/reading", "/library", "/goals", "/finance",
    ]) {
      assert.ok(hrefs.has(href), `missing ${href}`);
    }
  });

  it("maps routes to their primary section", () => {
    assert.equal(activeSectionKey("/timeline", "day"), "now");
    assert.equal(activeSectionKey("/timeline", "powers"), "now");
    assert.equal(activeSectionKey("/timeline", null), "advance");
    assert.equal(activeSectionKey("/timeline", "year"), "advance");
    assert.equal(activeSectionKey("/goals/abc", null), "advance");
    assert.equal(activeSectionKey("/stream", null), "stream");
    assert.equal(activeSectionKey("/meetings", null), "people");
    assert.equal(activeSectionKey("/review/month", null), "review");
    assert.equal(activeSectionKey("/foresight", null), "review");
    assert.equal(activeSectionKey("/", null), "now");
    assert.equal(activeSectionKey("/finance", null), null);
    assert.ok(libraryItemActive("/finance"));
  });

  it("matches the weekly review exactly", () => {
    assert.ok(navItemActive("/review", "/review", null, true));
    assert.ok(!navItemActive("/review", "/review/month", null, true));
    assert.ok(!navItemActive("/timeline?scale=day", "/timeline", "month"));
  });
});
