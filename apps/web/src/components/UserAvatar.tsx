import type { PublicUser } from "@linkedout/shared";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn, fullName, initials } from "@/lib/utils";

export function UserAvatar({ user, className }: { user: Pick<PublicUser, "firstName" | "lastName" | "avatarUrl">; className?: string }) {
  return (
    <Avatar className={cn(className)}>
      {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={fullName(user)} />}
      <AvatarFallback>{initials(user)}</AvatarFallback>
    </Avatar>
  );
}
