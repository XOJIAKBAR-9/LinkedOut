import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorText } from "@/i18n";
import { api } from "@/lib/api";
import { disconnectSocket } from "@/lib/socket";
import { useAuth } from "@/stores/auth";

type Step = "confirm" | "password";

export const ACCOUNT_DELETED_FLAG = "lo-account-deleted";

/**
 * Two steps: "Are you sure?" with what will be lost, then the password (or the account email for
 * GitHub-only accounts). Only then is the account permanently deleted.
 */
export function DeleteAccount() {
  const { t } = useTranslation();
  const { user, setUser } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("confirm");
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");

  const remove = useMutation({
    mutationFn: () => api.delete("/auth/account", user!.hasPassword ? { password: secret } : { email: secret }),
    onSuccess: () => {
      disconnectSocket();
      qc.clear();
      // The route guard redirects to /login as soon as the user is cleared (dropping router state),
      // so leave the confirmation message for the login page in sessionStorage.
      sessionStorage.setItem(ACCOUNT_DELETED_FLAG, "1");
      setUser(null);
      navigate("/login", { replace: true });
    },
    onError: (e) => setError(errorText(e)),
  });

  if (!user) return null;

  const reset = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setStep("confirm");
      setSecret("");
      setError("");
    }
  };

  const items = ["profile", "posts", "network", "messages", "notifications"] as const;

  return (
    <AlertDialog open={open} onOpenChange={(o) => !remove.isPending && reset(o)}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive"><Trash2 /> {t("settings.deleteButton")}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        {step === "confirm" ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden /> {t("settings.confirmTitle")}
              </AlertDialogTitle>
              <AlertDialogDescription>{t("settings.confirmBody")}</AlertDialogDescription>
            </AlertDialogHeader>
            <ul className="list-disc space-y-1 pl-6 text-sm">
              {items.map((k) => <li key={k}>{t(`settings.items.${k}`)}</li>)}
            </ul>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <Button variant="destructive" onClick={() => setStep("password")}>{t("settings.continue")}</Button>
            </AlertDialogFooter>
          </>
        ) : (
          <form
            className="grid gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              setError("");
              if (secret) remove.mutate();
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle>{t("settings.passwordTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {user.hasPassword
                  ? t("settings.passwordBody", { email: user.email })
                  : t("settings.emailBody", { email: user.email })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <Label htmlFor="delete-secret">{user.hasPassword ? t("auth.password") : t("settings.emailLabel")}</Label>
              <Input
                id="delete-secret"
                type={user.hasPassword ? "password" : "email"}
                autoComplete={user.hasPassword ? "current-password" : "off"}
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                aria-invalid={!!error}
                aria-describedby={error ? "delete-error" : undefined}
                autoFocus
              />
              {error && <p id="delete-error" role="alert" className="text-sm text-destructive">{error}</p>}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={remove.isPending}>{t("common.cancel")}</AlertDialogCancel>
              <Button type="submit" variant="destructive" disabled={!secret || remove.isPending}>
                {remove.isPending ? <><Loader2 className="animate-spin" /> {t("settings.deleting")}</> : t("settings.deleteForever")}
              </Button>
            </AlertDialogFooter>
          </form>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
