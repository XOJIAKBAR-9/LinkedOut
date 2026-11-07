import { useTranslation } from "react-i18next";
import type { PublicUser } from "@linkedout/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Page } from "@/components/Page";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { fullName, timeAgo } from "@/lib/utils";

interface Pending { id: string; createdAt: string; user: PublicUser }
interface Connection { id: string; since: string; user: PublicUser }

function PersonRow({ user, meta, children }: { user: PublicUser; meta?: string; children?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-3">
      <Link to={`/in/${user.id}`}><UserAvatar user={user} className="h-12 w-12" /></Link>
      <div className="min-w-0 flex-1">
        <Link to={`/in/${user.id}`} className="font-medium hover:underline">{fullName(user)}</Link>
        {user.headline && <p className="truncate text-sm text-muted-foreground">{user.headline}</p>}
        {meta && <p className="text-xs text-muted-foreground">{meta}</p>}
      </div>
      <div className="flex gap-2">{children}</div>
    </li>
  );
}

export function NetworkPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const pending = useQuery({ queryKey: ["connections", "pending"], queryFn: () => api.get<{ items: Pending[] }>("/connections/pending") });
  const connections = useQuery({ queryKey: ["connections"], queryFn: () => api.get<{ items: Connection[] }>("/connections") });
  const refresh = () => qc.invalidateQueries({ queryKey: ["connections"] });

  const accept = useMutation({ mutationFn: (id: string) => api.post(`/connections/${id}/accept`), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: string) => api.delete(`/connections/${id}`), onSuccess: refresh });

  return (
    <Page title={t("network.title")}>
      <div className="mx-auto max-w-3xl space-y-4">
        <h1 className="text-2xl font-bold">{t("network.title")}</h1>
        <Card className="p-6">
          <h2 className="text-lg font-semibold">{t("network.invitations", { count: pending.data?.items.length ?? 0 })}</h2>
          {pending.data?.items.length ? (
            <ul className="divide-y">
              {pending.data.items.map((p) => (
                <PersonRow key={p.id} user={p.user} meta={t("network.sent", { time: timeAgo(p.createdAt) })}>
                  <Button variant="ghost" size="sm" onClick={() => remove.mutate(p.id)}>{t("network.ignore")}</Button>
                  <Button variant="outline" size="sm" onClick={() => accept.mutate(p.id)}>{t("network.accept")}</Button>
                </PersonRow>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">{t("network.noInvitations")}</p>
          )}
        </Card>
        <Card className="p-6">
          <h2 className="text-lg font-semibold">{t("network.connections", { count: connections.data?.items.length ?? 0 })}</h2>
          <ul className="divide-y">
            {connections.data?.items.map((c) => (
              <PersonRow key={c.id} user={c.user} meta={t("network.connected", { time: timeAgo(c.since) })}>
                <Button variant="ghost" size="sm" onClick={() => remove.mutate(c.id)}>{t("network.remove")}</Button>
              </PersonRow>
            ))}
          </ul>
          {connections.data?.items.length === 0 && <p className="mt-2 text-sm text-muted-foreground">{t("network.empty")}</p>}
        </Card>
      </div>
    </Page>
  );
}
