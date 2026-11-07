"use client";

import { useCallback, useSyncExternalStore } from "react";

/*
 * Identitas admin untuk mode demo.
 *
 * Aplikasi belum punya backend, jadi tidak ada sesi sungguhan. Yang disimpan
 * hanyalah email yang benar-benar diketik di halaman login, supaya shell admin
 * tidak menampilkan nama orang yang tidak pernah masuk (DESIGN.md §9 poin 3).
 * Saat Supabase Auth terpasang, modul ini diganti pembacaan sesi server.
 */
const KEY = "kilat_admin_identity";

export interface AdminIdentity {
  email: string;
  signedInAt: string;
}

let listeners: Array<() => void> = [];

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  window.addEventListener("storage", listener);
  window.addEventListener("kilat:identity", listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
    window.removeEventListener("storage", listener);
    window.removeEventListener("kilat:identity", listener);
  };
}

function readSnapshot(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot(): string | null {
  return null;
}

export function saveAdminIdentity(email: string) {
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ email, signedInAt: new Date().toISOString() } satisfies AdminIdentity),
    );
    window.dispatchEvent(new Event("kilat:identity"));
    emit();
  } catch {
    // penyimpanan diblokir: shell akan menampilkan keadaan tanpa identitas
  }
}

export function clearAdminIdentity() {
  try {
    window.localStorage.removeItem(KEY);
    window.dispatchEvent(new Event("kilat:identity"));
    emit();
  } catch {
    // noop
  }
}

/**
 * `null` berarti belum ada yang login di perangkat ini. Pemanggil wajib
 * menampilkan keadaan netral, bukan nama contoh.
 */
export function useAdminIdentity(): AdminIdentity | null {
  const raw = useSyncExternalStore(subscribe, readSnapshot, getServerSnapshot);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AdminIdentity>;
    if (typeof parsed.email !== "string" || !parsed.email.includes("@")) return null;
    return { email: parsed.email, signedInAt: parsed.signedInAt ?? "" };
  } catch {
    return null;
  }
}

export function useSignOut() {
  return useCallback(() => clearAdminIdentity(), []);
}
