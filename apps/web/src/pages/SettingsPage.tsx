import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Page } from "@/components/Page";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Card } from "@/components/ui/card";
import { EmailVerificationStatus } from "@/features/auth/VerifyEmail";
import { DeleteAccount } from "@/features/settings/DeleteAccount";
import { useAuth } from "@/stores/auth";

export function SettingsPage() {
  const { t } = useTranslation();
  const user = useAuth((s) => s.user)!;
  return (
    <Page title={t("settings.title")}>
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
        <Card className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">{t("settings.account")}</h2>
          <p className="text-sm text-muted-foreground">{t("settings.signedInAs", { email: user.email })}</p>
          <EmailVerificationStatus />
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm">{t("settings.appearance")}</span>
            <div className="flex items-center gap-1">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </div>
        </Card>
        <Card className="space-y-3 border-destructive/50 p-6">
          <h2 className="text-lg font-semibold text-destructive">{t("settings.dangerZone")}</h2>
          <p className="text-sm text-muted-foreground">{t("settings.dangerText")}</p>
          <DeleteAccount />
        </Card>
      </div>
    </Page>
  );
}
