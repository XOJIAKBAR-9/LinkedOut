import { useTranslation } from "react-i18next";
import type { AppNotification, Paginated } from "@linkedout/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Home, LogOut, MessageSquare, Search, Settings, User, Users } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Logo } from "@/components/Logo";
import { SearchBox } from "@/components/SearchBox";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { VerifyBanner } from "@/features/auth/VerifyEmail";
import { ChatDock } from "@/features/messaging/ChatDock";
import { useUnreadMessages } from "@/features/messaging/Thread";
import { useRealtime } from "@/features/useRealtime";
import { api } from "@/lib/api";
import { cn, fullName } from "@/lib/utils";
import { useAuth } from "@/stores/auth";

function NavItem({ to, icon: Icon, label, badge }: { to: string; icon: typeof Home; label: string; badge?: number }) {
  const { t } = useTranslation();
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "relative flex min-h-11 min-w-11 flex-col items-center justify-center gap-0.5 px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground sm:px-3",
          isActive && "text-primary after:absolute after:-bottom-[9px] after:h-0.5 after:w-full after:rounded-full after:bg-primary",
        )
      }
    >
      <Icon className="h-5 w-5" aria-hidden />
      <span className="sr-only xl:not-sr-only">{label}</span>
      {!!badge && (
        <span className="absolute right-1 top-0 min-w-4 rounded-full bg-primary px-1 font-mono text-[11px] font-medium leading-4 text-primary-foreground" aria-label={t("nav.unread", { count: badge })}>
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </NavLink>
  );
}

export function AppLayout() {
  useRealtime();
  const { t } = useTranslation();
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const unreadMessages = useUnreadMessages();
  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get<Paginated<AppNotification> & { unread: number }>("/notifications?limit=20"),
  });

  const logout = async () => {
    await api.post("/auth/logout");
    qc.clear();
    setUser(null);
    navigate("/login");
  };

  if (!user) return null;

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-background focus:p-2">
        {t("nav.skipToContent")}
      </a>
      <header className="sticky top-0 z-40 border-b bg-background">
        <div className="h-[3px] bg-primary" aria-hidden />
        <div className="container flex h-14 items-center gap-1 sm:gap-3">
          <NavLink to="/feed" aria-label={t("nav.homeLink")} className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Logo showWordmark={false} className="lg:hidden" />
            <Logo className="hidden lg:inline-flex" />
          </NavLink>
          <SearchBox className="hidden max-w-xs flex-1 md:block" />
          <nav className="ml-auto flex items-center" aria-label={t("nav.main")}>
            <NavItem to="/feed" icon={Home} label={t("nav.home")} />
            <NavItem to="/network" icon={Users} label={t("nav.network")} />
            <NavItem to="/messaging" icon={MessageSquare} label={t("nav.messaging")} badge={unreadMessages.data?.conversations} />
            <NavItem to="/notifications" icon={Bell} label={t("nav.notifications")} badge={notifications.data?.unread} />
            <NavItem to="/search" icon={Search} label={t("nav.search")} />
          </nav>
          {/* Phones: language and theme move to Settings (account menu), so the avatar always fits. */}
          <div className="hidden items-center sm:flex">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full" aria-label={t("nav.accountMenu")}>
                <UserAvatar user={user} className="h-8 w-8" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div>{fullName(user)}</div>
                <div className="truncate text-xs font-normal text-muted-foreground">{user.headline ?? user.email}</div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate(`/in/${user.id}`)}><User /> {t("nav.viewProfile")}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate("/settings")}><Settings /> {t("nav.settings")}</DropdownMenuItem>
              <DropdownMenuItem onClick={logout}><LogOut /> {t("nav.signOut")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <VerifyBanner />
      <main id="main" className="container py-6">
        <Outlet />
      </main>
      <ChatDock />
    </div>
  );
}
