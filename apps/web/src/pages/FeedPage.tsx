import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Page } from "@/components/Page";
import { UserAvatar } from "@/components/UserAvatar";
import { Card } from "@/components/ui/card";
import { PostComposer } from "@/features/feed/PostComposer";
import { PostList } from "@/features/feed/PostList";
import { fullName } from "@/lib/utils";
import { useAuth } from "@/stores/auth";

export function FeedPage() {
  const { t } = useTranslation();
  const user = useAuth((s) => s.user)!;
  return (
    <Page title={t("feed.pageTitle")}>
      <div className="grid gap-6 md:grid-cols-[240px_1fr] lg:grid-cols-[240px_1fr_260px]">
        <aside className="hidden md:block">
          <Card className="overflow-hidden text-center">
            <div className="h-14 bg-gradient-to-br from-teal-400 via-cyan-600 to-sky-800" />
            <div className="-mt-8 flex flex-col items-center px-4 pb-4">
              <UserAvatar user={user} className="h-16 w-16 border-2 border-card" />
              <Link to={`/in/${user.id}`} className="mt-2 font-semibold hover:underline">{fullName(user)}</Link>
              <p className="text-xs text-muted-foreground">{user.headline ?? t("feed.addHeadline")}</p>
            </div>
          </Card>
        </aside>
        <section className="space-y-4" aria-label={t("feed.label")}>
          <h1 className="sr-only">{t("feed.heading")}</h1>
          <PostComposer />
          <PostList queryKey={["home"]} path="/posts" empty={t("feed.empty")} />
        </section>
        <aside className="hidden lg:block">
          <Card className="p-4 text-sm">
            <h2 className="mb-2 font-semibold">{t("feed.newsTitle")}</h2>
            <p className="text-muted-foreground">{t("feed.newsTip")}</p>
          </Card>
        </aside>
      </div>
    </Page>
  );
}
