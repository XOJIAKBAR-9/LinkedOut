import type { PublicUser } from "@linkedout/shared";

export const publicUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  headline: true,
  avatarUrl: true,
  location: true,
} as const;

export function toPublicUser(u: PublicUser): PublicUser {
  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    headline: u.headline,
    avatarUrl: u.avatarUrl,
    location: u.location,
  };
}
