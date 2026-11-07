import { useTranslation } from "react-i18next";
import { zodResolver } from "@hookform/resolvers/zod";
import { type AuthUser, type Conversation, type UpdateProfileInput, updateProfileSchema, type UserProfile } from "@linkedout/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, MapPin, MessageSquare, Pencil, UserPlus } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useParams } from "react-router-dom";
import { FormField } from "@/components/FormField";
import { Page } from "@/components/Page";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { PostList } from "@/features/feed/PostList";
import { BannerPicker } from "@/features/profile/BannerPicker";
import { errorText } from "@/i18n";
import { api } from "@/lib/api";
import { formatMonthYear, fullName } from "@/lib/utils";
import { useAuth } from "@/stores/auth";
import { useChatDock } from "@/stores/chatDock";

interface ExperienceItem {
  id: string;
  title: string;
  companyName: string;
  startDate: string;
  endDate: string | null;
  description: string | null;
}


export function ProfilePage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  const me = useAuth((s) => s.user)!;
  const isMe = id === me.id;
  const [editing, setEditing] = useState(false);

  const profile = useQuery({ queryKey: ["profile", id], queryFn: () => api.get<{ profile: UserProfile }>(`/users/${id}`) });
  const experience = useQuery({ queryKey: ["experience", id], queryFn: () => api.get<{ items: ExperienceItem[] }>(`/users/${id}/experience`) });

  if (profile.isPending) return <Skeleton className="h-64 w-full" />;
  if (profile.isError) return <p role="alert">{errorText(profile.error)}</p>;
  const p = profile.data.profile;

  return (
    <Page title={fullName(p)} description={p.headline ?? undefined}>
      <div className="mx-auto max-w-3xl space-y-4">
        <Card className="overflow-hidden">
          <Banner url={p.bannerUrl} editable={isMe} />
          <div className="px-6 pb-6">
            <div className="-mt-16 flex items-end justify-between">
              <AvatarEditor user={p} editable={isMe} />
              <div className="flex gap-2">
                {isMe ? (
                  <Button variant="outline" onClick={() => setEditing((e) => !e)}><Pencil /> {editing ? t("common.cancel") : t("profile.edit")}</Button>
                ) : (
                  <ProfileActions userId={p.id} />
                )}
              </div>
            </div>
            {editing ? (
              <EditProfileForm profile={p} onDone={() => setEditing(false)} />
            ) : (
              <div className="mt-3 space-y-1">
                <h1 className="text-2xl font-bold">{fullName(p)}</h1>
                {p.headline && <p>{p.headline}</p>}
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  {p.location && <><MapPin className="h-4 w-4" aria-hidden /> {p.location} · </>}
                  <span className="font-medium text-primary">{t("profile.connections", { count: p.connectionCount })}</span>
                </p>
              </div>
            )}
          </div>
        </Card>

        {p.about && (
          <Card className="p-6">
            <h2 className="mb-2 text-lg font-semibold">{t("profile.about")}</h2>
            <p className="whitespace-pre-wrap text-sm">{p.about}</p>
          </Card>
        )}

        {!!experience.data?.items.length && (
          <Card className="p-6">
            <h2 className="mb-3 text-lg font-semibold">{t("profile.experience")}</h2>
            <ul className="space-y-4">
              {experience.data.items.map((x) => (
                <li key={x.id}>
                  <p className="font-medium">{x.title}</p>
                  <p className="text-sm">{x.companyName}</p>
                  <p className="text-xs text-muted-foreground">{formatMonthYear(x.startDate)} – {x.endDate ? formatMonthYear(x.endDate) : t("profile.present")}</p>
                  {x.description && <p className="mt-1 text-sm">{x.description}</p>}
                </li>
              ))}
            </ul>
          </Card>
        )}

        <section aria-label={t("profile.activity")} className="space-y-3">
          <h2 className="text-lg font-semibold">{t("profile.activity")}</h2>
          <PostList queryKey={["user", id]} path={`/users/${id}/posts`} empty={t("profile.noPosts")} />
        </section>
      </div>
    </Page>
  );
}

function useImageUpload(kind: "avatar" | "banner") {
  const setUser = useAuth((s) => s.setUser);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("image", file);
      return api.post<{ user: AuthUser }>(`/users/me/${kind}`, form);
    },
    onSuccess: ({ user }) => {
      setUser(user);
      void qc.invalidateQueries({ queryKey: ["profile", user.id] });
    },
  });
}

function Banner({ url, editable }: { url: string | null; editable: boolean }) {
  return (
    <div className="relative h-40 bg-gradient-to-br from-teal-400 via-cyan-600 to-sky-800 sm:h-48">
      {url && <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      {editable && <BannerPicker current={url} />}
    </div>
  );
}

function AvatarEditor({ user, editable }: { user: UserProfile; editable: boolean }) {
  const { t } = useTranslation();
  const upload = useImageUpload("avatar");
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="relative">
      <UserAvatar user={user} className="h-32 w-32 border-4 border-card text-3xl" />
      {editable && (
        <>
          <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload.mutate(e.target.files[0])} />
          <Button size="icon" variant="secondary" className="absolute bottom-1 right-1 h-8 w-8 rounded-full" onClick={() => ref.current?.click()} aria-label={t("profile.changePhoto")}>
            <Camera />
          </Button>
        </>
      )}
    </div>
  );
}

function ProfileActions({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const openChat = useChatDock((s) => s.openChat);
  const [state, setState] = useState<"idle" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");
  const connect = useMutation({
    mutationFn: () => api.post(`/users/${userId}/connect`),
    onSuccess: () => setState("sent"),
    onError: (e) => {
      setState("error");
      setMsg(errorText(e));
    },
  });
  const message = useMutation({
    mutationFn: () => api.post<{ conversation: Conversation }>("/conversations", { userId }),
    onSuccess: ({ conversation }) => openChat(conversation.id),
  });
  return (
    <>
      <Button onClick={() => connect.mutate()} disabled={state !== "idle"}>
        <UserPlus /> {state === "sent" ? t("profile.pending") : state === "error" ? msg : t("profile.connect")}
      </Button>
      <Button variant="outline" onClick={() => message.mutate()}><MessageSquare /> {t("profile.message")}</Button>
    </>
  );
}

function EditProfileForm({ profile, onDone }: { profile: UserProfile; onDone: () => void }) {
  const { t } = useTranslation();
  const setUser = useAuth((s) => s.setUser);
  const qc = useQueryClient();
  const { register, handleSubmit, formState } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      firstName: profile.firstName,
      lastName: profile.lastName,
      headline: profile.headline ?? "",
      location: profile.location ?? "",
      about: profile.about ?? "",
    },
  });
  const e = formState.errors;
  const onSubmit = handleSubmit(async (values) => {
    const { user } = await api.patch<{ user: AuthUser }>("/users/me", values);
    setUser(user);
    await qc.invalidateQueries({ queryKey: ["profile", user.id] });
    onDone();
  });
  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <FormField id="firstName" label={t("profile.firstName")} error={e.firstName?.message}><Input id="firstName" {...register("firstName")} /></FormField>
        <FormField id="lastName" label={t("profile.lastName")} error={e.lastName?.message}><Input id="lastName" {...register("lastName")} /></FormField>
      </div>
      <FormField id="headline" label={t("profile.headline")} error={e.headline?.message}><Input id="headline" {...register("headline")} /></FormField>
      <FormField id="location" label={t("profile.location")} error={e.location?.message}><Input id="location" {...register("location")} /></FormField>
      <FormField id="about" label={t("profile.aboutField")} error={e.about?.message}><Textarea id="about" rows={5} {...register("about")} /></FormField>
      <Button type="submit" disabled={formState.isSubmitting}>{t("common.save")}</Button>
    </form>
  );
}
