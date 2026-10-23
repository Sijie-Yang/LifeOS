import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { halfHourSlots, parseTimeFills } from "./time-fills";

describe("half-hour slots", () => {
  it("uses 06:00–23:00 when no times are marked", () => {
    const slots = halfHourSlots(null, null);
    assert.equal(slots[0], "06:00");
    assert.equal(slots.at(-1), "22:30");
    assert.equal(slots.length, 34);
  });

  it("ends at the bedtime half-hour", () => {
    assert.equal(halfHourSlots("07:30", "22:30").at(-1), "22:00");
    assert.equal(halfHourSlots(null, "22:00").at(-1), "21:30");
    assert.equal(halfHourSlots(null, "22:00")[0], "06:00");
  });

  it("starts at the wake half-hour when only wake is marked", () => {
    assert.equal(halfHourSlots("07:30", null)[0], "07:30");
    assert.equal(halfHourSlots("08:10", null)[0], "08:00");
    assert.equal(halfHourSlots("08:10", null).at(-1), "22:30");
  });

  it("snaps wake and sleep onto half hours", () => {
    assert.deepEqual(halfHourSlots("06:40", "22:00").slice(0, 2), ["06:30", "07:00"]);
    assert.equal(halfHourSlots("06:40", "22:00").at(-1), "21:30");
    assert.deepEqual(halfHourSlots("07:00", "08:00"), ["07:00", "07:30"]);
  });
});

describe("time fills", () => {
  it("keeps known categories on half-hour keys", () => {
    assert.deepEqual(parseTimeFills('{"07:00":"research","07:30":"nope","08:00":"play","bad":"rest"}'), {
      "07:00": "research",
      "08:00": "play",
    });
  });
});
