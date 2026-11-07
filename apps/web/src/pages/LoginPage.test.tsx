import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { useAuth } from "@/stores/auth";
import { mockFetch, renderWithProviders } from "@/test/render";
import { LoginPage } from "./LoginPage";

const user = { id: "u1", email: "ada@example.test", emailVerified: true, hasPassword: true, firstName: "Ada", lastName: "Lovelace", headline: null, avatarUrl: null, location: null };

describe("LoginPage", () => {
  beforeEach(() => useAuth.setState({ user: null, loading: false }));

  it("shows validation errors from the shared Zod schema", async () => {
    const calls = mockFetch({ "GET /auth/providers": { body: { github: false } } });
    renderWithProviders(<LoginPage />);
    await userEvent.type(screen.getByLabelText("Email"), "not-an-email");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Enter a valid email")).toBeInTheDocument();
    expect(screen.getByText("Password is required")).toBeInTheDocument();
    expect(calls.some((c) => c.url === "/auth/login")).toBe(false);
  });

  it("signs in, stores the user and goes to the feed", async () => {
    const calls = mockFetch({
      "GET /auth/providers": { body: { github: false } },
      "POST /auth/login": { body: { user } },
    });
    renderWithProviders(<LoginPage />);
    await userEvent.type(screen.getByLabelText("Email"), "ADA@example.test");
    await userEvent.type(screen.getByLabelText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Feed page")).toBeInTheDocument();
    expect(useAuth.getState().user?.id).toBe("u1");
    expect(calls.find((c) => c.url === "/auth/login")?.body).toEqual({ email: "ada@example.test", password: "password123" });
  });

  it("shows the server error on bad credentials", async () => {
    mockFetch({
      "GET /auth/providers": { body: { github: true } },
      "POST /auth/login": { status: 401, body: { error: { code: "INVALID_CREDENTIALS", message: "Incorrect email or password" } } },
    });
    renderWithProviders(<LoginPage />);
    await userEvent.type(screen.getByLabelText("Email"), "ada@example.test");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password.");
    await waitFor(() => expect(screen.getByText(/Continue with GitHub/)).toBeInTheDocument());
  });
});
