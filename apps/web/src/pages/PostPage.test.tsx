import type { AppNotification, Comment, Post } from "@linkedout/shared";
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useAuth } from "@/stores/auth";
import { mockFetch, renderWithProviders } from "@/test/render";
import { notificationLink } from "./NotificationsPage";
import { PostPage } from "./PostPage";

const person = (id: string, firstName: string) => ({ id, firstName, lastName: "Test", headline: null, avatarUrl: null, location: null });
const ada = person("ada", "Ada");
const bob = person("bob", "Bob");
const now = new Date().toISOString();
const post: Post = { id: "p1", content: "Big news", imageUrl: null, createdAt: now, author: ada, commentCount: 2, reactionCount: 0, myReaction: null };
const top: Comment = { id: "c1", content: "Congrats", createdAt: now, author: bob, parentId: null, replyTo: null, replyCount: 1 };
const reply: Comment = { id: "r1", content: "Thank you!", createdAt: now, author: ada, parentId: "c1", replyTo: bob, replyCount: 0 };

const base: AppNotification = { id: "n", type: "COMMENT", read: false, createdAt: now, actor: bob, entityId: null, postId: null, commentId: null, threadId: null };

describe("notificationLink", () => {
  it("links each notification type to the exact place", () => {
    expect(notificationLink({ ...base, type: "REACTION", postId: "p1" })).toBe("/posts/p1");
    expect(notificationLink({ ...base, type: "COMMENT", postId: "p1", commentId: "c1" })).toBe("/posts/p1?comment=c1");
    expect(notificationLink({ ...base, type: "REPLY", postId: "p1", commentId: "r1", threadId: "c1" })).toBe("/posts/p1?comment=r1&thread=c1");
    expect(notificationLink({ ...base, type: "CONNECTION_REQUEST" })).toBe("/network");
    expect(notificationLink({ ...base, type: "CONNECTION_ACCEPTED" })).toBe("/in/bob");
    expect(notificationLink({ ...base, type: "COMMENT" })).toBe("/feed"); // very old notification without a post
  });
});

describe("PostPage", () => {
  beforeEach(() =>
    useAuth.setState({ user: { ...person("me", "Me"), email: "me@example.test", emailVerified: true, hasPassword: true }, loading: false }),
  );

  it("opens comments, expands the thread and highlights the reply from a notification link", async () => {
    // The mock answers by path only, so serve top-level comments first, then the thread's replies.
    let commentsCalls = 0;
    mockFetch({ "GET /posts/p1": { body: { post } } });
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/posts/p1/comments")) {
        commentsCalls += 1;
        const items = url.includes("parentId=c1") ? [reply] : [top];
        return new Response(JSON.stringify({ items, nextCursor: null }), { headers: { "Content-Type": "application/json" } });
      }
      return original(input, init);
    }) as typeof fetch;

    renderWithProviders(<PostPage />, { route: "/posts/p1?comment=r1&thread=c1", path: "/posts/:id" });

    expect(await screen.findByText("Big news")).toBeInTheDocument();
    const thread = await screen.findByRole("list", { name: "Replies to Bob Test" });
    expect(within(thread).getByText("Thank you!")).toBeInTheDocument();
    await waitFor(() => expect(document.getElementById("comment-r1")).toHaveAttribute("data-focused", "true"));
    expect(document.getElementById("comment-c1")).not.toHaveAttribute("data-focused");
    expect(commentsCalls).toBe(2);
  });

  it("explains when the post no longer exists", async () => {
    mockFetch({ "GET /posts/gone": { status: 404, body: { error: { code: "NOT_FOUND", message: "Post not found" } } } });
    renderWithProviders(<PostPage />, { route: "/posts/gone", path: "/posts/:id" });
    expect(await screen.findByRole("alert")).toHaveTextContent("This post was deleted");
  });
});
