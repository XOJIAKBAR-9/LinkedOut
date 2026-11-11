import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { useAuth } from "@/stores/auth";
import { useComposer } from "@/stores/composer";
import { makePost, person } from "@/test/fixtures";
import { mockFetch, renderWithProviders } from "@/test/render";
import { MyQuitCard } from "./FeedSidebars";
import { PostComposer } from "./PostComposer";

beforeEach(() => {
  useComposer.setState({ open: false, type: "UPDATE", nonce: 0 });
  useAuth.setState({ user: { ...person("me", "Me"), email: "me@example.test", emailVerified: true, hasPassword: true }, loading: false });
});

describe("PostComposer", () => {
  it("starts as an inviting prompt with post-type choices", () => {
    mockFetch({});
    renderWithProviders(<PostComposer />);
    expect(screen.getByRole("button", { name: "What are you walking away from?" })).toBeInTheDocument();
    expect(screen.getAllByRole("radio").map((r) => r.textContent?.trim())).toEqual(["Update", "I quit", "Don't apply here", "Red flag"]);
  });

  it("posts an anonymous quit story with structured fields", async () => {
    const calls = mockFetch({ "POST /posts": { status: 201, body: { post: makePost({ type: "QUIT" }) } } });
    renderWithProviders(<PostComposer />);
    await userEvent.click(screen.getByRole("radio", { name: "I quit" }));

    // Company is required for typed posts.
    await userEvent.type(screen.getByLabelText("Your story"), "Two years of 'we are a family'.");
    await userEvent.click(screen.getByRole("button", { name: "Publish my exit" }));
    expect(await screen.findByText("Name the company")).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST")).toBe(false);

    await userEvent.type(screen.getByLabelText("Headline"), "Families pay overtime.");
    await userEvent.type(screen.getByLabelText("Company *"), "Acme");
    await userEvent.type(screen.getByLabelText("years"), "2");
    await userEvent.type(screen.getByLabelText("months"), "3");
    for (const r of ["Burnout", "Low pay", "Chaos", "Layoffs"]) await userEvent.click(screen.getByRole("button", { name: r }));
    expect(screen.getByRole("button", { name: "Other" })).toBeDisabled(); // max 4 reasons
    await userEvent.click(screen.getByLabelText(/Post anonymously/));
    await userEvent.click(screen.getByRole("button", { name: "Publish my exit" }));

    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
    const form = calls.find((c) => c.method === "POST")!.body as FormData;
    expect(Object.fromEntries(form.entries())).toMatchObject({
      type: "QUIT",
      headline: "Families pay overtime.",
      companyName: "Acme",
      tenureMonths: "27",
      reasons: JSON.stringify(["burnout", "low_pay", "chaos", "layoffs"]),
      anonymous: "true",
    });
    // Back to the prompt after publishing.
    expect(await screen.findByRole("button", { name: "What are you walking away from?" })).toBeInTheDocument();
  }, 15_000); // lots of simulated typing: allow for a busy machine
});

describe("MyQuitCard", () => {
  it("counts days since my last quit", async () => {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 3600 * 1000 - 1000).toISOString();
    mockFetch({
      "GET /posts/insights": { body: { mostWarned: [], trendingReasons: [], me: { lastQuitAt: fiveDaysAgo, lastQuitCompany: "Acme", quitCount: 2 } } },
    });
    renderWithProviders(<MyQuitCard />);
    expect(await screen.findByText("5")).toBeInTheDocument();
    expect(screen.getByText("days without Acme")).toBeInTheDocument();
    expect(screen.getByText("2 jobs quit so far")).toBeInTheDocument();
  });

  it("invites people who haven't quit yet, and opens the composer at the right type", async () => {
    mockFetch({ "GET /posts/insights": { body: { mostWarned: [], trendingReasons: [], me: { lastQuitAt: null, lastQuitCompany: null, quitCount: 0 } } } });
    renderWithProviders(<MyQuitCard />);
    expect(await screen.findByText("Still there?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Warn others about a company" }));
    expect(useComposer.getState()).toMatchObject({ open: true, type: "WARNING" });
  });
});
