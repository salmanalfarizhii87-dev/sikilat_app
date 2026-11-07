"use client";

import { useSyncExternalStore } from "react";

/**
 * Browser-only values are read through `useSyncExternalStore` so the server
 * snapshot and the first client snapshot agree. This avoids hydration
 * mismatches without setting state from an effect.
 */
const emptySubscribe = () => () => {};

/** False during SSR and the first paint, true afterwards. */
export function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

/** `window.location.origin` once mounted, otherwise a stable placeholder. */
export function useOrigin(fallback = "sikilat.app") {
  const mounted = useMounted();
  if (!mounted || typeof window === "undefined") return fallback;
  return window.location.origin;
}

/** Human-readable origin without the protocol, for display in copy fields. */
export function useOriginLabel(fallback = "sikilat.app") {
  return useOrigin(fallback).replace(/^https?:\/\//, "");
}

function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/** Tracks `navigator.onLine` without a state-syncing effect. */
export function useOnline() {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

function subscribeVisibility(callback: () => void) {
  document.addEventListener("visibilitychange", callback);
  return () => document.removeEventListener("visibilitychange", callback);
}

/** True while the tab is visible; used for integrity logging. */
export function useTabVisible() {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === "visible",
    () => true,
  );
}
