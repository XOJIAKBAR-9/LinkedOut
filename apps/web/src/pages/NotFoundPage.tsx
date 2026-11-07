import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Page } from "@/components/Page";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <Page title={t("notFound.pageTitle")}>
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-3xl font-bold">{t("notFound.title")}</h1>
        <p className="text-muted-foreground">{t("notFound.body")}</p>
        <Button asChild><Link to="/feed">{t("notFound.cta")}</Link></Button>
      </div>
    </Page>
  );
}
