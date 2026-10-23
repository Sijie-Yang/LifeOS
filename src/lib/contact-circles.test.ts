import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  circleColor,
  closeness,
  isProactive,
  placeCircles,
} from "./contact-circles";

describe("contact circles", () => {
  it("treats response level 5 and above as proactive", () => {
    assert.equal(isProactive(5), true);
    assert.equal(isProactive(6), true);
    assert.equal(isProactive(4), false);
    assert.equal(isProactive(null), false);
  });

  it("keeps closeness between 0 and 1 and ranks a close contact higher", () => {
    const now = Date.parse("2026-10-04T00:00:00Z");
    const close = closeness({
      importance: 5,
      contactFrequencyDays: 7,
      lastContactAt: "2026-10-03T00:00:00Z",
      now,
    });
    const distant = closeness({
      importance: 1,
      contactFrequencyDays: 180,
      lastContactAt: null,
      now,
    });
    assert.ok(close > distant);
    assert.ok(close <= 1);
    assert.ok(distant > 0);
  });

  it("gives each named circle its own color", () => {
    assert.notEqual(circleColor("家人"), circleColor("Academia"));
    assert.notEqual(circleColor("教授"), circleColor("大厂"));
  });

  it("packs circles without overlapping disks", () => {
    const placed = placeCircles([
      { id: "a", name: "Academia", color: "#4338ca", memberIds: Array.from({ length: 12 }, (_, i) => `a${i}`) },
      { id: "b", name: "家人", color: "#db2777", memberIds: ["b1", "b2"] },
      { id: "c", name: "教授", color: "#7c3aed", memberIds: ["c1"] },
    ]);
    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        const gap = Math.hypot(placed[i].cx - placed[j].cx, placed[i].cy - placed[j].cy);
        assert.ok(gap >= placed[i].r + placed[j].r - 0.5);
      }
    }
    assert.equal(placed.reduce((n, c) => n + c.nodes.length, 0), 15);
  });
});
