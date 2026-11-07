import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { Page } from "@/components/Page";
import { UserAvatar } from "@/components/UserAvatar";
import { Card } from "@/components/ui/card";
import { Thread, messagePreview, otherParticipant, useConversations } from "@/features/messaging/Thread";
import { cn, fullName, timeAgo } from "@/lib/utils";
import { useAuth } from "@/stores/auth";

export function MessagingPage() {
  const { t } = useTranslation();
  const me = useAuth((s) => s.user)!;
  const { id } = useParams();
  const navigate = useNavigate();
  const conversations = useConversations();
  const active = conversations.data?.items.find((c) => c.id === id);

  return (
    <Page title={t("messaging.title")}>
      <Card className="grid h-[calc(100vh-8rem)] overflow-hidden md:grid-cols-[320px_1fr]">
        <nav aria-label={t("messaging.conversations")} className={cn("overflow-y-auto border-r", id && "hidden md:block")}>
          <h1 className="border-b p-4 text-lg font-semibold">{t("messaging.title")}</h1>
          <ul>
            {conversations.data?.items.map((c) => {
              const other = otherParticipant(c, me.id);
              const unread = c.id !== id ? c.unreadCount : 0;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => navigate(`/messaging/${c.id}`)}
                    className={cn("flex w-full items-center gap-3 p-3 text-left hover:bg-muted", c.id === id && "bg-accent")}
                    aria-current={c.id === id ? "page" : undefined}
                  >
                    <UserAvatar user={other} />
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-2">
                        <span className={cn("truncate", unread ? "font-bold" : "font-medium")}>{fullName(other)}</span>
                        <span className={cn("shrink-0 text-xs", unread ? "font-semibold text-primary" : "text-muted-foreground")}>{timeAgo(c.updatedAt)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                      <p className={cn("flex-1 truncate text-sm", unread ? "font-medium text-foreground" : "text-muted-foreground")}>
                        {c.lastMessage ? messagePreview(t, c.lastMessage, c.lastMessage.senderId === me.id) : t("messaging.noMessages")}
                      </p>
                      {unread > 0 && (
                        <span
                          className="min-w-5 shrink-0 rounded-full bg-destructive px-1.5 text-center text-xs font-semibold leading-5 text-destructive-foreground"
                          aria-label={t("messaging.unread", { count: unread })}
                        >
                          {unread > 99 ? "99+" : unread}
                        </span>
                      )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
          {conversations.data?.items.length === 0 && <p className="p-4 text-sm text-muted-foreground">{t("messaging.empty")}</p>}
        </nav>
        <section className={cn("flex min-h-0 flex-col", !id && "hidden md:flex")} aria-label={t("messaging.conversation")}>
          {active ? (
            <>
              <header className="flex items-center gap-3 border-b p-3">
                <button className="md:hidden" onClick={() => navigate("/messaging")} aria-label={t("messaging.back")}>←</button>
                <UserAvatar user={otherParticipant(active, me.id)} className="h-8 w-8" />
                <h2 className="font-semibold">{fullName(otherParticipant(active, me.id))}</h2>
              </header>
              <div className="min-h-0 flex-1"><Thread key={active.id} conversationId={active.id} /></div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-muted-foreground">{t("messaging.select")}</div>
          )}
        </section>
      </Card>
    </Page>
  );
}
