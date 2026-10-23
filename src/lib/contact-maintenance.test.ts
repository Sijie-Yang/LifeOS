import assert from "node:assert/strict";
import { test } from "node:test";
import { contactDue, compareContactPriority, validateCircle } from "./contact-maintenance";
const now = new Date(2026, 9, 8, 8);
const contact = { lastContactAt: new Date(2026, 9, 1, 23).toISOString(), contactFrequencyDays: 7, importance: 3 };
test("cadence is due on the calendar day, independent of contact time", () => {
  assert.equal(contactDue(contact, now).label, "今天联系");
  assert.equal(contactDue({ ...contact, contactFrequencyDays: 6 }, now).label, "已逾期 1 天");
  assert.equal(contactDue({ ...contact, contactFrequencyDays: 14 }, now).status, "soon");
  assert.equal(contactDue({ ...contact, contactFrequencyDays: 15 }, now).status, "ok");
});
test("unknown contact history is explicit and prioritized after due contacts", () => {
  const unknown = { ...contact, lastContactAt: null, importance: 5 };
  assert.equal(contactDue(unknown, now).status, "never");
  assert.ok(compareContactPriority(contact, unknown, now) < 0);
  assert.ok(compareContactPriority(unknown, { ...contact, contactFrequencyDays: 30 }, now) < 0);
});
test("circle input rejects empty names and invalid colors", () => {
  assert.throws(() => validateCircle({ name: "   " }));
  assert.throws(() => validateCircle({ name: "朋友", color: "red" }));
  assert.deepEqual(validateCircle({ name: "  朋友  ", color: "#00aaff" }), { name: "朋友", color: "#00aaff" });
});
