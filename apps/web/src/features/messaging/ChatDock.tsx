import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { fullName } from "@/lib/utils";
import { useAuth } from "@/stores/auth";
import { useChatDock } from "@/stores/chatDock";
import { Thread, otherParticipant, useConversations } from "./Thread";

/** Floating chat windows, opened from profiles ("Message"). Hidden on the full Messaging page. */
export function ChatDock() {
  const { t } = useTranslation();
  const me = useAuth((s) => s.user)!;
  const { open, minimized, closeChat, toggleMinimize } = useChatDock();
  const conversations = useConversations();
  const { pathname } = useLocation();
  if (pathname.startsWith("/messaging") || open.length === 0) return null;

  return (
    <div className="fixed bottom-0 right-4 z-30 hidden items-end gap-3 sm:flex">
      {open.map((id) => {
        const c = conversations.data?.items.find((x) => x.id === id);
        const other = c ? otherParticipant(c, me.id) : null;
        const min = minimized[id];
        return (
          <section key={id} className="flex w-72 flex-col rounded-t-lg border bg-card shadow-lg" aria-label={other ? t("messaging.chatWith", { name: fullName(other) }) : t("messaging.chat")}>
            <header className="flex items-center gap-2 border-b px-3 py-2">
              {other && <UserAvatar user={other} className="h-7 w-7" />}
              <span className="flex-1 truncate text-sm font-semibold">{other ? fullName(other) : t("common.loading")}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleMinimize(id)} aria-label={min ? t("messaging.expand") : t("messaging.minimize")}>
                {min ? <ChevronUp /> : <ChevronDown />}
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => closeChat(id)} aria-label={t("messaging.close")}>
                <X />
              </Button>
            </header>
            {!min && <div className="h-80"><Thread conversationId={id} compact /></div>}
          </section>
        );
      })}
    </div>
  );
}
