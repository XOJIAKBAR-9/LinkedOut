import { useTranslation } from "react-i18next";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, passwordSchema, type ForgotPasswordInput } from "@linkedout/shared";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { FormField } from "@/components/FormField";
import { Page } from "@/components/Page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthLayout } from "@/features/auth/AuthLayout";
import { errorText } from "@/i18n";
import { api } from "@/lib/api";

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });
  const onSubmit = handleSubmit(async (v) => {
    await api.post("/auth/forgot-password", v);
    setSent(true);
  });
  return (
    <Page title={t("auth.forgot.pageTitle")}>
      <AuthLayout title={t("auth.forgot.title")} description={t("auth.forgot.subtitle")} footer={<Link to="/login" className="text-primary hover:underline">{t("auth.forgot.back")}</Link>}>
        {sent ? (
          <p role="status">{t("auth.forgot.sent")}</p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <FormField id="email" label={t("auth.email")} error={formState.errors.email?.message}>
              <Input id="email" type="email" autoComplete="email" {...register("email")} />
            </FormField>
            <Button type="submit" className="w-full" disabled={formState.isSubmitting}>{t("auth.forgot.submit")}</Button>
          </form>
        )}
      </AuthLayout>
    </Page>
  );
}

const resetForm = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "validation.passwordMismatch" });

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [done, setDone] = useState(false);
  const [serverError, setServerError] = useState("");
  const { register, handleSubmit, formState } = useForm<z.infer<typeof resetForm>>({ resolver: zodResolver(resetForm) });
  const onSubmit = handleSubmit(async ({ password }) => {
    try {
      await api.post("/auth/reset-password", { token, password });
      setDone(true);
    } catch (e) {
      setServerError(errorText(e));
    }
  });
  return (
    <Page title={t("auth.reset.pageTitle")}>
      <AuthLayout title={t("auth.reset.title")}>
        {done ? (
          <p role="status">
            {t("auth.reset.done")} <Link to="/login" className="text-primary hover:underline">{t("auth.reset.signIn")}</Link>
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <FormField id="password" label={t("auth.reset.newPassword")} error={formState.errors.password?.message}>
              <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
            </FormField>
            <FormField id="confirm" label={t("auth.reset.confirm")} error={formState.errors.confirm?.message}>
              <Input id="confirm" type="password" autoComplete="new-password" {...register("confirm")} />
            </FormField>
            {serverError && <p role="alert" className="text-sm text-destructive">{serverError}</p>}
            <Button type="submit" className="w-full" disabled={formState.isSubmitting || !token}>{t("auth.reset.submit")}</Button>
          </form>
        )}
      </AuthLayout>
    </Page>
  );
}

export function VerifyEmailPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const [state, setState] = useState<"pending" | "ok" | "error">("pending");
  const [message, setMessage] = useState("");
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return; // tokens are single-use; avoid StrictMode double call
    ran.current = true;
    api
      .post("/auth/verify-email", { token: params.get("token") ?? "" })
      .then(() => setState("ok"))
      .catch((e) => {
        setState("error");
        setMessage(errorText(e));
      });
  }, [params]);
  return (
    <Page title={t("auth.verify.pageTitle")}>
      <AuthLayout title={t("auth.verify.title")}>
        {state === "pending" && <p>{t("auth.verify.pending")}</p>}
        {state === "ok" && <p role="status">{t("auth.verify.ok")} <Link to="/feed" className="text-primary hover:underline">{t("auth.verify.goToFeed")}</Link></p>}
        {state === "error" && <p role="alert" className="text-destructive">{message}</p>}
      </AuthLayout>
    </Page>
  );
}
