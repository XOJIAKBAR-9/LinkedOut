import type { Post } from "@linkedout/shared";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { useAuth } from "@/stores/auth";
import { mockFetch, renderWithProviders } from "@/test/render";
import { PostCard } from "./PostCard";

const author = { id: "a1", firstName: "Grace", lastName: "Hopper", headline: "Compiler engineer", avatarUrl: null, location: null };
const post: Post = { id: "p1", content: "Shipped it!", imageUrl: null, createdAt: new Date().toISOString(), author, commentCount: 2, reactionCount: 3, myReaction: null };

describe("PostCard", () => {
  beforeEach(() =>
    useAuth.setState({ user: { ...author, id: "me", firstName: "Me", lastName: "Self", email: "me@example.test", emailVerified: true, hasPassword: true }, loading: false }),
  );

  it("renders author, content and counts", () => {
    mockFetch({});
    renderWithProviders(<PostCard post={post} />);
    expect(screen.getByRole("article", { name: "Post by Grace Hopper" })).toBeInTheDocument();
    expect(screen.getByText("Shipped it!")).toBeInTheDocument();
    expect(screen.getByText("3 reactions")).toBeInTheDocument();
    expect(screen.getByText("2 comments")).toBeInTheDocument();
    expect(screen.queryByLabelText("Post options")).not.toBeInTheDocument(); // not my post
  });

  it("sends a reaction when a reaction is picked", async () => {
    const calls = mockFetch({ "PUT /posts/p1/reaction": { body: { post: { ...post, myReaction: "CELEBRATE", reactionCount: 4 } } } });
    renderWithProviders(<PostCard post={post} />);
    await userEvent.click(screen.getByRole("button", { name: "Celebrate" }));
    await waitFor(() => expect(calls.find((c) => c.method === "PUT")?.body).toEqual({ type: "CELEBRATE" }));
  });

  it("loads comments when opened", async () => {
    mockFetch({
      "GET /posts/p1/comments": {
        body: { items: [{ id: "c1", content: "Congrats!", createdAt: new Date().toISOString(), author }], nextCursor: null },
      },
    });
    renderWithProviders(<PostCard post={post} />);
    await userEvent.click(screen.getByRole("button", { name: /Comment$/ }));
    expect(await screen.findByText("Congrats!")).toBeInTheDocument();
  });
});
