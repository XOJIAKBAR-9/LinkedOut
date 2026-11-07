import { useTranslation } from "react-i18next";
import { zodResolver } from "@hookform/resolvers/zod";
import { type AuthUser, type RegisterInput, registerSchema } from "@linkedout/shared";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { FormField } from "@/components/FormField";
import { Page } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthLayout } from "@/features/auth/AuthLayout";
import { errorText } from "@/i18n";
import { api } from "@/lib/api";
import { useAuth } from "@/stores/auth";

export function RegisterPage() {
  const { t } = useTranslation();
  const setUser = useAuth((s) => s.setUser);
  const navigate = useNavigate();
  const [serverError, setServerError] = useState("");
  const { register, handleSubmit, formState } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });
  const err = formState.errors;

  const onSubmit = handleSubmit(async (values) => {
    setServerError("");
    try {
      const { user } = await api.post<{ user: AuthUser }>("/auth/register", values);
      setUser(user);
      navigate("/feed", { replace: true });
    } catch (e) {
      setServerError(errorText(e));
    }
  });

  return (
    <Page title={t("auth.register.pageTitle")}>
      <AuthLayout
        title={t("auth.register.title")}
        description={t("auth.register.subtitle")}
        footer={<>{t("auth.register.haveAccount")} <Link to="/login" className="font-medium text-primary hover:underline">{t("auth.register.signIn")}</Link></>}
      >
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-3">
            <FormField id="firstName" label={t("auth.register.firstName")} error={err.firstName?.message}>
              <Input id="firstName" autoComplete="given-name" aria-invalid={!!err.firstName} {...register("firstName")} />
            </FormField>
            <FormField id="lastName" label={t("auth.register.lastName")} error={err.lastName?.message}>
              <Input id="lastName" autoComplete="family-name" aria-invalid={!!err.lastName} {...register("lastName")} />
            </FormField>
          </div>
          <FormField id="email" label={t("auth.email")} error={err.email?.message}>
            <Input id="email" type="email" autoComplete="email" aria-invalid={!!err.email} {...register("email")} />
          </FormField>
          <FormField id="password" label={t("auth.register.passwordHint")} error={err.password?.message}>
            <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!err.password} {...register("password")} />
          </FormField>
          {serverError && <p role="alert" className="text-sm text-destructive">{serverError}</p>}
          <Button type="submit" className="w-full" disabled={formState.isSubmitting}>
            {formState.isSubmitting ? t("auth.register.submitting") : t("auth.register.submit")}
          </Button>
        </form>
      </AuthLayout>
    </Page>
  );
}
