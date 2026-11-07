import type { Comment } from "@linkedout/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { useAuth } from "@/stores/auth";
import { mockFetch, renderWithProviders } from "@/test/render";
import { Comments } from "./Comments";

const person = (id: string, firstName: string) => ({ id, firstName, lastName: "Test", headline: null, avatarUrl: null, location: null });
const ada = person("ada", "Ada");
const bob = person("bob", "Bob");
const now = new Date().toISOString();

const top: Comment = { id: "c1", content: "Great post", createdAt: now, author: ada, parentId: null, replyTo: null, replyCount: 1 };
const reply: Comment = { id: "r1", content: "Agreed", createdAt: now, author: bob, parentId: "c1", replyTo: ada, replyCount: 0 };

describe("Comments replies", () => {
  beforeEach(() => useAuth.setState({ user: { ...person("me", "Me"), email: "me@example.test", emailVerified: true, hasPassword: true }, loading: false }));

  it("shows a reply count, expands the thread and shows @mentions", async () => {
    mockFetch({ "GET /posts/p1/comments": { body: { items: [top], nextCursor: null } } });
    renderWithProviders(<Comments postId="p1" />);
    const toggle = await screen.findByRole("button", { name: "View 1 reply" });

    // Replies are only fetched once the thread is opened.
    mockFetch({
      "GET /posts/p1/comments": { body: { items: [reply], nextCursor: null } },
    });
    await userEvent.click(toggle);
    const thread = await screen.findByRole("list", { name: "Replies to Ada Test" });
    expect(within(thread).getByText("Agreed")).toBeInTheDocument();
    expect(within(thread).getByRole("link", { name: "@Ada Test" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide replies" })).toHaveAttribute("aria-expanded", "true");
  });

  it("posts a reply with the parent comment id", async () => {
    const calls = mockFetch({
      "GET /posts/p1/comments": { body: { items: [{ ...top, replyCount: 0 }], nextCursor: null } },
      "POST /posts/p1/comments": { status: 201, body: { comment: { ...reply, author: person("me", "Me") } } },
    });
    renderWithProviders(<Comments postId="p1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Reply to Ada Test" }));

    expect(screen.getByText("Replying to Ada Test")).toBeInTheDocument();
    const box = screen.getByRole("textbox", { name: "Reply to Ada Test" });
    expect(box).toHaveFocus();
    await userEvent.type(box, "Thanks!");
    await userEvent.click(screen.getByRole("button", { name: "Reply" }));

    await waitFor(() =>
      expect(calls.find((c) => c.method === "POST")?.body).toEqual({ content: "Thanks!", parentId: "c1" }),
    );
    await waitFor(() => expect(screen.queryByText("Replying to Ada Test")).not.toBeInTheDocument());
  });

  it("cancels a reply with Escape", async () => {
    mockFetch({ "GET /posts/p1/comments": { body: { items: [{ ...top, replyCount: 0 }], nextCursor: null } } });
    renderWithProviders(<Comments postId="p1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Reply to Ada Test" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("textbox", { name: "Reply to Ada Test" })).not.toBeInTheDocument();
  });
});
