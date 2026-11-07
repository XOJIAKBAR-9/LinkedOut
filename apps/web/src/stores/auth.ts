import type { AuthUser } from "@linkedout/shared";
import { create } from "zustand";

interface AuthState {
  user: AuthUser | null;
  /** True until the initial /auth/me check finishes. */
  loading: boolean;
  setUser: (user: AuthUser | null) => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user, loading: false }),
}));
