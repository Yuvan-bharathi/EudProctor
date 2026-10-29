import { useSyncExternalStore } from "react";

export type Role = "admin" | "mentor" | "candidate";

export interface User {
  id: string;
  role: Role;
  email: string;
  name: string;
  is_active: boolean;
}

export interface AuthState {
  access_token: string;
  refresh_token: string;
  user: User;
}

const KEY = "eduproctor.auth";
const listeners = new Set<() => void>();

function read(): AuthState | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AuthState) : null;
  } catch {
    return null;
  }
}

let state: AuthState | null = read();

export const authStore = {
  get: () => state,
  set(next: AuthState) {
    state = next;
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable: keep in memory */
    }
    listeners.forEach((l) => l());
  },
  clear() {
    state = null;
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useAuth() {
  const s = useSyncExternalStore(authStore.subscribe, authStore.get, authStore.get);
  return { user: s?.user ?? null, logout: authStore.clear };
}

export const roleHome: Record<Role, string> = {
  admin: "/admin",
  mentor: "/mentor",
  candidate: "/candidate/assessments",
};

export const roleLabel: Record<Role, string> = {
  admin: "Admin",
  mentor: "Mentor",
  candidate: "Candidate",
};
