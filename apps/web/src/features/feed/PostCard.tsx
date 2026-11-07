import { useTranslation } from "react-i18next";
import { type Paginated, type Post, REACTION_TYPES, type ReactionType } from "@linkedout/shared";
import { type InfiniteData, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, MoreHorizontal, ThumbsUp, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { cn, fullName, timeAgo } from "@/lib/utils";
import { useAuth } from "@/stores/auth";
import { Comments } from "./Comments";
import { REACTION_META } from "./reactions";

/** Replace one post in every cached feed page and on its single-post page. */
function patchPost(qc: ReturnType<typeof useQueryClient>, updated: Post) {
  qc.setQueriesData<InfiniteData<Paginated<Post>>>({ queryKey: ["feed"] }, (data) =>
    data && {
      ...data,
      pages: data.pages.map((p) => ({ ...p, items: p.items.map((x) => (x.id === updated.id ? updated : x)) })),
    },
  );
  qc.setQueryData<{ post: Post }>(["post", updated.id], (data) => data && { post: updated });
}

export interface CommentFocus {
  /** Comment or reply to scroll to and highlight. */
  commentId: string;
  /** Top-level comment to expand when the target is a reply. */
  threadId?: string | null;
}

export function PostCard({ post, commentsOpen = false, focus }: { post: Post; commentsOpen?: boolean; focus?: CommentFocus }) {
  const { t } = useTranslation();
  const me = useAuth((s) => s.user)!;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [showComments, setShowComments] = useState(commentsOpen || Boolean(focus));

  const react = useMutation({
    mutationFn: (type: ReactionType | null) =>
      type
        ? api.put<{ post: Post }>(`/posts/${post.id}/reaction`, { type })
        : api.delete<{ post: Post }>(`/posts/${post.id}/reaction`),
    onMutate: (type) => {
      // Optimistic update so the button responds instantly.
      const delta = (type ? 1 : 0) - (post.myReaction ? 1 : 0);
      patchPost(qc, { ...post, myReaction: type, reactionCount: post.reactionCount + delta });
    },
    onSuccess: (res) => patchPost(qc, res.post),
    onError: () => patchPost(qc, post),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/posts/${post.id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["feed"] });
      qc.removeQueries({ queryKey: ["post", post.id] });
      if (commentsOpen) navigate("/feed");
    },
  });

  const mine = post.myReaction ? REACTION_META[post.myReaction] : null;

  return (
    <Card className="overflow-hidden">
      <article aria-label={t("post.byAuthor", { name: fullName(post.author) })}>
        <header className="flex items-start gap-3 p-4 pb-2">
          <Link to={`/in/${post.author.id}`}><UserAvatar user={post.author} className="h-12 w-12" /></Link>
          <div className="min-w-0 flex-1">
            <Link to={`/in/${post.author.id}`} className="font-semibold hover:underline">{fullName(post.author)}</Link>
            {post.author.headline && <p className="truncate text-xs text-muted-foreground">{post.author.headline}</p>}
            <Link to={`/posts/${post.id}`} className="text-xs text-muted-foreground hover:underline">
              <time dateTime={post.createdAt}>{timeAgo(post.createdAt)}</time>
            </Link>
          </div>
          {post.author.id === me.id && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={t("post.options")}><MoreHorizontal /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => remove.mutate()} className="text-destructive"><Trash2 /> {t("post.delete")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </header>
        <p className="whitespace-pre-wrap px-4 pb-3 text-sm">{post.content}</p>
        {post.imageUrl && <img src={post.imageUrl} alt="" loading="lazy" className="max-h-[500px] w-full object-cover" />}
        <div className="flex justify-between px-4 py-2 text-xs text-muted-foreground">
          <span>{post.reactionCount > 0 && t("post.reactions", { count: post.reactionCount })}</span>
          <button className="hover:underline" onClick={() => setShowComments((s) => !s)}>
            {post.commentCount > 0 && t("post.comments", { count: post.commentCount })}
          </button>
        </div>
        <div className="flex border-t px-2 py-1">
          <div className="group relative flex-1">
            <Button
              variant="ghost"
              className={cn("w-full", mine?.className)}
              aria-pressed={!!post.myReaction}
              onClick={() => react.mutate(post.myReaction ? null : "LIKE")}
            >
              {mine ? <span aria-hidden>{mine.emoji}</span> : <ThumbsUp />}
              {t(`reactions.${post.myReaction ?? "LIKE"}`)}
            </Button>
            <div
              role="group"
              aria-label={t("post.chooseReaction")}
              className="invisible absolute -top-11 left-0 z-10 flex gap-1 rounded-full border bg-popover p-1 opacity-0 shadow-md transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
            >
              {REACTION_TYPES.map((type) => (
                <button
                  key={type}
                  className="rounded-full p-1 text-xl transition-transform hover:scale-125 focus-visible:scale-125 focus-visible:outline-none"
                  aria-label={t(`reactions.${type}`)}
                  title={t(`reactions.${type}`)}
                  onClick={() => react.mutate(type)}
                >
                  {REACTION_META[type].emoji}
                </button>
              ))}
            </div>
          </div>
          <Button variant="ghost" className="flex-1" onClick={() => setShowComments((s) => !s)} aria-expanded={showComments}>
            <MessageCircle /> {t("post.comment")}
          </Button>
        </div>
        {showComments && <Comments postId={post.id} focus={focus} />}
      </article>
    </Card>
  );
}
