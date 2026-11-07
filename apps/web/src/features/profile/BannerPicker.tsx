import { useTranslation } from "react-i18next";
import { type AuthUser, BANNER_PRESETS, bannerPresetUrl } from "@linkedout/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ImageOff, Palette, Upload } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuth } from "@/stores/auth";

/** Lets the owner pick a suggested background, upload their own, or remove it. */
export function BannerPicker({ current }: { current: string | null }) {
  const { t } = useTranslation();
  const setUser = useAuth((s) => s.setUser);
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const onSaved = ({ user }: { user: AuthUser }) => {
    setUser(user);
    void qc.invalidateQueries({ queryKey: ["profile", user.id] });
  };

  const setPreset = useMutation({
    mutationFn: (bannerUrl: string | null) => api.patch<{ user: AuthUser }>("/users/me", { bannerUrl }),
    onSuccess: onSaved,
  });

  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("image", file);
      return api.post<{ user: AuthUser }>("/users/me/banner", form);
    },
    onSuccess: onSaved,
  });

  const busy = setPreset.isPending || upload.isPending;

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload.mutate(file);
          e.target.value = "";
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="secondary" className="absolute right-3 top-3 shadow-md" disabled={busy}>
            <Palette /> {busy ? t("banner.saving") : t("banner.edit")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[340px] p-2">
          <DropdownMenuLabel>{t("banner.suggested")}</DropdownMenuLabel>
          <div className="grid grid-cols-2 gap-2 p-1">
            {BANNER_PRESETS.map((b) => {
              const url = bannerPresetUrl(b.id);
              const selected = current === url;
              const name = t(`banner.presets.${b.id}`);
              return (
                <DropdownMenuItem
                  key={b.id}
                  onSelect={() => setPreset.mutate(url)}
                  className={cn(
                    "relative flex-col items-stretch gap-1 p-1",
                    selected && "ring-2 ring-primary",
                  )}
                  aria-label={selected ? t("banner.optionCurrent", { name }) : t("banner.option", { name })}
                >
                  <img src={url} alt="" className="h-14 w-full rounded object-cover" />
                  <span className="text-xs">{name}</span>
                  {selected && (
                    <span className="absolute right-2 top-2 rounded-full bg-primary p-0.5 text-primary-foreground">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </DropdownMenuItem>
              );
            })}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => fileRef.current?.click()}>
            <Upload /> {t("banner.upload")}
          </DropdownMenuItem>
          {current && (
            <DropdownMenuItem onSelect={() => setPreset.mutate(null)}>
              <ImageOff /> {t("banner.remove")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
