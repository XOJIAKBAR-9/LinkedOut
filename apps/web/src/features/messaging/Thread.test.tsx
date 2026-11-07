import type { Conversation, Message } from "@linkedout/shared";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "@/stores/auth";
import { mockFetch, renderWithProviders } from "@/test/render";
import { Thread } from "./Thread";

// The thread opens a socket for typing indicators; a no-op stub is enough here.
vi.mock("@/lib/socket", () => ({ getSocket: () => ({ on: () => {}, off: () => {}, emit: () => {} }) }));

const person = (id: string, firstName: string) => ({ id, firstName, lastName: "Test", headline: null, avatarUrl: null, location: null });
const me = person("me", "Me");
const ann = person("ann", "Ann");
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

const msg = (over: Partial<Message>): Message => ({
  id: "m1", conversationId: "c1", senderId: "me", type: "TEXT", content: "Hello", stickerId: null,
  createdAt: ago(60_000), editedAt: null, deletedAt: null, ...over,
});

const conversation = (annReadAt: string | null): Conversation => ({
  id: "c1", participants: [me, ann], lastMessage: null, updatedAt: ago(0), unreadCount: 0,
  readReceipts: [{ userId: "me", lastReadAt: ago(0) }, { userId: "ann", lastReadAt: annReadAt }],
});

function setup(items: Message[], annReadAt: string | null, extra: Record<string, { status?: number; body?: unknown }> = {}) {
  const calls = mockFetch({
    "GET /conversations": { body: { items: [conversation(annReadAt)] } },
    "GET /conversations/c1/messages": { body: { items: [...items].reverse(), nextCursor: null } },
    "GET /conversations/unread": { body: { conversations: 0, messages: 0 } },
    ...extra,
  });
  renderWithProviders(<Thread conversationId="c1" />);
  return calls;
}

describe("Thread", () => {
  beforeEach(() => useAuth.setState({ user: { ...me, email: "me@example.test", emailVerified: true, hasPassword: true }, loading: false }));

  it("shows Sent until the other person has read it, then Seen", async () => {
    setup([msg({ createdAt: ago(60_000) })], null);
    expect(await screen.findByTestId("receipt")).toHaveTextContent("Sent");
  });

  it("shows Seen when the other person's read time is after the message", async () => {
    setup([msg({ id: "m0", createdAt: ago(120_000) }), msg({ id: "m1", content: "Latest", createdAt: ago(60_000) })], ago(30_000));
    const receipts = await screen.findAllByTestId("receipt");
    expect(receipts).toHaveLength(1); // only under my latest message
    await waitFor(() => expect(receipts[0]).toHaveTextContent("Seen"));
  });

  it("sends a sticker from the picker", async () => {
    const calls = setup([], null, { "POST /conversations/c1/messages": { status: 201, body: { message: msg({ type: "STICKER", stickerId: "rocket", content: "" }) } } });
    await userEvent.click(await screen.findByRole("button", { name: "Send a sticker" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Rocket" }));
    await waitFor(() => expect(calls.find((c) => c.method === "POST")?.body).toEqual({ stickerId: "rocket" }));
  });

  it("renders stickers, edited and deleted messages", async () => {
    setup(
      [
        msg({ id: "s", senderId: "ann", type: "STICKER", stickerId: "heart", content: "" }),
        msg({ id: "e", senderId: "ann", content: "Fixed typo", editedAt: ago(10_000) }),
        msg({ id: "d", senderId: "ann", content: "", deletedAt: ago(5_000) }),
      ],
      null,
    );
    expect(await screen.findByRole("img", { name: "Heart" })).toHaveAttribute("src", "/stickers/heart.svg");
    expect(screen.getByText("edited")).toBeInTheDocument();
    expect(screen.getByText("This message was deleted")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Message options" })).not.toBeInTheDocument(); // not mine
  });

  it("edits my own message inline", async () => {
    const calls = setup([msg({ content: "Helo" })], null, {
      "PATCH /conversations/c1/messages/m1": { body: { message: msg({ content: "Hello", editedAt: ago(0) }) } },
    });
    await userEvent.click(await screen.findByRole("button", { name: "Message options" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Edit" }));
    const box = screen.getByRole("textbox", { name: "Edit message" });
    await userEvent.clear(box);
    await userEvent.type(box, "Hello{Enter}");
    await waitFor(() => expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ content: "Hello" }));
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "Edit message" })).not.toBeInTheDocument());
  });

  it("hides Edit after 15 minutes but still allows Delete, with a confirmation", async () => {
    const calls = setup([msg({ createdAt: ago(16 * 60_000) })], null, {
      "DELETE /conversations/c1/messages/m1": { body: { message: msg({ content: "", deletedAt: ago(0) }) } },
    });
    await userEvent.click(await screen.findByRole("button", { name: "Message options" }));
    expect(screen.queryByRole("menuitem", { name: "Edit" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Delete this message?" });
    expect(calls.some((c) => c.method === "DELETE")).toBe(false); // nothing until confirmed
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE" && c.url === "/conversations/c1/messages/m1")).toBe(true));
  });
});
