import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  invalidateFetchCache,
  isFetchCacheFresh,
  peekFetchCache,
  setFetchCache,
} from "./fetch-cache";
import { fetchJson, shouldShowPageLoading } from "@/components/ui/PageState";

afterEach(() => {
  invalidateFetchCache();
});

describe("fetch cache", () => {
  it("hydrates peek after set and keeps stale data", () => {
    setFetchCache("/api/demo", { ok: true }, Date.now() - 200_000);
    assert.deepEqual(peekFetchCache("/api/demo"), { ok: true });
    assert.equal(isFetchCacheFresh("/api/demo"), false);
    assert.equal(shouldShowPageLoading(["/api/demo"]), false);
    assert.equal(shouldShowPageLoading(["/api/missing"]), true);
  });

  it("keeps peek memory-only so SSR and hydration see the same empty store", () => {
    assert.equal(peekFetchCache("/api/unseen"), null);
    assert.equal(shouldShowPageLoading(["/api/unseen"]), true);
  });

  it("invalidates by prefix", () => {
    setFetchCache("/api/habits?view=all", { habits: [] });
    setFetchCache("/api/projects", { projects: [] });
    invalidateFetchCache("/api/habits");
    assert.equal(peekFetchCache("/api/habits?view=all"), null);
    assert.deepEqual(peekFetchCache("/api/projects"), { projects: [] });
  });

  it("returns stale data first and dedupes inflight fetches", async () => {
    const original = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return new Response(JSON.stringify({ n: calls }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;

    try {
      setFetchCache("/api/stale", { n: 0 }, Date.now() - 200_000);
      const stale = await fetchJson<{ n: number }>("/api/stale", { ttl: 1 });
      assert.deepEqual(stale, { n: 0 });

      const [a, b] = await Promise.all([
        fetchJson<{ n: number }>("/api/cold"),
        fetchJson<{ n: number }>("/api/cold"),
      ]);
      assert.deepEqual(a, b);
      assert.equal(calls, 2);
    } finally {
      globalThis.fetch = original;
    }
  });
});

it("a post-mutation refresh does not reuse or get overwritten by an older request", async () => {
  const original = globalThis.fetch;
  const responses: ((value: Response) => void)[] = [];
  globalThis.fetch = (() => new Promise<Response>((resolve) => responses.push(resolve))) as typeof fetch;
  const { refetchJson } = await import("@/components/ui/PageState");
  try {
    const oldRequest = fetchJson<{ version: number }>("/api/race");
    const newRequest = refetchJson<{ version: number }>("/api/race");
    assert.equal(responses.length, 2);
    responses[1](Response.json({ version: 2 }));
    assert.deepEqual(await newRequest, { version: 2 });
    responses[0](Response.json({ version: 1 }));
    await oldRequest;
    assert.deepEqual(peekFetchCache("/api/race"), { version: 2 });
  } finally { globalThis.fetch = original; }
});

it("failed background refresh retains stale data without an unhandled rejection", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => { throw new Error("offline"); }) as typeof fetch;
  try {
    setFetchCache("/api/offline", { saved: true }, Date.now() - 200_000);
    assert.deepEqual(await fetchJson("/api/offline"), { saved: true });
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.deepEqual(peekFetchCache("/api/offline"), { saved: true });
  } finally { globalThis.fetch = original; }
});

it("invalidating one resource preserves unrelated in-flight caching", async () => {
  const original = globalThis.fetch;
  let respond!: (value: Response) => void;
  let calls = 0;
  globalThis.fetch = (() => { calls++; return new Promise<Response>((resolve) => { respond = resolve; }); }) as typeof fetch;
  try {
    const first = fetchJson("/api/unrelated");
    invalidateFetchCache("/api/contacts");
    const second = fetchJson("/api/unrelated");
    respond(Response.json({ retained: true }));
    await Promise.all([first, second]);
    assert.equal(calls, 1);
    assert.deepEqual(peekFetchCache("/api/unrelated"), { retained: true });
  } finally { globalThis.fetch = original; }
});
