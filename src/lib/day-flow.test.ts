import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { defaultDayPhase } from "./day-flow";

const base = { date: "2026-10-12", today: "2026-10-12", started: false, closed: false };

describe("defaultDayPhase", () => {
  it("follows the time of day", () => {
    assert.equal(defaultDayPhase({ ...base, hour: 7 }), "start");
    assert.equal(defaultDayPhase({ ...base, hour: 14 }), "do");
    assert.equal(defaultDayPhase({ ...base, hour: 21 }), "record");
  });

  it("moves on once the day is started or closed", () => {
    assert.equal(defaultDayPhase({ ...base, hour: 8, started: true }), "do");
    assert.equal(defaultDayPhase({ ...base, hour: 15, closed: true }), "record");
  });

  it("reviews past days and previews future days", () => {
    assert.equal(defaultDayPhase({ ...base, date: "2026-10-11", hour: 9 }), "record");
    assert.equal(defaultDayPhase({ ...base, date: "2026-10-13", hour: 22 }), "start");
  });
});
