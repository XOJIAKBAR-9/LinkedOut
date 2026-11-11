import { type Paginated, type Post, REACTION_TYPES, type ReactionType } from "@linkedout/shared";
import { type InfiniteData, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, MoreHorizontal, Trash2, VenetianMask } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { UserAvatar } from "@/components/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { cn, fullName, timeAgo } from "@/lib/utils";
import { Comments } from "./Comments";
import { POST_TYPE_META } from "./postTypes";
import { REACTION_META } from "./reactions";
import { useTenure } from "./useTenure";

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

/** Optimistic reaction change: move one count from the old type to the new one. */
function withReaction(post: Post, next: ReactionType | null): Post {
  const counts = { ...post.reactionCounts };
  if (post.myReaction) counts[post.myReaction] = Math.max(0, counts[post.myReaction] - 1);
  if (next) counts[next] += 1;
  const delta = (next ? 1 : 0) - (post.myReaction ? 1 : 0);
  return { ...post, myReaction: next, reactionCounts: counts, reactionCount: post.reactionCount + delta };
}

function AuthorLine({ post }: { post: Post }) {
  const { t } = useTranslation();
  const time = (
    <Link to={`/posts/${post.id}`} className="hover:underline">
      <time dateTime={post.createdAt}>{timeAgo(post.createdAt)}</time>
    </Link>
  );

  if (!post.author) {
    return (
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-dashed border-muted-foreground/60 text-muted-foreground" aria-hidden>
          <VenetianMask className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="font-medium">{t("post.anonymous")}</p>
          <p className="text-sm text-muted-foreground">
            {t("post.anonymousHint")} · {time}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-start gap-3">
      <Link to={`/in/${post.author.id}`} className="shrink-0 rounded-full">
        <UserAvatar user={post.author} className="h-11 w-11" />
      </Link>
      <div className="min-w-0">
        <Link to={`/in/${post.author.id}`} className="font-medium hover:underline">
          {fullName(post.author)}
        </Link>
        {post.author.headline && <p className="line-clamp-2 text-sm text-muted-foreground">{post.author.headline}</p>}
        <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
          {time}
          {post.anonymous && post.isMine && (
            <span className="inline-flex items-center gap-1">
              · <VenetianMask className="h-3.5 w-3.5" aria-hidden /> {t("post.anonymousMine")}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

/** The structured "exit record": company, role, time served, reasons. */
function ExitRecord({ post }: { post: Post }) {
  const { t } = useTranslation();
  const tenure = useTenure(post.tenureMonths);
  if (post.type === "UPDATE" || !post.companyName) return null;
  const companyName = post.company?.name ?? post.companyName;
  const company = (
    <span className={cn(post.type === "QUIT" && "redline")}>{companyName}</span>
  );

  return (
    <dl className="mx-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 border-y border-dashed py-3 text-sm sm:mx-5">
      <dt className="label-mono pt-0.5 text-muted-foreground">{t("post.fields.company")}</dt>
      <dd className="font-mono">
        {post.company ? (
          <Link to={`/companies/${post.company.slug}`} className="hover:underline">{company}</Link>
        ) : (
          company
        )}
      </dd>
      {post.role && (
        <>
          <dt className="label-mono pt-0.5 text-muted-foreground">{t("post.fields.role")}</dt>
          <dd className="font-mono">{post.role}</dd>
        </>
      )}
      {tenure && (
        <>
          <dt className="label-mono pt-0.5 text-muted-foreground">{t("post.fields.served")}</dt>
          <dd className="font-mono">{tenure}</dd>
        </>
      )}
      {post.reasons.length > 0 && (
        <>
          <dt className="label-mono pt-1 text-muted-foreground">{t("post.fields.reasons")}</dt>
          <dd className="flex flex-wrap gap-1.5">
            {post.reasons.map((r) => (
              <Badge key={r} variant="highlight">{t(`reasons.${r}`)}</Badge>
            ))}
          </dd>
        </>
      )}
    </dl>
  );
}

function ReactionBar({ post, onReact }: { post: Post; onReact: (type: ReactionType | null) => void }) {
  const { t } = useTranslation();
  const [popped, setPopped] = useState<ReactionType | null>(null);
  return (
    <div role="group" aria-label={t("post.chooseReaction")} className="flex flex-wrap gap-1.5">
      {REACTION_TYPES.map((type) => {
        const meta = REACTION_META[type];
        const Icon = meta.icon;
        const active = post.myReaction === type;
        const count = post.reactionCounts[type];
        return (
          <button
            key={type}
            type="button"
            aria-pressed={active}
            onClick={() => {
              setPopped(type);
              onReact(active ? null : type);
            }}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors hover:border-foreground/40",
              active ? meta.activeClassName : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon
              key={popped === type ? `pop-${post.myReaction}` : "idle"}
              className={cn("h-4 w-4", active && "animate-pop", !active && meta.className)}
              aria-hidden
            />
            <span>{t(`reactions.${type}`)}</span>
            {count > 0 && <span className="font-mono text-xs tabular-nums">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function PostCard({ post, commentsOpen = false, focus }: { post: Post; commentsOpen?: boolean; focus?: CommentFocus }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [showComments, setShowComments] = useState(commentsOpen || Boolean(focus));
  const meta = POST_TYPE_META[post.type];
  const TypeIcon = meta.icon;
  // Freshly published posts slide in.
  const justPublished = post.isMine && Date.now() - new Date(post.createdAt).getTime() < 10_000;

  const react = useMutation({
    mutationFn: (type: ReactionType | null) =>
      type
        ? api.put<{ post: Post }>(`/posts/${post.id}/reaction`, { type })
        : api.delete<{ post: Post }>(`/posts/${post.id}/reaction`),
    onMutate: (type) => patchPost(qc, withReaction(post, type)),
    onSuccess: (res) => patchPost(qc, res.post),
    onError: () => patchPost(qc, post),
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/posts/${post.id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["feed"] });
      void qc.invalidateQueries({ queryKey: ["feed-insights"] });
      qc.removeQueries({ queryKey: ["post", post.id] });
      if (commentsOpen) navigate("/feed");
    },
  });

  const authorName = post.author ? fullName(post.author) : t("post.anonymous");

  return (
    <article
      aria-label={post.type === "UPDATE" ? t("post.byAuthor", { name: authorName }) : t("post.typedBy", { type: t(`postTypes.${post.type}.label`), name: authorName })}
      className={cn("overflow-hidden rounded-lg border bg-card", meta.card, justPublished && "animate-publish")}
    >
      <header className="flex items-start justify-between gap-3 p-4 pb-3 sm:px-5">
        <AuthorLine post={post} />
        {post.isMine && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="-mr-2 -mt-1 shrink-0" aria-label={t("post.options")}>
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => remove.mutate()} className="text-destructive focus:text-destructive">
                <Trash2 /> {t("post.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      {post.type !== "UPDATE" && (
        <div className="px-4 sm:px-5">
          <Badge variant={meta.stamp} tilt={post.type === "QUIT"}>
            <TypeIcon aria-hidden /> {t(`postTypes.${post.type}.stamp`)}
          </Badge>
          {post.headline && (
            <h3 className="mt-2 font-display text-2xl font-semibold italic leading-tight tracking-tight sm:text-[1.6rem]">
              {post.headline}
            </h3>
          )}
        </div>
      )}
      {post.type === "UPDATE" && post.headline && (
        <h3 className="px-4 font-display text-xl font-semibold sm:px-5">{post.headline}</h3>
      )}

      <p className="whitespace-pre-wrap px-4 pb-3 pt-2 sm:px-5">{post.content}</p>
      <ExitRecord post={post} />
      {post.imageUrl && <img src={post.imageUrl} alt="" loading="lazy" className="mt-3 max-h-[480px] w-full object-cover" />}

      <footer className="space-y-3 p-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ReactionBar post={post} onReact={(type) => react.mutate(type)} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowComments((s) => !s)}
            aria-expanded={showComments}
            className="text-muted-foreground"
          >
            <MessageCircle /> {post.commentCount > 0 ? t("post.comments", { count: post.commentCount }) : t("post.comment")}
          </Button>
        </div>
      </footer>
      {showComments && <Comments postId={post.id} focus={focus} />}
    </article>
  );
}
