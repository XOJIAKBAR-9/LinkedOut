import { useTranslation } from "react-i18next";
import { createPostSchema, type Post } from "@linkedout/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { errorText, translateMessage } from "@/i18n";
import { api } from "@/lib/api";
import { useAuth } from "@/stores/auth";

export function PostComposer() {
  const { t } = useTranslation();
  const user = useAuth((s) => s.user)!;
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => (image ? URL.createObjectURL(image) : null), [image]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const create = useMutation({
    mutationFn: () => {
      const form = new FormData();
      form.append("content", content);
      if (image) form.append("image", image);
      return api.post<{ post: Post }>("/posts", form);
    },
    onSuccess: () => {
      setContent("");
      setImage(null);
      void qc.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: (e) => setError(errorText(e)),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const parsed = createPostSchema.safeParse({ content });
    if (!parsed.success) return setError(translateMessage(parsed.error.issues[0]?.message) ?? t("validation.invalid"));
    create.mutate();
  };

  return (
    <Card>
      <CardContent className="pt-4">
        <form onSubmit={submit} className="space-y-3">
          <div className="flex gap-3">
            <UserAvatar user={user} />
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t("composer.placeholder")}
              aria-label={t("composer.label")}
              maxLength={3000}
              className="min-h-[60px] resize-none"
            />
          </div>
          {preview && (
            <div className="relative ml-[52px] w-fit">
              <img src={preview} alt={t("composer.attachment")} className="max-h-48 rounded-md" />
              <Button type="button" size="icon" variant="secondary" className="absolute right-1 top-1 h-7 w-7" onClick={() => setImage(null)} aria-label={t("composer.removeImage")}>
                <X />
              </Button>
            </div>
          )}
          {error && <p role="alert" className="ml-[52px] text-sm text-destructive">{error}</p>}
          <div className="flex items-center justify-between pl-[52px]">
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
            <Button type="button" variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
              <ImagePlus /> {t("composer.photo")}
            </Button>
            <Button type="submit" size="sm" disabled={create.isPending || !content.trim()}>
              {create.isPending ? t("composer.submitting") : t("composer.submit")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
