import { useTranslation } from "react-i18next";
import type { PublicUser } from "@linkedout/shared";
import { useQuery } from "@tanstack/react-query";
import { Building2 } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { Page } from "@/components/Page";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { cn, fullName, timeAgo } from "@/lib/utils";

type Tab = "all" | "people" | "posts" | "companies";
interface Results {
  people: PublicUser[];
  posts: { id: string; content: string; createdAt: string; author: PublicUser }[];
  companies: { id: string; name: string; slug: string; industry: string | null }[];
}

export function SearchPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const type = (params.get("type") as Tab) ?? "all";
  const results = useQuery({
    queryKey: ["search", q, type],
    queryFn: () => api.get<Results>(`/search?q=${encodeURIComponent(q)}&type=${type}`),
    enabled: q.trim().length > 0,
  });
  const set = (next: Partial<{ q: string; type: Tab }>) => setParams({ q, type, ...next });
  const r = results.data;
  const none = r && !r.people.length && !r.posts.length && !r.companies.length;

  return (
    <Page title={q ? t("search.titleWithQuery", { query: q }) : t("search.title")}>
      <div className="mx-auto max-w-3xl space-y-4">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            set({ q: String(new FormData(e.currentTarget).get("q") ?? "") });
          }}
        >
          <Input name="q" defaultValue={q} key={q} placeholder={t("search.placeholder")} aria-label={t("search.queryLabel")} />
        </form>
        <div className="flex gap-2" role="tablist" aria-label={t("search.resultType")}>
          {(["all", "people", "posts", "companies"] as Tab[]).map((tab) => (
            <Button key={tab} role="tab" aria-selected={type === tab} size="sm" variant={type === tab ? "default" : "outline"} onClick={() => set({ type: tab })}>
              {t(`search.tabs.${tab}`)}
            </Button>
          ))}
        </div>
        {!q && <p className="text-muted-foreground">{t("search.hint")}</p>}
        {none && <p className="text-muted-foreground">{t("search.noResults", { query: q })}</p>}
        {!!r?.people.length && (
          <Card className="p-4">
            <h2 className="mb-2 font-semibold">{t("search.tabs.people")}</h2>
            <ul className="divide-y">
              {r.people.map((u) => (
                <li key={u.id} className="flex items-center gap-3 py-2">
                  <UserAvatar user={u} />
                  <div>
                    <Link to={`/in/${u.id}`} className="font-medium hover:underline">{fullName(u)}</Link>
                    <p className="text-sm text-muted-foreground">{u.headline}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {!!r?.companies.length && (
          <Card className="p-4">
            <h2 className="mb-2 font-semibold">{t("search.tabs.companies")}</h2>
            <ul className="divide-y">
              {r.companies.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-2">
                  <Building2 className="h-8 w-8 text-muted-foreground" aria-hidden />
                  <div><p className="font-medium">{c.name}</p><p className="text-sm text-muted-foreground">{c.industry}</p></div>
                </li>
              ))}
            </ul>
          </Card>
        )}
        {!!r?.posts.length && (
          <Card className="p-4">
            <h2 className="mb-2 font-semibold">{t("search.tabs.posts")}</h2>
            <ul className="divide-y">
              {r.posts.map((p) => (
                <li key={p.id} className="py-3">
                  <p className="text-sm"><Link to={`/in/${p.author.id}`} className="font-medium hover:underline">{fullName(p.author)}</Link> · <span className="text-muted-foreground">{timeAgo(p.createdAt)}</span></p>
                  <p className="line-clamp-3 whitespace-pre-wrap text-sm">{p.content}</p>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </Page>
  );
}
