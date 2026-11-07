import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { useAuth } from "@/stores/auth";
import { mockFetch, renderWithProviders } from "@/test/render";
import { DeleteAccount } from "./DeleteAccount";

const me = { id: "me", firstName: "Me", lastName: "Self", headline: null, avatarUrl: null, location: null, email: "me@example.test", emailVerified: true, hasPassword: true };

async function openPasswordStep() {
  await userEvent.click(screen.getByRole("button", { name: /Delete account/ }));
  expect(await screen.findByRole("alertdialog", { name: /Are you sure/ })).toBeInTheDocument();
  expect(screen.getByText("Your posts, comments and reactions")).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Yes, continue" }));
  return screen.findByLabelText("Password");
}

describe("DeleteAccount", () => {
  beforeEach(() => useAuth.setState({ user: me, loading: false }));

  it("asks 'are you sure', then the password, then deletes and signs out", async () => {
    const calls = mockFetch({ "DELETE /auth/account": { status: 204 } });
    renderWithProviders(<DeleteAccount />);

    const password = await openPasswordStep();
    const submit = screen.getByRole("button", { name: "Delete my account permanently" });
    expect(submit).toBeDisabled(); // nothing typed yet
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);

    await userEvent.type(password, "password123");
    await userEvent.click(submit);

    await waitFor(() => expect(useAuth.getState().user).toBeNull());
    expect(sessionStorage.getItem("lo-account-deleted")).toBe("1");
    expect(calls.find((c) => c.method === "DELETE")).toMatchObject({ url: "/auth/account", body: { password: "password123" } });
  });

  it("shows an error and keeps the user signed in when the password is wrong", async () => {
    mockFetch({ "DELETE /auth/account": { status: 403, body: { error: { code: "WRONG_PASSWORD", message: "Incorrect password" } } } });
    renderWithProviders(<DeleteAccount />);
    await userEvent.type(await openPasswordStep(), "nope");
    await userEvent.click(screen.getByRole("button", { name: "Delete my account permanently" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect password.");
    expect(useAuth.getState().user?.id).toBe("me");
  });

  it("cancelling at the first step deletes nothing", async () => {
    const calls = mockFetch({});
    renderWithProviders(<DeleteAccount />);
    await userEvent.click(screen.getByRole("button", { name: /Delete account/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(calls).toHaveLength(0);
  });

  it("asks GitHub-only accounts for their email instead", async () => {
    useAuth.setState({ user: { ...me, hasPassword: false }, loading: false });
    const calls = mockFetch({ "DELETE /auth/account": { status: 204 } });
    renderWithProviders(<DeleteAccount />);
    await userEvent.click(screen.getByRole("button", { name: /Delete account/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Yes, continue" }));
    await userEvent.type(await screen.findByLabelText("Account email"), "me@example.test");
    await userEvent.click(screen.getByRole("button", { name: "Delete my account permanently" }));
    await waitFor(() => expect(calls.find((c) => c.method === "DELETE")?.body).toEqual({ email: "me@example.test" }));
  });
});
