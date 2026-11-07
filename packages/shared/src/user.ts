import { z } from "zod";

/** Built-in profile backgrounds served by the web app from /banners. */
export const BANNER_PRESETS = [
  { id: "aurora", label: "Aurora" },
  { id: "sunset", label: "Sunset" },
  { id: "ocean", label: "Ocean" },
  { id: "mountains", label: "Mountains" },
  { id: "forest", label: "Forest" },
  { id: "city", label: "City lights" },
  { id: "dot-grid", label: "Dot grid" },
  { id: "topography", label: "Topography" },
] as const;

export const bannerPresetUrl = (id: string) => `/banners/${id}.svg`;
const presetUrls = BANNER_PRESETS.map((b) => bannerPresetUrl(b.id)) as [string, ...string[]];

export const updateProfileSchema = z.object({
  /** Only a preset path or null (remove). Custom images go through the upload endpoint. */
  bannerUrl: z.enum(presetUrls).nullable().optional(),
  firstName: z.string().trim().min(1, "validation.firstNameRequired").max(50, "validation.tooLong").optional(),
  lastName: z.string().trim().min(1, "validation.lastNameRequired").max(50, "validation.tooLong").optional(),
  headline: z.string().trim().max(220, "validation.tooLong").optional(),
  about: z.string().trim().max(2600, "validation.tooLong").optional(),
  location: z.string().trim().max(100, "validation.tooLong").optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export interface PublicUser {
  id: string;
  firstName: string;
  lastName: string;
  headline: string | null;
  avatarUrl: string | null;
  location: string | null;
}

export interface UserProfile extends PublicUser {
  about: string | null;
  bannerUrl: string | null;
  createdAt: string;
  connectionCount: number;
}

export interface AuthUser extends PublicUser {
  email: string;
  emailVerified: boolean;
  /** False for accounts created with GitHub only; they confirm deletion by typing their email instead. */
  hasPassword: boolean;
}

/** Deleting an account needs the password, or the account email for GitHub-only accounts. */
export const deleteAccountSchema = z
  .object({
    password: z.string().optional(),
    email: z.string().trim().toLowerCase().optional(),
  })
  .refine((v) => Boolean(v.password || v.email), { message: "validation.passwordRequired", path: ["password"] });
export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;
