import { useTranslation } from "react-i18next";
import type { Paginated, Post } from "@linkedout/shared";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { DoorOpen } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useComposer } from "@/stores/composer";
import { Skeleton } from "@/components/ui/skeleton";
import { errorText } from "@/i18n";
import { api } from "@/lib/api";
import { PostCard } from "./PostCard";

/** Infinite list of posts from any paginated endpoint; loads more when the sentinel scrolls into view. */
export function PostList({ queryKey, path, empty }: { queryKey: unknown[]; path: string; empty: string }) {
  const { t } = useTranslation();
  const openWith = useComposer((s) => s.openWith);
  const q = useInfiniteQuery({
    queryKey: ["feed", ...queryKey],
    queryFn: ({ pageParam }) =>
      api.get<Paginated<Post>>(`${path}${path.includes("?") ? "&" : "?"}limit=10${pageParam ? `&cursor=${pageParam}` : ""}`),
    initialPageParam: "",
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting && q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
    }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [q]);

  if (q.isPending) {
    return (
      <div className="space-y-4" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <Card key={i} className="space-y-3 p-4">
            <div className="flex gap-3"><Skeleton className="h-12 w-12 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/3" /><Skeleton className="h-3 w-1/2" /></div></div>
            <Skeleton className="h-16 w-full" />
          </Card>
        ))}
      </div>
    );
  }
  if (q.isError) return <p role="alert" className="text-destructive">{errorText(q.error)}</p>;

  const posts = q.data.pages.flatMap((p) => p.items);
  if (posts.length === 0)
    return <EmptyState icon={DoorOpen} title={empty} action={<Button onClick={() => openWith("QUIT")}>{t("feed.endCta")}</Button>} />;

  return (
    <div className="space-y-4">
      {posts.map((p) => <PostCard key={p.id} post={p} />)}
      <div ref={sentinel} />
      {q.isFetchingNextPage && <p className="text-center text-sm text-muted-foreground">{t("post.loadingMore")}</p>}
      {!q.hasNextPage && (
        <EmptyState
          icon={DoorOpen}
          title={t("feed.endTitle")}
          body={t("feed.endBody")}
          action={
            <Button variant="outline" onClick={() => openWith("QUIT")}>
              {t("feed.endCta")}
            </Button>
          }
        />
      )}
    </div>
  );
}
