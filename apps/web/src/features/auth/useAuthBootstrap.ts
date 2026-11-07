import type { AuthUser } from "@linkedout/shared";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/stores/auth";

/** On load: ask the API who we are. The api client refreshes the access cookie if needed. */
export function useAuthBootstrap() {
  const setUser = useAuth((s) => s.setUser);
  useEffect(() => {
    api
      .get<{ user: AuthUser }>("/auth/me")
      .then((r) => setUser(r.user))
      .catch(async () => {
        // /auth/* is excluded from auto-refresh, so try once explicitly.
        if (await api.refreshSession()) {
          const r = await api.get<{ user: AuthUser }>("/auth/me").catch(() => null);
          setUser(r?.user ?? null);
        } else {
          setUser(null);
        }
      });
  }, [setUser]);
}
