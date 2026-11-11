import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { useAuth } from "@/stores/auth";
import { makePost, person } from "@/test/fixtures";
import { mockFetch, renderWithProviders } from "@/test/render";
import { PostCard } from "./PostCard";

const grace = person("a1", "Grace", "Compiler engineer");

describe("PostCard", () => {
  beforeEach(() =>
    useAuth.setState({ user: { ...person("me", "Me"), email: "me@example.test", emailVerified: true, hasPassword: true }, loading: false }),
  );

  it("puts the name, headline and time on separate lines", () => {
    mockFetch({});
    renderWithProviders(<PostCard post={makePost({ content: "Shipped it!", author: grace, commentCount: 2 })} />);
    const card = screen.getByRole("article", { name: "Post by Grace Test" });
    expect(within(card).getByRole("link", { name: "Grace Test" })).toBeInTheDocument();
    expect(within(card).getByText("Compiler engineer")).toBeInTheDocument();
    expect(within(card).getByText("now").closest("p")).not.toHaveTextContent("Grace"); // no "Grace Test1 h ago"
    expect(screen.getByText("2 comments")).toBeInTheDocument();
    expect(screen.queryByLabelText("Post options")).not.toBeInTheDocument(); // not mine
  });

  it("shows an 'I quit' story as a stamped exit record", () => {
    mockFetch({});
    renderWithProviders(
      <PostCard
        post={makePost({
          type: "QUIT",
          headline: "Families pay overtime.",
          companyName: "quillstone labs",
          company: { id: "c1", name: "Quillstone Labs", slug: "quillstone-labs" },
          role: "Backend engineer",
          tenureMonths: 27,
          reasons: ["unpaid_overtime", "burnout"],
        })}
      />,
    );
    expect(screen.getByRole("article", { name: "I quit by Grace Test" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Families pay overtime." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Quillstone Labs" })).toHaveAttribute("href", "/companies/quillstone-labs");
    expect(screen.getByText("2 yrs 3 mo")).toBeInTheDocument();
    expect(screen.getByText("Unpaid overtime")).toBeInTheDocument();
    expect(screen.getByText("Burnout")).toBeInTheDocument();
  });

  it("never shows who wrote an anonymous post", () => {
    mockFetch({});
    renderWithProviders(<PostCard post={makePost({ type: "RED_FLAG", companyName: "Acme", anonymous: true, author: null })} />);
    expect(screen.getByRole("article", { name: "Red flag by Anonymous" })).toBeInTheDocument();
    expect(screen.getByText("Anonymous")).toBeInTheDocument();
    expect(screen.queryByText(/Grace/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Test/ })).not.toBeInTheDocument();
  });

  it("reminds me when my own post is anonymous", () => {
    mockFetch({});
    renderWithProviders(<PostCard post={makePost({ type: "QUIT", companyName: "Acme", anonymous: true, isMine: true })} />);
    expect(screen.getByText(/posted anonymously, only you can see it's yours/)).toBeInTheDocument();
    expect(screen.getByLabelText("Post options")).toBeInTheDocument();
  });

  it("reacts with themed reactions and updates the per-type count optimistically", async () => {
    const calls = mockFetch({
      "PUT /posts/p1/reaction": { body: { post: makePost({ reactionCount: 4, reactionCounts: { RESPECT: 3, SAME: 0, RUN: 1, FUNNY: 0 }, myReaction: "RUN" }) } },
    });
    renderWithProviders(<PostCard post={makePost({ reactionCount: 3, reactionCounts: { RESPECT: 3, SAME: 0, RUN: 0, FUNNY: 0 } })} />);
    const group = screen.getByRole("group", { name: "Choose a reaction" });
    expect(within(group).getAllByRole("button").map((b) => b.textContent)).toEqual(["Respect3", "Same", "Run", "Funny"]);
    await userEvent.click(within(group).getByRole("button", { name: "Run" }));
    await waitFor(() => expect(calls.find((c) => c.method === "PUT")?.body).toEqual({ type: "RUN" }));
  });

  it("loads comments when opened", async () => {
    mockFetch({
      "GET /posts/p1/comments": {
        body: { items: [{ id: "c1", content: "Congrats!", createdAt: new Date().toISOString(), author: grace, parentId: null, replyTo: null, replyCount: 0 }], nextCursor: null },
      },
    });
    renderWithProviders(<PostCard post={makePost()} />);
    await userEvent.click(screen.getByRole("button", { name: /Comment$/ }));
    expect(await screen.findByText("Congrats!")).toBeInTheDocument();
  });
});
