import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { useAuth } from "@/stores/auth";
import { mockFetch, renderWithProviders } from "@/test/render";
import { EmailVerificationStatus, VerifyBanner } from "./VerifyEmail";

const user = { id: "u1", firstName: "Ann", lastName: "Test", headline: null, avatarUrl: null, location: null, email: "ann@example.test", emailVerified: false, hasPassword: true };

describe("VerifyBanner", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuth.setState({ user, loading: false });
  });

  it("can be closed and stays closed for that account", async () => {
    mockFetch({});
    const { unmount } = renderWithProviders(<VerifyBanner />);
    expect(screen.getByText("Please verify your email address.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByText("Please verify your email address.")).not.toBeInTheDocument();
    unmount();

    renderWithProviders(<VerifyBanner />); // e.g. after a reload
    expect(screen.queryByText("Please verify your email address.")).not.toBeInTheDocument();

    useAuth.setState({ user: { ...user, id: "u2" } }); // a different account still sees it
    renderWithProviders(<VerifyBanner />);
    expect(screen.getByText("Please verify your email address.")).toBeInTheDocument();
  });

  it("shows the send error but the banner can still be closed", async () => {
    mockFetch({ "POST /auth/resend-verification": { status: 502, body: { error: { code: "EMAIL_NOT_SENT", message: "x" } } } });
    renderWithProviders(<VerifyBanner />);
    await userEvent.click(screen.getByRole("button", { name: "Resend email" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("We couldn't send the email right now");
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("is hidden for verified accounts, and Settings offers resend after closing", async () => {
    mockFetch({ "POST /auth/resend-verification": { status: 204 } });
    useAuth.setState({ user: { ...user, emailVerified: true } });
    const banner = renderWithProviders(<VerifyBanner />);
    expect(screen.queryByText("Please verify your email address.")).not.toBeInTheDocument();
    banner.unmount();
    const status = renderWithProviders(<EmailVerificationStatus />);
    expect(screen.getByText("Email verified")).toBeInTheDocument();
    status.unmount();

    useAuth.setState({ user });
    renderWithProviders(<EmailVerificationStatus />);
    await userEvent.click(screen.getByRole("button", { name: "Resend email" }));
    expect(await screen.findByRole("button", { name: "Email sent" })).toBeDisabled();
  });
});
