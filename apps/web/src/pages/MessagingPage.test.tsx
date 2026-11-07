import type { Conversation } from "@linkedout/shared";
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useAuth } from "@/stores/auth";
import { mockFetch, renderWithProviders } from "@/test/render";
import { MessagingPage } from "./MessagingPage";

const person = (id: string, firstName: string) => ({ id, firstName, lastName: "Test", headline: null, avatarUrl: null, location: null });
const me = person("me", "Me");
const now = new Date().toISOString();
const conv = (id: string, other: ReturnType<typeof person>, unreadCount: number): Conversation => ({
  id,
  participants: [me, other],
  lastMessage: { id: `m-${id}`, conversationId: id, senderId: other.id, type: "TEXT", content: `Hello from ${other.firstName}`, stickerId: null, createdAt: now, editedAt: null, deletedAt: null },
  updatedAt: now,
  unreadCount,
  readReceipts: [],
});

describe("MessagingPage unread counts", () => {
  beforeEach(() => useAuth.setState({ user: { ...me, email: "me@example.test", emailVerified: true, hasPassword: true }, loading: false }));

  it("shows a red count per person with unread messages", async () => {
    mockFetch({
      "GET /conversations": { body: { items: [conv("c1", person("ann", "Ann"), 3), conv("c2", person("ben", "Ben"), 1), conv("c3", person("cat", "Cat"), 0)] } },
    });
    renderWithProviders(<MessagingPage />, { route: "/messaging", path: "/messaging" });
    expect(await screen.findByLabelText("3 unread messages")).toHaveTextContent("3");
    expect(screen.getByLabelText("1 unread message")).toHaveTextContent("1");
    expect(screen.getAllByLabelText(/unread message/)).toHaveLength(2); // Cat has none
  });
});
