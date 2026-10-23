import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ROOM_ZONES, parseRoomZones, roomMinutes, roomOverall, roomStrategy, setRoomZone } from "./room-plan";

describe("room-plan", () => {
  it("parses zone scores and drops junk", () => {
    assert.deepEqual(parseRoomZones('{"bed":1,"desk":"3","nope":2,"floor":9,"hall":null}'), { bed: 1, desk: 3 });
    assert.deepEqual(parseRoomZones("not json"), {});
    assert.deepEqual(parseRoomZones([1, 2]), {});
  });

  it("sets and clears one zone", () => {
    assert.deepEqual(setRoomZone({ bed: 1 }, "desk", 4), { bed: 1, desk: 4 });
    assert.deepEqual(setRoomZone({ bed: 1, desk: 4 }, "desk", null), { bed: 1 });
    assert.deepEqual(setRoomZone({ bed: 1 }, "sofa", 5), { bed: 1 });
  });

  it("scores overall 0–100 from rated zones only", () => {
    assert.equal(roomOverall({}), null);
    assert.equal(roomOverall({ bed: 1 }), 0);
    assert.equal(roomOverall({ bed: 5, desk: 5 }), 100);
    assert.equal(roomOverall({ bed: 1, desk: 5 }), 50);
  });

  it("orders strategy: must (1–2) → quick (3) → keep (4–5), worst first", () => {
    const tasks = roomStrategy({ hall: 4, desk: 3, bed: 1, laundry: 2, wardrobe: 5 });
    assert.deepEqual(
      tasks.map((t) => `${t.tier}:${t.key}`),
      ["must:bed", "must:laundry", "quick:desk", "keep:hall", "keep:wardrobe"]
    );
    assert.ok(roomMinutes(tasks) > 0);
    assert.equal(tasks.find((t) => t.tier === "keep")?.minutes, 0);
    assert.deepEqual(roomStrategy({}), []);
  });

  it("shared areas (bathroom / living / kitchen) score and strategise like bedroom zones", async () => {
    const { toggleRoomDone, parseRoomDone } = await import("./room-plan");
    assert.deepEqual(parseRoomZones('{"bathroom":1,"living":3,"kitchen":5}'), { bathroom: 1, living: 3, kitchen: 5 });
    assert.deepEqual(
      roomStrategy({ bathroom: 2, living: 3, kitchen: 4 }).map((t) => `${t.tier}:${t.key}`),
      ["must:bathroom", "quick:living", "keep:kitchen"]
    );
    assert.equal(roomOverall({ bed: 1, bathroom: 5 }), 50);
    assert.deepEqual(toggleRoomDone([], "kitchen", true), ["kitchen"]);
    assert.deepEqual(parseRoomDone('["bathroom","living"]'), ["bathroom", "living"]);
  });

  it("every zone has a unique key and a fix for both tiers", () => {
    const keys = new Set(ROOM_ZONES.map((z) => z.key));
    assert.equal(keys.size, ROOM_ZONES.length);
    for (const z of ROOM_ZONES) {
      assert.ok(z.fix.low.minutes > 0 && z.fix.mid.minutes > 0, z.key);
    }
  });
});
