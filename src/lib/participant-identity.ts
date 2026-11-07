"use client";

import { useSyncExternalStore } from "react";

/*
 * Nama peserta untuk mode demo.
 *
 * `StartForm` menyimpan nama yang benar-benar diketik peserta. Halaman hasil
 * membacanya kembali supaya tidak menampilkan nama karangan seperti "Rina"
 * untuk orang yang tidak pernah mengisi form (DESIGN.md §9 poin 3).
 * Saat backend terpasang, ini diganti pembacaan attempt dari server.
 */
const KEY = "kilat_participant";

export interface ParticipantIdentity {
  name: string;
  className: string;
}

function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("kilat:participant", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("kilat:participant", listener);
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

/**
 * `null` berarti perangkat ini belum pernah mengisi form peserta. Pemanggil
 * wajib menampilkan sapaan netral, bukan nama contoh.
 */
export function useParticipantName(): ParticipantIdentity | null {
  const raw = useSyncExternalStore(subscribe, readSnapshot, getServerSnapshot);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ParticipantIdentity>;
    if (typeof parsed.name !== "string" || parsed.name.trim().length === 0) return null;
    return { name: parsed.name.trim(), className: parsed.className ?? "" };
  } catch {
    return null;
  }
}
