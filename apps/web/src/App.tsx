import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { GuestOnly, RequireAuth } from "@/features/auth/RequireAuth";
import { useAuthBootstrap } from "@/features/auth/useAuthBootstrap";
import { FeedPage } from "@/pages/FeedPage";
import { LoginPage } from "@/pages/LoginPage";
import { MessagingPage } from "@/pages/MessagingPage";
import { NetworkPage } from "@/pages/NetworkPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { NotificationsPage } from "@/pages/NotificationsPage";
import { ForgotPasswordPage, ResetPasswordPage, VerifyEmailPage } from "@/pages/PasswordPages";
import { PostPage } from "@/pages/PostPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { RegisterPage } from "@/pages/RegisterPage";
import { SearchPage } from "@/pages/SearchPage";
import { SettingsPage } from "@/pages/SettingsPage";

export function App() {
  useAuthBootstrap();
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/feed" replace />} />
      <Route element={<GuestOnly />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>
      {/* Reachable signed in or out: anyone may need to reset a password. */}
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/in/:id" element={<ProfilePage />} />
          <Route path="/posts/:id" element={<PostPage />} />
          <Route path="/network" element={<NetworkPage />} />
          <Route path="/messaging" element={<MessagingPage />} />
          <Route path="/messaging/:id" element={<MessagingPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
