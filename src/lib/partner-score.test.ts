import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { nextPartnerProfile, parsePartnerProfile, partnerMust, partnerTotal } from "./partner-score";

const all = (n: number) =>
  Object.fromEntries(["respect", "communication", "values", "lifestyle", "support", "longTerm", "comfort"].map((k) => [k, n]));

describe("partner score", () => {
  it("weights scored items into 0–100", () => {
    assert.equal(partnerTotal({}), null);
    assert.equal(partnerTotal(all(5)), 100);
    assert.equal(partnerTotal(all(1)), 0);
    assert.equal(partnerTotal(all(3)), 50);
  });

  it("checks the must-haves", () => {
    assert.equal(partnerMust(all(4)).state, "pass");
    // 沟通底线是 3（一般）
    assert.equal(partnerMust({ ...all(4), communication: 3 }).state, "pass");
    const fail = partnerMust({ ...all(4), respect: 3 });
    assert.equal(fail.state, "fail");
    assert.deepEqual(fail.failed, ["相互尊重与边界"]);
    const pending = partnerMust({ values: 5 });
    assert.equal(pending.state, "pending");
    assert.equal(pending.missing.length, 2);
  });

  it("drops bad values and records score history once per day", () => {
    const p = parsePartnerProfile('{"stage":"nope","scores":{"comfort":9,"support":4,"x":3}}');
    assert.deepEqual(p?.scores, { support: 4 });
    assert.equal(p?.stage, "met");
    const a = nextPartnerProfile(null, { scores: { support: 4 } }, "2026-10-12");
    const b = nextPartnerProfile(a, { scores: { support: 5 } }, "2026-10-12");
    const c = nextPartnerProfile(b, { scores: { support: 5, comfort: 4 }, stage: "chatting" }, "2026-10-13");
    assert.equal(b.history.length, 1);
    assert.equal(c.history.length, 2);
    assert.equal(c.stage, "chatting");
  });
});
