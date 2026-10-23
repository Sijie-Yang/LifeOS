import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { invalidateFetchCache } from "./fetch-cache";
import {
  flattenPrefetchUrls,
  prefetchUrls,
  resolveNavPrefetchUrls,
  timelineWindowUrls,
} from "./nav-prefetch";
import { defaultWindow, timelineQuery, todayKey } from "./timeline";

afterEach(() => {
  invalidateFetchCache();
});

describe("nav prefetch keys", () => {
  it("matches the page cache keys for habits, tasks, opportunities, and review", () => {
    assert.ok(resolveNavPrefetchUrls("/habits").includes("/api/habits?view=all"));
    assert.ok(resolveNavPrefetchUrls("/tasks").includes("/api/tasks?filter=open"));
    assert.ok(resolveNavPrefetchUrls("/opportunities").includes("/api/opportunities?lane=career"));
    assert.ok(resolveNavPrefetchUrls("/social").includes("/api/opportunities?lane=life"));
    assert.deepEqual(resolveNavPrefetchUrls("/review/month"), ["/api/review/period?type=month"]);
    assert.deepEqual(resolveNavPrefetchUrls("/review/quarter"), ["/api/review/period?type=quarter"]);
    assert.deepEqual(resolveNavPrefetchUrls("/review/year"), ["/api/review/period?type=year"]);
  });


  it("prefetches month, year, and decade timeline windows", () => {
    const today = todayKey();
    const expected = (["month", "year", "decade"] as const).map((scale) => {
      const win = defaultWindow(scale, today);
      return `/api/timeline?${timelineQuery(scale, win.start, win.end)}`;
    });
    assert.deepEqual(timelineWindowUrls(today), expected);
    assert.deepEqual(resolveNavPrefetchUrls("/timeline"), expected);
    assert.equal(flattenPrefetchUrls(["/timeline", "/calendar"]).length, 3);
  });

  it("caps idle prefetch concurrency", async () => {
    const original = globalThis.fetch;
    let inflight = 0;
    let max = 0;
    globalThis.fetch = (async () => {
      inflight += 1;
      max = Math.max(max, inflight);
      await new Promise((resolve) => setTimeout(resolve, 25));
      inflight -= 1;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    try {
      await prefetchUrls(["/api/a", "/api/b", "/api/c", "/api/d"], 2);
      assert.ok(max <= 2);
      assert.equal(max, 2);
    } finally {
      globalThis.fetch = original;
    }
  });
});

it("cancels queued speculative requests on navigation cleanup", async () => {
  const original = globalThis.fetch;
  const controller = new AbortController();
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    controller.abort();
    return Response.json({ ok: true });
  }) as typeof fetch;
  try {
    await prefetchUrls(["/api/cancel-a", "/api/cancel-b"], 1, controller.signal);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = original; }
});
