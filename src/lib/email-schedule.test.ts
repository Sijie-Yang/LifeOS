import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dueEmailSlot } from "./email-schedule";

describe("dueEmailSlot", () => {
  it("fires in the 07:00 and 20:00 windows only", () => {
    assert.equal(dueEmailSlot("06:59"), null);
    assert.equal(dueEmailSlot("07:00"), "morning");
    assert.equal(dueEmailSlot("07:29"), "morning");
    assert.equal(dueEmailSlot("07:30"), null);
    assert.equal(dueEmailSlot("12:00"), null);
    assert.equal(dueEmailSlot("20:00"), "evening");
    assert.equal(dueEmailSlot("20:30"), null);
  });
});
