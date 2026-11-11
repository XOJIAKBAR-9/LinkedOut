import { type FeedInsights, POST_TYPES } from "@linkedout/shared";
import { useQuery } from "@tanstack/react-query";
import { Ban, Flame, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { UserAvatar } from "@/components/UserAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { fullName } from "@/lib/utils";
import { useAuth } from "@/stores/auth";
import { useComposer } from "@/stores/composer";
import { POST_TYPE_META } from "./postTypes";

export function useFeedInsights() {
  return useQuery({ queryKey: ["feed-insights"], queryFn: () => api.get<FeedInsights>("/posts/insights"), staleTime: 60_000 });
}

const DAY = 24 * 3600 * 1000;

/** Left column: who you are, and how long you've been free. */
export function MyQuitCard() {
  const { t } = useTranslation();
  const user = useAuth((s) => s.user)!;
  const openWith = useComposer((s) => s.openWith);
  const insights = useFeedInsights();
  const me = insights.data?.me;
  const days = me?.lastQuitAt ? Math.max(0, Math.floor((Date.now() - new Date(me.lastQuitAt).getTime()) / DAY)) : null;

  return (
    <section aria-label={t("sidebar.you")} className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center gap-3 border-b p-4">
        <UserAvatar user={user} className="h-12 w-12" />
        <div className="min-w-0">
          <Link to={`/in/${user.id}`} className="font-medium hover:underline">{fullName(user)}</Link>
          <p className="line-clamp-2 text-sm text-muted-foreground">{user.headline ?? t("feed.addHeadline")}</p>
        </div>
      </div>
      <div className="p-4">
        {insights.isPending ? (
          <Skeleton className="h-20 w-full" />
        ) : days !== null ? (
          <>
            <p className="label-mono text-muted-foreground">{t("sidebar.daysSince")}</p>
            <p className="font-display text-5xl font-semibold leading-none tracking-tight tabular-nums" aria-describedby="days-since-label">
              {days}
            </p>
            <p id="days-since-label" className="mt-1 text-sm text-muted-foreground">
              {t("sidebar.daysSinceBody", { count: days, company: me?.lastQuitCompany ?? "" })}
            </p>
            {me && me.quitCount > 1 && (
              <p className="mt-2 font-mono text-xs text-muted-foreground">{t("sidebar.quitCount", { count: me.quitCount })}</p>
            )}
          </>
        ) : (
          <>
            <p className="font-display text-lg italic leading-snug">{t("sidebar.noQuitTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("sidebar.noQuitBody")}</p>
          </>
        )}
      </div>
      <nav aria-label={t("sidebar.shortcuts")} className="grid gap-1 border-t p-2">
        {POST_TYPES.filter((p) => p !== "UPDATE").map((type) => {
          const Icon = POST_TYPE_META[type].icon;
          return (
            <button
              key={type}
              type="button"
              onClick={() => openWith(type)}
              className="flex min-h-10 items-center gap-2 rounded-md px-2 text-left text-sm transition-colors hover:bg-muted"
            >
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              {t(`postTypes.${type}.cta`)}
            </button>
          );
        })}
      </nav>
    </section>
  );
}

/** Right column: what people are warning about this week. */
export function InsightsRail() {
  const { t } = useTranslation();
  const insights = useFeedInsights();
  const data = insights.data;

  return (
    <div className="space-y-4">
      <section aria-labelledby="most-warned" className="rounded-lg border bg-card p-4">
        <h2 id="most-warned" className="flex items-center gap-2 font-display text-lg font-semibold">
          <Ban className="h-4 w-4 text-warning" aria-hidden /> {t("sidebar.mostWarned")}
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">{t("sidebar.mostWarnedBody")}</p>
        {insights.isPending && <Skeleton className="h-24 w-full" />}
        {data && data.mostWarned.length === 0 && <p className="text-sm text-muted-foreground">{t("sidebar.mostWarnedEmpty")}</p>}
        <ol className="space-y-2">
          {data?.mostWarned.map((c, i) => {
            const max = data.mostWarned[0]!.count;
            const name = <span className="font-medium">{c.name}</span>;
            return (
              <li key={c.name} className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto] items-baseline gap-x-2">
                <span className="font-mono text-xs text-muted-foreground">{i + 1}</span>
                <span className="min-w-0">
                  {c.slug ? <Link to={`/companies/${c.slug}`} className="hover:underline">{name}</Link> : name}
                  <span className="mt-1 block h-1 rounded-full bg-muted" aria-hidden>
                    <span className="block h-1 rounded-full bg-highlight" style={{ width: `${Math.max(12, (c.count / max) * 100)}%` }} />
                  </span>
                </span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">{t("sidebar.warnings", { count: c.count })}</span>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="trending-reasons" className="rounded-lg border bg-card p-4">
        <h2 id="trending-reasons" className="flex items-center gap-2 font-display text-lg font-semibold">
          <TrendingUp className="h-4 w-4 text-primary" aria-hidden /> {t("sidebar.trending")}
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">{t("sidebar.trendingBody")}</p>
        {insights.isPending && <Skeleton className="h-16 w-full" />}
        {data && data.trendingReasons.length === 0 && <p className="text-sm text-muted-foreground">{t("sidebar.trendingEmpty")}</p>}
        <ul className="flex flex-wrap gap-1.5">
          {data?.trendingReasons.map((r, i) => (
            <li key={r.reason} className="inline-flex items-center gap-1.5 rounded-[3px] border px-2 py-1 text-sm">
              {i === 0 && <Flame className="h-3.5 w-3.5 text-primary" aria-hidden />}
              {t(`reasons.${r.reason}`)}
              <span className="font-mono text-xs text-muted-foreground">{r.count}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="px-1 text-xs text-muted-foreground">{t("sidebar.footer")}</p>
    </div>
  );
}
