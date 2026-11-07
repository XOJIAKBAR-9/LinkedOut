import { type Comment, createCommentSchema, type Paginated, type PublicUser } from "@linkedout/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CornerDownRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CommentFocus } from "./PostCard";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { cn, fullName, timeAgo } from "@/lib/utils";
import { useAuth } from "@/stores/auth";

const commentsKey = (postId: string, parentId?: string) => ["comments", postId, parentId ?? "top"];

function useComments(postId: string, parentId?: string, enabled = true) {
  return useQuery({
    queryKey: commentsKey(postId, parentId),
    queryFn: () =>
      api.get<Paginated<Comment>>(`/posts/${postId}/comments?limit=50${parentId ? `&parentId=${parentId}` : ""}`),
    enabled,
  });
}

/** Text box for a new comment, or a reply when `parentId` is set. */
function CommentComposer({
  postId,
  parentId,
  replyingTo,
  autoFocus,
  onPosted,
  onCancel,
}: {
  postId: string;
  parentId?: string;
  replyingTo?: PublicUser;
  autoFocus?: boolean;
  onPosted?: (c: Comment) => void;
  onCancel?: () => void;
}) {
  const { t } = useTranslation();
  const user = useAuth((s) => s.user)!;
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) input.current?.focus();
  }, [autoFocus, replyingTo?.id]);

  const add = useMutation({
    mutationFn: (content: string) => api.post<{ comment: Comment }>(`/posts/${postId}/comments`, { content, parentId }),
    onSuccess: ({ comment }) => {
      setText("");
      // Refresh this thread, the top-level list (reply counts) and the post's comment count.
      void qc.invalidateQueries({ queryKey: ["comments", postId] });
      void qc.invalidateQueries({ queryKey: ["feed"] });
      void qc.invalidateQueries({ queryKey: ["post", postId] });
      onPosted?.(comment);
    },
  });

  const label = replyingTo ? t("post.replyLabel", { name: fullName(replyingTo) }) : t("post.addCommentLabel");

  return (
    <form
      className="space-y-1"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = createCommentSchema.safeParse({ content: text, parentId });
        if (parsed.success) add.mutate(parsed.data.content);
      }}
    >
      {replyingTo && (
        <p className="flex items-center gap-1 pl-10 text-xs text-muted-foreground">
          <CornerDownRight className="h-3 w-3" aria-hidden />
          {t("post.replyingTo", { name: fullName(replyingTo) })}
          {onCancel && (
            <button type="button" onClick={onCancel} className="ml-1 rounded hover:text-foreground" aria-label={t("common.cancel")}>
              <X className="h-3 w-3" />
            </button>
          )}
        </p>
      )}
      <div className="flex gap-2">
        <UserAvatar user={user} className="h-8 w-8" />
        <Input
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onCancel?.()}
          placeholder={replyingTo ? t("post.replyPlaceholder") : t("post.addComment")}
          aria-label={label}
          className="h-8"
        />
        <Button size="sm" type="submit" disabled={!text.trim() || add.isPending}>
          {replyingTo ? t("post.reply") : t("post.postComment")}
        </Button>
      </div>
    </form>
  );
}

function CommentBubble({ comment, onReply, small, focused }: { comment: Comment; onReply: () => void; small?: boolean; focused?: boolean }) {
  const { t } = useTranslation();
  const name = fullName(comment.author);
  const ref = useRef<HTMLDivElement>(null);
  const [highlight, setHighlight] = useState(Boolean(focused));

  // Opened from a notification: bring this comment into view and highlight it for a moment.
  useEffect(() => {
    if (!focused) return;
    ref.current?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    setHighlight(true);
    const timer = setTimeout(() => setHighlight(false), 4000);
    return () => clearTimeout(timer);
  }, [focused]);

  return (
    <div ref={ref} id={`comment-${comment.id}`} className="flex scroll-mt-24 gap-2" data-focused={focused || undefined}>
      <Link to={`/in/${comment.author.id}`} className="shrink-0">
        <UserAvatar user={comment.author} className={small ? "h-6 w-6 text-[10px]" : "h-8 w-8"} />
      </Link>
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "rounded-md bg-muted px-3 py-2 transition-shadow duration-700",
            highlight && "bg-accent ring-2 ring-primary",
          )}
        >
          <div className="flex items-baseline justify-between gap-2">
            <Link to={`/in/${comment.author.id}`} className="truncate text-sm font-semibold hover:underline">{name}</Link>
            <time dateTime={comment.createdAt} className="shrink-0 text-xs text-muted-foreground">{timeAgo(comment.createdAt)}</time>
          </div>
          {comment.author.headline && <p className="truncate text-xs text-muted-foreground">{comment.author.headline}</p>}
          <p className="mt-1 whitespace-pre-wrap text-sm">
            {comment.replyTo && comment.parentId && (
              <Link to={`/in/${comment.replyTo.id}`} className="mr-1 font-medium text-primary hover:underline">
                @{fullName(comment.replyTo)}
              </Link>
            )}
            {comment.content}
          </p>
        </div>
        <button
          type="button"
          onClick={onReply}
          className="ml-2 mt-0.5 text-xs font-medium text-muted-foreground hover:text-primary"
          aria-label={t("post.replyTo", { name })}
        >
          {t("post.reply")}
        </button>
      </div>
    </div>
  );
}

/** A top-level comment with its (lazy-loaded) replies and an inline reply box. */
function CommentThread({ postId, comment, focus }: { postId: string; comment: Comment; focus?: CommentFocus }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(focus?.threadId === comment.id);
  /** The comment being answered: the top-level one or a reply inside the thread. */
  const [replyTarget, setReplyTarget] = useState<Comment | null>(null);
  const replies = useComments(postId, comment.id, expanded && comment.replyCount > 0);

  const startReply = (target: Comment) => {
    setReplyTarget(target);
    setExpanded(true);
  };

  return (
    <li className="space-y-2">
      <CommentBubble comment={comment} onReply={() => startReply(comment)} focused={focus?.commentId === comment.id} />
      {(comment.replyCount > 0 || replyTarget) && (
        <div className="ml-10 space-y-2 border-l-2 border-muted pl-3">
          {comment.replyCount > 0 && (
            <button
              type="button"
              onClick={() => setExpanded((e) => !e)}
              className="text-xs font-semibold text-primary hover:underline"
              aria-expanded={expanded}
            >
              {expanded ? t("post.hideReplies") : t("post.viewReplies", { count: comment.replyCount })}
            </button>
          )}
          {expanded && !!replies.data?.items.length && (
            <ul className="space-y-2" aria-label={t("post.replies", { name: fullName(comment.author) })}>
              {replies.data.items.map((r) => (
                <li key={r.id}>
                  <CommentBubble comment={r} onReply={() => startReply(r)} small focused={focus?.commentId === r.id} />
                </li>
              ))}
            </ul>
          )}
          {replyTarget && (
            <CommentComposer
              postId={postId}
              parentId={replyTarget.id}
              replyingTo={replyTarget.author}
              autoFocus
              onPosted={() => setReplyTarget(null)}
              onCancel={() => setReplyTarget(null)}
            />
          )}
        </div>
      )}
    </li>
  );
}

export function Comments({ postId, focus }: { postId: string; focus?: CommentFocus }) {
  const { t } = useTranslation();
  const comments = useComments(postId);
  const missing =
    focus && comments.data && !focus.threadId && !comments.data.items.some((c) => c.id === focus.commentId);
  return (
    <div className="space-y-3 border-t px-4 py-3">
      <CommentComposer postId={postId} />
      <ul className={cn("space-y-3", !comments.data?.items.length && "hidden")}>
        {comments.data?.items.map((c) => <CommentThread key={c.id} postId={postId} comment={c} focus={focus} />)}
      </ul>
      {missing && <p className="text-sm text-muted-foreground">{t("post.commentGone")}</p>}
    </div>
  );
}
