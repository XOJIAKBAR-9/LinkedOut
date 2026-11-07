import {
  type Conversation,
  MESSAGE_EDIT_WINDOW_MS,
  type Message,
  type Paginated,
  STICKERS,
  type StickerId,
  type UnreadSummary,
  editMessageSchema,
  stickerUrl,
} from "@linkedout/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { Check, CheckCheck, MoreHorizontal, Pencil, Send, SmilePlus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { errorText } from "@/i18n";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { cn, formatDateTime } from "@/lib/utils";
import { useAuth } from "@/stores/auth";

export function otherParticipant(c: Conversation, meId: string) {
  return c.participants.find((p) => p.id !== meId) ?? c.participants[0]!;
}

export function useConversations() {
  return useQuery({ queryKey: ["conversations"], queryFn: () => api.get<{ items: Conversation[] }>("/conversations") });
}

/** Number of people with unread messages — the red badge on the Messaging tab. */
export function useUnreadMessages() {
  return useQuery({
    queryKey: ["messages-unread"],
    queryFn: () => api.get<UnreadSummary>("/conversations/unread"),
  });
}

/** One-line preview for the conversation list ("You: Sticker", "Message deleted", …). */
export function messagePreview(t: TFunction, m: Message, mine: boolean): string {
  const body = m.deletedAt ? t("messaging.deletedShort") : m.type === "STICKER" ? t("messaging.sticker") : m.content;
  return mine && !m.deletedAt ? t("messaging.you", { text: body }) : body;
}

const canEdit = (m: Message, now = Date.now()) =>
  m.type === "TEXT" && !m.deletedAt && now - new Date(m.createdAt).getTime() <= MESSAGE_EDIT_WINDOW_MS;

function StickerPicker({ onPick, disabled }: { onPick: (id: StickerId) => void; disabled?: boolean }) {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={t("messaging.stickerPicker")}>
          <SmilePlus />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-[296px] p-2">
        <DropdownMenuLabel>{t("messaging.stickers")}</DropdownMenuLabel>
        <div className="grid grid-cols-4 gap-1">
          {STICKERS.map((id) => (
            <DropdownMenuItem
              key={id}
              onSelect={() => onPick(id)}
              className="justify-center p-1"
              aria-label={t(`messaging.stickerNames.${id}`)}
              title={t(`messaging.stickerNames.${id}`)}
            >
              <img src={stickerUrl(id)} alt="" className="h-14 w-14 transition-transform hover:scale-110" />
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MessageBubble({
  m,
  mine,
  receipt,
  onEdit,
  onDelete,
}: {
  m: Message;
  mine: boolean;
  /** Shown under your most recent message only. */
  receipt?: "seen" | "sent";
  onEdit: (m: Message, content: string) => Promise<unknown>;
  onDelete: (m: Message) => void;
}) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(m.content);
  const [error, setError] = useState("");

  const save = async () => {
    const parsed = editMessageSchema.safeParse({ content: draft });
    if (!parsed.success) return;
    if (parsed.data.content === m.content) return setEditing(false);
    try {
      await onEdit(m, parsed.data.content);
      setEditing(false);
      setError("");
    } catch (e) {
      setError(errorText(e));
    }
  };

  const sticker = m.type === "STICKER" && !m.deletedAt && m.stickerId;
  const showMenu = mine && !m.deletedAt && !editing;

  return (
    <div className={cn("group flex flex-col", mine ? "items-end" : "items-start")} data-message-id={m.id}>
      <div className={cn("flex max-w-[85%] items-center gap-1", mine ? "flex-row-reverse" : "flex-row")}>
        {editing ? (
          <form
            className="flex w-72 max-w-full flex-col gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setDraft(m.content);
                  setEditing(false);
                  setError("");
                }
              }}
              aria-label={t("messaging.editLabel")}
              autoFocus
            />
            {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
            <div className="flex justify-end gap-1">
              <Button type="button" size="sm" variant="ghost" onClick={() => { setDraft(m.content); setEditing(false); setError(""); }}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" size="sm" disabled={!draft.trim()}>{t("common.save")}</Button>
            </div>
          </form>
        ) : sticker ? (
          <img
            src={stickerUrl(sticker)}
            alt={t(`messaging.stickerNames.${sticker as StickerId}`, { defaultValue: t("messaging.sticker") })}
            title={formatDateTime(m.createdAt)}
            className="h-28 w-28"
          />
        ) : (
          <p
            className={cn(
              "whitespace-pre-wrap break-words rounded-2xl px-3 py-2",
              m.deletedAt
                ? "border border-dashed italic text-muted-foreground"
                : mine
                  ? "rounded-br-sm bg-primary text-primary-foreground"
                  : "rounded-bl-sm bg-muted",
            )}
            title={formatDateTime(m.createdAt)}
          >
            {m.deletedAt ? t("messaging.deleted") : m.content}
            {m.editedAt && !m.deletedAt && (
              <span className={cn("ml-2 text-[10px] opacity-75")}>{t("messaging.edited")}</span>
            )}
          </p>
        )}
        {showMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 opacity-0 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
                aria-label={t("messaging.options")}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={mine ? "end" : "start"}>
              {canEdit(m) && (
                <DropdownMenuItem onSelect={() => { setDraft(m.content); setEditing(true); }}>
                  <Pencil /> {t("messaging.edit")}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={() => onDelete(m)} className="text-destructive focus:text-destructive">
                <Trash2 /> {t("messaging.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {receipt && (
        <span
          className={cn("mt-0.5 flex items-center gap-1 text-[11px]", receipt === "seen" ? "text-primary" : "text-muted-foreground")}
          data-testid="receipt"
        >
          {receipt === "seen" ? <CheckCheck className="h-3.5 w-3.5" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />}
          {receipt === "seen" ? t("messaging.seen") : t("messaging.sent")}
        </span>
      )}
    </div>
  );
}

/** Message list + composer for one conversation: stickers, edit/delete, Seen/Sent receipts, live typing. */
export function Thread({ conversationId, compact = false }: { conversationId: string; compact?: boolean }) {
  const { t } = useTranslation();
  const me = useAuth((s) => s.user)!;
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [otherTyping, setOtherTyping] = useState(false);
  const [toDelete, setToDelete] = useState<Message | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout>>();
  const base = `/conversations/${conversationId}/messages`;

  const conversations = useConversations();
  const conversation = conversations.data?.items.find((c) => c.id === conversationId);
  // Latest time anyone else in the conversation read it.
  const othersReadAt = conversation?.readReceipts
    .filter((r) => r.userId !== me.id && r.lastReadAt)
    .map((r) => new Date(r.lastReadAt!).getTime())
    .reduce((a, b) => Math.max(a, b), 0);

  const messages = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => api.get<Paginated<Message>>(`${base}?limit=50`),
    select: (d) => [...d.items].reverse(),
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["messages", conversationId] });
    void qc.invalidateQueries({ queryKey: ["conversations"] });
  };

  const send = useMutation({
    mutationFn: (body: { content: string } | { stickerId: StickerId }) => api.post<{ message: Message }>(base, body),
    onSuccess: (_r, body) => {
      if ("content" in body) setText("");
      refresh();
    },
  });

  const editMsg = useMutation({
    mutationFn: ({ m, content }: { m: Message; content: string }) => api.patch<{ message: Message }>(`${base}/${m.id}`, { content }),
    onSuccess: refresh,
  });

  const deleteMsg = useMutation({
    mutationFn: (m: Message) => api.delete<{ message: Message }>(`${base}/${m.id}`),
    onSuccess: () => {
      setToDelete(null);
      refresh();
    },
  });

  useEffect(() => {
    const socket = getSocket();
    let clear: ReturnType<typeof setTimeout>;
    const onTyping = (p: { conversationId: string; userId: string; isTyping: boolean }) => {
      if (p.conversationId !== conversationId || p.userId === me.id) return;
      setOtherTyping(p.isTyping);
      clearTimeout(clear);
      if (p.isTyping) clear = setTimeout(() => setOtherTyping(false), 5000);
    };
    socket.on("typing", onTyping);
    return () => {
      socket.off("typing", onTyping);
      clearTimeout(clear);
    };
  }, [conversationId, me.id]);

  useEffect(() => {
    bottom.current?.scrollIntoView?.({ block: "end" });
  }, [messages.data?.length, otherTyping]);

  // Loading the messages marks the conversation read on the server: refresh the badge and the list.
  useEffect(() => {
    if (!messages.dataUpdatedAt) return;
    void qc.invalidateQueries({ queryKey: ["messages-unread"] });
    void qc.invalidateQueries({ queryKey: ["conversations"] });
  }, [messages.dataUpdatedAt, qc]);

  const onChange = (value: string) => {
    setText(value);
    const socket = getSocket();
    if (!typingTimer.current) socket.emit("typing", { conversationId, isTyping: true });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socket.emit("typing", { conversationId, isTyping: false });
      typingTimer.current = undefined;
    }, 1500);
  };

  const list = messages.data ?? [];
  const lastMine = [...list].reverse().find((m) => m.senderId === me.id && !m.deletedAt);
  const lastMineSeen = Boolean(lastMine && othersReadAt && othersReadAt >= new Date(lastMine.createdAt).getTime());

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn("flex-1 space-y-2 overflow-y-auto p-3", compact ? "text-sm" : "")} aria-live="polite">
        {list.map((m) => (
          <MessageBubble
            key={m.id}
            m={m}
            mine={m.senderId === me.id}
            receipt={m.id === lastMine?.id ? (lastMineSeen ? "seen" : "sent") : undefined}
            onEdit={(msg, content) => editMsg.mutateAsync({ m: msg, content })}
            onDelete={setToDelete}
          />
        ))}
        {otherTyping && <p className="text-xs italic text-muted-foreground">{t("messaging.typing")}</p>}
        <div ref={bottom} />
      </div>
      <form
        className="flex items-center gap-1 border-t p-2"
        onSubmit={(e) => {
          e.preventDefault();
          const content = text.trim();
          if (content) send.mutate({ content });
        }}
      >
        <StickerPicker onPick={(stickerId) => send.mutate({ stickerId })} disabled={send.isPending} />
        <Input value={text} onChange={(e) => onChange(e.target.value)} placeholder={t("messaging.placeholder")} aria-label={t("messaging.messageLabel")} />
        <Button type="submit" size="icon" disabled={!text.trim() || send.isPending} aria-label={t("messaging.send")}>
          <Send />
        </Button>
      </form>

      <AlertDialog open={Boolean(toDelete)} onOpenChange={(o) => !o && !deleteMsg.isPending && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("messaging.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("messaging.deleteBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          {deleteMsg.isError && <p role="alert" className="text-sm text-destructive">{errorText(deleteMsg.error)}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMsg.isPending}>{t("common.cancel")}</AlertDialogCancel>
            <Button variant="destructive" disabled={deleteMsg.isPending} onClick={() => toDelete && deleteMsg.mutate(toDelete)}>
              {t("messaging.delete")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
