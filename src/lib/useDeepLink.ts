"use client";

import { useEffect, useRef } from "react";

/** Open an item when URL contains ?id=xxx (used by global search deep links). */
export function useDeepLinkOpen(onId: (id: string) => void, ready = true) {
  const handled = useRef<string | null>(null);
  const onIdRef = useRef(onId);
  onIdRef.current = onId;

  useEffect(() => {
    if (!ready || typeof window === "undefined") return;
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id || handled.current === id) return;
    handled.current = id;
    onIdRef.current(id);
    const url = new URL(window.location.href);
    url.searchParams.delete("id");
    window.history.replaceState({}, "", url.pathname + url.search);
  }, [ready]);
}
