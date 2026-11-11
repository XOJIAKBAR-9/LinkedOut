import { MAX_REASONS, POST_TYPES, type Post, type PostType, QUIT_REASONS, type QuitReason, createPostSchema } from "@linkedout/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Send, VenetianMask, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { errorText, translateMessage } from "@/i18n";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/auth";
import { useComposer } from "@/stores/composer";
import { POST_TYPE_META } from "./postTypes";

type FieldErrors = Partial<Record<"content" | "companyName" | "reasons" | "headline", string>>;

function TypeChips({ value, onChange, labelledBy }: { value: PostType | null; onChange: (t: PostType) => void; labelledBy?: string }) {
  const { t } = useTranslation();
  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-wrap gap-1.5">
      {POST_TYPES.map((type) => {
        const meta = POST_TYPE_META[type];
        const Icon = meta.icon;
        return (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={value === type}
            data-active={value === type}
            onClick={() => onChange(type)}
            className={cn(
              "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border px-3 text-sm text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground",
              meta.chip,
            )}
          >
            <Icon className="h-4 w-4" aria-hidden /> {t(`postTypes.${type}.label`)}
          </button>
        );
      })}
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-sm text-destructive">
      {translateMessage(message)}
    </p>
  );
}

export function PostComposer() {
  const { t } = useTranslation();
  const user = useAuth((s) => s.user)!;
  const qc = useQueryClient();
  const { open, type, nonce, openWith, setType, close } = useComposer();
  const ids = { types: useId(), content: useId(), headline: useId(), company: useId(), role: useId(), years: useId(), months: useId(), anon: useId() };
  const rootRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [headline, setHeadline] = useState("");
  const [content, setContent] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [role, setRole] = useState("");
  const [years, setYears] = useState("");
  const [months, setMonths] = useState("");
  const [reasons, setReasons] = useState<QuitReason[]>([]);
  const [anonymous, setAnonymous] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState("");

  const preview = useMemo(() => (image ? URL.createObjectURL(image) : null), [image]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  // Opened from a sidebar / empty state: bring the composer into view and focus the text.
  useEffect(() => {
    if (!nonce) return;
    rootRef.current?.scrollIntoView?.({ block: "start", behavior: "smooth" });
    setTimeout(() => contentRef.current?.focus(), 50);
  }, [nonce]);

  const typed = type !== "UPDATE";
  const hasReasons = type === "QUIT" || type === "WARNING";
  const hasTenure = type === "QUIT" || type === "WARNING";

  const reset = () => {
    setHeadline("");
    setContent("");
    setCompanyName("");
    setRole("");
    setYears("");
    setMonths("");
    setReasons([]);
    setAnonymous(false);
    setImage(null);
    setErrors({});
    setServerError("");
    if (fileRef.current) fileRef.current.value = "";
    close();
  };

  const create = useMutation({
    mutationFn: (form: FormData) => api.post<{ post: Post }>("/posts", form),
    onSuccess: () => {
      reset();
      void qc.invalidateQueries({ queryKey: ["feed"] });
      void qc.invalidateQueries({ queryKey: ["feed-insights"] });
    },
    onError: (e) => setServerError(errorText(e)),
  });

  const tenureMonths = years || months ? Number(years || 0) * 12 + Number(months || 0) : undefined;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setServerError("");
    const input = { type, headline, content, companyName, role, tenureMonths, reasons, anonymous };
    const parsed = createPostSchema.safeParse(input);
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    const form = new FormData();
    form.append("type", type);
    form.append("content", content);
    if (headline.trim()) form.append("headline", headline);
    if (typed) {
      form.append("companyName", companyName);
      if (role.trim()) form.append("role", role);
      if (hasTenure && tenureMonths !== undefined) form.append("tenureMonths", String(tenureMonths));
      if (hasReasons && reasons.length) form.append("reasons", JSON.stringify(reasons));
      form.append("anonymous", String(anonymous));
    }
    if (image) form.append("image", image);
    create.mutate(form);
  };

  const toggleReason = (r: QuitReason) =>
    setReasons((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : cur.length >= MAX_REASONS ? cur : [...cur, r]));

  if (!open) {
    return (
      <section ref={rootRef} aria-labelledby={ids.types} className="rounded-lg border bg-card p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <UserAvatar user={user} className="h-11 w-11" />
          <button
            type="button"
            onClick={() => openWith("UPDATE")}
            className="min-h-11 flex-1 rounded-md border border-dashed border-input px-4 text-left text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
          >
            {t("composer.prompt")}
          </button>
        </div>
        <p id={ids.types} className="label-mono mb-2 mt-4 text-muted-foreground">{t("composer.or")}</p>
        <TypeChips value={null} onChange={openWith} labelledBy={ids.types} />
      </section>
    );
  }

  return (
    <section ref={rootRef} aria-labelledby={ids.types} className="animate-publish rounded-lg border border-foreground/20 bg-card p-4 sm:p-5">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <p id={ids.types} className="label-mono text-muted-foreground">{t("composer.typeLabel")}</p>
            <TypeChips value={type} onChange={setType} labelledBy={ids.types} />
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={reset} aria-label={t("composer.discard")}>
            <X />
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">{t(`postTypes.${type}.hint`)}</p>

        {typed && (
          <div className="space-y-1.5">
            <Label htmlFor={ids.headline}>{t("composer.headline")}</Label>
            <Input
              id={ids.headline}
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder={t(`postTypes.${type}.headlinePlaceholder`)}
              maxLength={140}
              className="font-display text-lg italic"
            />
          </div>
        )}

        {typed && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor={ids.company}>{t("post.fields.company")} *</Label>
              <Input
                id={ids.company}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                aria-invalid={!!errors.companyName}
                aria-describedby={errors.companyName ? `${ids.company}-err` : undefined}
                maxLength={100}
                autoComplete="organization"
              />
              <FieldError id={`${ids.company}-err`} message={errors.companyName} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={ids.role}>{t("post.fields.role")}</Label>
              <Input id={ids.role} value={role} onChange={(e) => setRole(e.target.value)} maxLength={100} autoComplete="organization-title" />
            </div>
          </div>
        )}

        {hasTenure && (
          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">{t("post.fields.served")}</legend>
            <div className="flex flex-wrap items-center gap-2">
              <Input id={ids.years} type="number" inputMode="numeric" min={0} max={50} value={years} onChange={(e) => setYears(e.target.value)} className="w-20" />
              <label htmlFor={ids.years} className="text-sm text-muted-foreground">{t("composer.years")}</label>
              <Input id={ids.months} type="number" inputMode="numeric" min={0} max={11} value={months} onChange={(e) => setMonths(e.target.value)} className="w-20" />
              <label htmlFor={ids.months} className="text-sm text-muted-foreground">{t("composer.months")}</label>
            </div>
          </fieldset>
        )}

        {hasReasons && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              {t("post.fields.reasons")} <span className="font-normal text-muted-foreground">· {t("composer.reasonsHint", { count: MAX_REASONS })}</span>
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {QUIT_REASONS.map((r) => {
                const on = reasons.includes(r);
                return (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={on}
                    disabled={!on && reasons.length >= MAX_REASONS}
                    onClick={() => toggleReason(r)}
                    className={cn(
                      "min-h-8 rounded-[3px] border px-2.5 text-sm transition-colors disabled:opacity-40",
                      on ? "border-highlight bg-highlight text-highlight-foreground" : "border-border hover:border-foreground/40",
                    )}
                  >
                    {t(`reasons.${r}`)}
                  </button>
                );
              })}
            </div>
          </fieldset>
        )}

        <div className="space-y-1.5">
          <Label htmlFor={ids.content}>{typed ? t("composer.story") : t("composer.label")}</Label>
          <Textarea
            ref={contentRef}
            id={ids.content}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t(`postTypes.${type}.placeholder`)}
            maxLength={3000}
            rows={typed ? 5 : 3}
            aria-invalid={!!errors.content}
            aria-describedby={errors.content ? `${ids.content}-err` : undefined}
          />
          <FieldError id={`${ids.content}-err`} message={errors.content} />
        </div>

        {preview && (
          <div className="relative w-fit">
            <img src={preview} alt={t("composer.attachment")} className="max-h-48 rounded-md" />
            <Button type="button" size="icon" variant="secondary" className="absolute right-1 top-1 h-8 w-8" onClick={() => { setImage(null); if (fileRef.current) fileRef.current.value = ""; }} aria-label={t("composer.removeImage")}>
              <X />
            </Button>
          </div>
        )}

        {typed && (
          <label htmlFor={ids.anon} className={cn("flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors", anonymous ? "border-foreground/40 bg-muted" : "border-dashed")}>
            <input id={ids.anon} type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]" />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 font-medium"><VenetianMask className="h-4 w-4" aria-hidden /> {t("composer.anonymous")}</span>
              <span className="block text-sm text-muted-foreground">{t("composer.anonymousHint")}</span>
            </span>
          </label>
        )}

        {serverError && <p role="alert" className="text-sm text-destructive">{serverError}</p>}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
          <Button type="button" variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
            <ImagePlus /> {t("composer.photo")}
          </Button>
          <Button type="submit" disabled={create.isPending}>
            <Send /> {create.isPending ? t("composer.submitting") : t(`postTypes.${type}.submit`)}
          </Button>
        </div>
      </form>
    </section>
  );
}
