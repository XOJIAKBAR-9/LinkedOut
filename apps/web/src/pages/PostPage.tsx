import type { Post } from "@linkedout/shared";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Page } from "@/components/Page";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PostCard } from "@/features/feed/PostCard";
import { HttpError, api } from "@/lib/api";
import { errorText } from "@/i18n";
import { fullName } from "@/lib/utils";

/**
 * A single post with its comments open. Links from notifications add `?comment=<id>` (and `&thread=<id>`
 * for replies) so the exact comment is expanded, scrolled to and highlighted.
 */
export function PostPage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const commentId = params.get("comment");
  const focus = commentId ? { commentId, threadId: params.get("thread") } : undefined;

  const q = useQuery({ queryKey: ["post", id], queryFn: () => api.get<{ post: Post }>(`/posts/${id}`) });

  return (
    <Page title={q.data ? t("post.byAuthor", { name: fullName(q.data.post.author) }) : t("feed.pageTitle")}>
      <div className="mx-auto max-w-2xl space-y-4">
        <Link to="/feed" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden /> {t("post.back")}
        </Link>
        {q.isPending && <Skeleton className="h-48 w-full" />}
        {q.isError && (
          <Card className="p-8 text-center text-muted-foreground" role="alert">
            {q.error instanceof HttpError && q.error.status === 404 ? t("post.notFound") : errorText(q.error)}
          </Card>
        )}
        {q.data && <PostCard key={`${id}:${commentId ?? ""}`} post={q.data.post} commentsOpen focus={focus} />}
      </div>
    </Page>
  );
}
