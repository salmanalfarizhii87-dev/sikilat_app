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

/* -------------------------------------------------------------------------- */
/* Jam dinding bersama                                                        */
/* -------------------------------------------------------------------------- */

/*
 * Satu `setInterval` untuk seluruh halaman, bukan satu per komponen.
 *
 * `useSyncExternalStore` meminta `getSnapshot` yang **stabil** di antara render:
 * kalau ia mengembalikan `Date.now()` langsung, setiap panggilan menghasilkan
 * angka berbeda, React menganggap store terus berubah, dan render berulang tanpa
 * henti. Karena itu waktunya disimpan di variabel modul yang hanya diperbarui
 * oleh interval — snapshot berubah sepuluh detik sekali, bukan setiap panggilan.
 */
let clockNow = 0;
let clockTimer: ReturnType<typeof setInterval> | null = null;
const clockListeners = new Set<() => void>();

function subscribeClock(listener: () => void) {
  clockListeners.add(listener);

  if (clockTimer === null) {
    clockNow = Date.now();
    clockTimer = setInterval(() => {
      clockNow = Date.now();
      for (const item of clockListeners) item();
    }, 10_000);
  }

  return () => {
    clockListeners.delete(listener);
    if (clockListeners.size === 0 && clockTimer !== null) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  };
}

/**
 * Waktu sekarang dalam milidetik, diperbarui tiap sepuluh detik.
 *
 * `null` saat SSR dan render klien pertama. Halaman yang menampilkan hitungan
 * mundur memakai `null` itu untuk menampilkan tanda hubung: waktu server dan
 * waktu peramban tidak pernah sama persis, jadi angka yang dirender server akan
 * berbeda dari angka hasil hidrasi.
 */
export function useClock(): number | null {
  return useSyncExternalStore(
    subscribeClock,
    () => clockNow || null,
    () => null,
  );
}
