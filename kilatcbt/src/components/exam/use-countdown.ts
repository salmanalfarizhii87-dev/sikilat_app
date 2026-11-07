"use client";

import { useMemo, useSyncExternalStore } from "react";

export interface RemainingTime {
  seconds: number;
  minutes: number;
  label: string;
  isCritical: boolean;
  isWarning: boolean;
  expired: boolean;
}

/**
 * A single shared 1s ticker. The clock lives outside React state and is read
 * through `useSyncExternalStore`, so no component ever mutates state during
 * render and every timer on screen updates in the same frame.
 */
const listeners = new Set<() => void>();
let interval: number | null = null;
let currentSecond = 0;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    currentSecond = Math.floor(Date.now() / 1000);
    interval = window.setInterval(() => {
      const next = Math.floor(Date.now() / 1000);
      if (next === currentSecond) return;
      currentSecond = next;
      listeners.forEach((fn) => fn());
    }, 250);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && interval !== null) {
      window.clearInterval(interval);
      interval = null;
    }
  };
}

function getSnapshot() {
  return currentSecond;
}

/** 0 during SSR, which the hook treats as "not mounted yet". */
function getServerSnapshot() {
  return 0;
}

/**
 * Counts down to an absolute deadline. The ticker is intentionally coarse
 * (1 second) because the UI never shows sub-second precision.
 */
export function useCountdown(expiresAt: string | null) {
  const second = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const mounted = second > 0;

  return useMemo<RemainingTime>(() => {
    if (!expiresAt || !mounted) {
      return {
        seconds: 0,
        minutes: 0,
        label: "--:--",
        isCritical: false,
        isWarning: false,
        expired: false,
      };
    }

    const target = new Date(expiresAt).getTime();
    const remaining = Math.max(0, Math.round((target - second * 1000) / 1000));
    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    const hours = Math.floor(minutes / 60);
    const label =
      hours > 0
        ? `${hours}:${String(minutes % 60).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
        : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

    return {
      seconds: remaining,
      minutes,
      label,
      isCritical: remaining <= 60,
      isWarning: remaining <= 300,
      expired: remaining <= 0,
    };
  }, [expiresAt, mounted, second]);
}
