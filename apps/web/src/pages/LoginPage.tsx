import { useTranslation } from "react-i18next";
import { zodResolver } from "@hookform/resolvers/zod";
import { type AuthUser, type LoginInput, loginSchema } from "@linkedout/shared";
import { useQuery } from "@tanstack/react-query";
import { Github } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { FormField } from "@/components/FormField";
import { Page } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthLayout } from "@/features/auth/AuthLayout";
import { ACCOUNT_DELETED_FLAG } from "@/features/settings/DeleteAccount";
import { errorText } from "@/i18n";
import { api } from "@/lib/api";
import { useAuth } from "@/stores/auth";

export function LoginPage() {
  const { t } = useTranslation();
  const setUser = useAuth((s) => s.setUser);
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const [serverError, setServerError] = useState(params.get("error") === "github" ? t("auth.login.githubFailed") : "");
  const providers = useQuery({ queryKey: ["providers"], queryFn: () => api.get<{ github: boolean }>("/auth/providers") });

  // One-time notice after deleting an account (set by DeleteAccount).
  const [accountDeleted] = useState(() => sessionStorage.getItem(ACCOUNT_DELETED_FLAG) === "1");
  useEffect(() => sessionStorage.removeItem(ACCOUNT_DELETED_FLAG), []);
  const { register, handleSubmit, formState } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setServerError("");
    try {
      const { user } = await api.post<{ user: AuthUser }>("/auth/login", values);
      setUser(user);
      navigate((location.state as { from?: string } | null)?.from ?? "/feed", { replace: true });
    } catch (err) {
      setServerError(errorText(err));
    }
  });

  return (
    <Page title={t("auth.login.pageTitle")}>
      <AuthLayout
        title={t("auth.login.title")}
        description={t("auth.login.subtitle")}
        footer={<>{t("auth.login.newHere")} <Link to="/register" className="font-medium text-primary hover:underline">{t("auth.login.joinNow")}</Link></>}
      >
        {accountDeleted && (
          <p role="status" className="mb-4 rounded-md bg-accent p-3 text-sm text-accent-foreground">{t("settings.deleted")}</p>
        )}
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormField id="email" label={t("auth.email")} error={formState.errors.email?.message}>
            <Input id="email" type="email" autoComplete="email" aria-invalid={!!formState.errors.email} {...register("email")} />
          </FormField>
          <FormField id="password" label={t("auth.password")} error={formState.errors.password?.message}>
            <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!formState.errors.password} {...register("password")} />
          </FormField>
          <div className="text-right text-sm">
            <Link to="/forgot-password" className="text-primary hover:underline">{t("auth.login.forgot")}</Link>
          </div>
          {serverError && <p role="alert" className="text-sm text-destructive">{serverError}</p>}
          <Button type="submit" className="w-full" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? t("auth.login.submitting") : t("auth.login.submit")}
          </Button>
          {providers.data?.github && (
            <Button variant="outline" className="w-full" asChild>
              <a href="/api/v1/auth/github"><Github /> {t("auth.login.github")}</a>
            </Button>
          )}
        </form>
      </AuthLayout>
    </Page>
  );
}
