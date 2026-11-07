import { CheckCircle2, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { errorText } from "@/i18n";
import { api } from "@/lib/api";
import { useAuth } from "@/stores/auth";

const dismissKey = (userId: string) => `lo-verify-banner-dismissed:${userId}`;

/** "Resend email" button with its own sent/error state. */
export function ResendVerificationButton({ className }: { className?: string }) {
  const { t } = useTranslation();
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  return (
    <span className={className}>
      <Button
        size="sm"
        variant="link"
        className="h-auto p-0"
        disabled={state !== "idle"}
        onClick={async () => {
          setError("");
          setState("sending");
          try {
            await api.post("/auth/resend-verification");
            setState("sent");
          } catch (e) {
            setError(errorText(e));
            setState("idle");
          }
        }}
      >
        {state === "sent" ? t("verifyBanner.sent") : t("verifyBanner.resend")}
      </Button>
      {error && <span role="alert" className="ml-2 text-sm text-destructive">{error}</span>}
    </span>
  );
}

/** Reminder shown until the email is verified. Can be closed; stays closed for this account on this browser. */
export function VerifyBanner() {
  const { t } = useTranslation();
  const user = useAuth((s) => s.user);
  const [dismissed, setDismissed] = useState(() => (user ? localStorage.getItem(dismissKey(user.id)) === "1" : false));

  if (!user || user.emailVerified || dismissed) return null;

  return (
    <div className="border-b bg-accent text-accent-foreground" role="region" aria-label={t("verifyBanner.label")}>
      <div className="container flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm">
        <span className="flex-1">{t("verifyBanner.text")}</span>
        <ResendVerificationButton />
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => {
            localStorage.setItem(dismissKey(user.id), "1");
            setDismissed(true);
          }}
          aria-label={t("verifyBanner.dismiss")}
          title={t("verifyBanner.dismissHint")}
        >
          <X />
        </Button>
      </div>
    </div>
  );
}

/** Verification status for the Settings page (the place to resend after closing the banner). */
export function EmailVerificationStatus() {
  const { t } = useTranslation();
  const user = useAuth((s) => s.user);
  if (!user) return null;
  return user.emailVerified ? (
    <p className="flex items-center gap-1 text-sm text-primary">
      <CheckCircle2 className="h-4 w-4" aria-hidden /> {t("settings.emailVerified")}
    </p>
  ) : (
    <p className="flex flex-wrap items-center gap-x-2 text-sm">
      <span className="text-muted-foreground">{t("settings.emailNotVerified")}</span>
      <ResendVerificationButton />
    </p>
  );
}
