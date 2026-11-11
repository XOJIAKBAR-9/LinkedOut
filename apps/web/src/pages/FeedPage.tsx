import { useTranslation } from "react-i18next";
import { Page } from "@/components/Page";
import { InsightsRail, MyQuitCard } from "@/features/feed/FeedSidebars";
import { PostComposer } from "@/features/feed/PostComposer";
import { PostList } from "@/features/feed/PostList";

/**
 * Mobile: one column (composer, feed).
 * md: feed + right rail. lg: profile card | feed | right rail (sticky sidebars).
 */
export function FeedPage() {
  const { t } = useTranslation();
  return (
    <Page title={t("feed.pageTitle")}>
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_280px] lg:grid-cols-[250px_minmax(0,1fr)_290px]">
        <aside className="hidden lg:block" aria-label={t("sidebar.you")}>
          <div className="sticky top-20">
            <MyQuitCard />
          </div>
        </aside>
        <section className="min-w-0 space-y-4" aria-label={t("feed.label")}>
          <h1 className="sr-only">{t("feed.heading")}</h1>
          <PostComposer />
          {/* Phones: the rails collapse into one expandable section instead of pushing the feed down. */}
          <details className="group rounded-lg border bg-card md:hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 font-medium">
              {t("sidebar.thisWeek")}
              <span className="label-mono text-muted-foreground group-open:hidden">{t("sidebar.show")}</span>
              <span className="label-mono hidden text-muted-foreground group-open:inline">{t("sidebar.hide")}</span>
            </summary>
            <div className="border-t p-3">
              <InsightsRail />
            </div>
          </details>
          <PostList queryKey={["home"]} path="/posts" empty={t("feed.empty")} />
        </section>
        <aside className="hidden md:block" aria-label={t("sidebar.insights")}>
          <div className="sticky top-20">
            <InsightsRail />
          </div>
        </aside>
      </div>
    </Page>
  );
}
