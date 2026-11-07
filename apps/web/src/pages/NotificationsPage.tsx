import { useTranslation } from "react-i18next";
import type { AppNotification, Paginated } from "@linkedout/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Page } from "@/components/Page";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { cn, fullName, timeAgo } from "@/lib/utils";

/** Where a notification leads — the exact post / comment / reply, like LinkedIn. */
export function notificationLink(n: AppNotification): string {
  switch (n.type) {
    case "COMMENT":
    case "REPLY": {
      if (!n.postId) return "/feed";
      if (!n.commentId) return `/posts/${n.postId}`;
      const params = new URLSearchParams({ comment: n.commentId });
      if (n.threadId) params.set("thread", n.threadId);
      return `/posts/${n.postId}?${params}`;
    }
    case "REACTION":
      return n.postId ? `/posts/${n.postId}` : "/feed";
    case "CONNECTION_REQUEST":
      return "/network";
    case "CONNECTION_ACCEPTED":
      return n.actor ? `/in/${n.actor.id}` : "/network";
    case "MESSAGE":
      return "/messaging";
  }
}

export function NotificationsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<Paginated<AppNotification> & { unread: number }>("/notifications?limit=20"),
  });
  const markRead = useMutation({
    mutationFn: () => api.post("/notifications/read"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const open = (n: AppNotification) => {
    if (n.read) return;
    void api.post(`/notifications/${n.id}/read`).then(() => qc.invalidateQueries({ queryKey: ["notifications"] }));
  };

  return (
    <Page title={t("notifications.title")}>
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("notifications.title")}</h1>
          <Button variant="outline" size="sm" onClick={() => markRead.mutate()} disabled={!q.data?.unread}>{t("notifications.markAllRead")}</Button>
        </div>
        <Card>
          <ul className="divide-y">
            {q.data?.items.map((n) => (
              <li key={n.id}>
                <Link
                  to={notificationLink(n)}
                  onClick={() => open(n)}
                  className={cn(
                    "flex items-center gap-3 p-4 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                    !n.read && "bg-accent/50",
                  )}
                >
                  {n.actor && <UserAvatar user={n.actor} />}
                  <span className="flex-1 text-sm">
                    <span className="font-semibold">{n.actor ? fullName(n.actor) : t("notifications.someone")}</span> {t(`notifications.types.${n.type}`)}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</span>
                  {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label={t("notifications.unread")} />}
                </Link>
              </li>
            ))}
          </ul>
          {q.data?.items.length === 0 && <p className="p-8 text-center text-muted-foreground">{t("notifications.empty")}</p>}
        </Card>
      </div>
    </Page>
  );
}
