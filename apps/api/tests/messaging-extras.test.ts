import type { AddressInfo } from "node:net";
import http from "node:http";
import { io as connect } from "socket.io-client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import { createSocketServer } from "../src/socket/index.js";
import { setIO } from "../src/socket/realtime.js";
import { app, signUp } from "./helpers.js";

async function pair() {
  const ann = await signUp({ firstName: "Ann" });
  const ben = await signUp({ firstName: "Ben" });
  const conv = (await ann.agent.post("/api/v1/conversations").send({ userId: ben.user.id }).expect(200)).body.conversation.id as string;
  const msgs = (id = conv) => `/api/v1/conversations/${id}/messages`;
  return { ann, ben, conv, msgs };
}

describe("stickers", () => {
  it("sends a sticker and rejects unknown stickers or mixed payloads", async () => {
    const { ann, ben, msgs } = await pair();
    const sent = (await ann.agent.post(msgs()).send({ stickerId: "rocket" }).expect(201)).body.message;
    expect(sent).toMatchObject({ type: "STICKER", stickerId: "rocket", content: "" });
    await ann.agent.post(msgs()).send({ stickerId: "not-a-sticker" }).expect(400);
    await ann.agent.post(msgs()).send({ stickerId: "rocket", content: "both" }).expect(400);
    const history = (await ben.agent.get(msgs()).expect(200)).body.items;
    expect(history[0]).toMatchObject({ type: "STICKER", stickerId: "rocket" });
  });
});

describe("editing and deleting", () => {
  it("lets the sender edit their text and marks it edited", async () => {
    const { ann, ben, msgs } = await pair();
    const m = (await ann.agent.post(msgs()).send({ content: "Helo" }).expect(201)).body.message;
    const edited = (await ann.agent.patch(`${msgs()}/${m.id}`).send({ content: "Hello" }).expect(200)).body.message;
    expect(edited.content).toBe("Hello");
    expect(edited.editedAt).toBeTruthy();
    // Only the sender may edit or delete.
    await ben.agent.patch(`${msgs()}/${m.id}`).send({ content: "hacked" }).expect(403);
    await ben.agent.delete(`${msgs()}/${m.id}`).expect(403);
    await ann.agent.patch(`${msgs()}/${m.id}`).send({ content: "  " }).expect(400);
  });

  it("refuses edits after 15 minutes and on stickers", async () => {
    const { ann, msgs, conv } = await pair();
    const m = (await ann.agent.post(msgs()).send({ content: "old" }).expect(201)).body.message;
    await prisma.message.update({ where: { id: m.id }, data: { createdAt: new Date(Date.now() - 16 * 60 * 1000) } });
    const res = await ann.agent.patch(`${msgs()}/${m.id}`).send({ content: "new" }).expect(403);
    expect(res.body.error.code).toBe("EDIT_EXPIRED");
    const s = (await ann.agent.post(msgs(conv)).send({ stickerId: "heart" }).expect(201)).body.message;
    await ann.agent.patch(`${msgs()}/${s.id}`).send({ content: "text" }).expect(400);
  });

  it("deletes for everyone: content is wiped, it no longer counts as unread, and can't be edited", async () => {
    const { ann, ben, msgs } = await pair();
    const m = (await ann.agent.post(msgs()).send({ content: "oops, secret" }).expect(201)).body.message;
    expect((await ben.agent.get("/api/v1/conversations/unread")).body.messages).toBe(1);
    const del = (await ann.agent.delete(`${msgs()}/${m.id}`).expect(200)).body.message;
    expect(del).toMatchObject({ content: "", deletedAt: expect.any(String) });
    expect((await prisma.message.findUniqueOrThrow({ where: { id: m.id } })).content).toBe("");
    expect((await ben.agent.get("/api/v1/conversations/unread")).body.messages).toBe(0);
    await ann.agent.patch(`${msgs()}/${m.id}`).send({ content: "again" }).expect(404);
    const history = (await ben.agent.get(msgs()).expect(200)).body.items;
    expect(history[0]).toMatchObject({ id: m.id, content: "", deletedAt: expect.any(String) });
  });
});

describe("seen receipts", () => {
  let server: http.Server | undefined;
  afterEach(async () => {
    setIO(null);
    await new Promise<void>((r) => (server ? server.close(() => r()) : r()));
  });

  it("exposes each participant's lastReadAt and pushes read/edit events live", async () => {
    server = http.createServer(app);
    const io = createSocketServer(server);
    await new Promise<void>((r) => server!.listen(0, r));
    const url = `http://localhost:${(server.address() as AddressInfo).port}`;

    const { ann, ben, conv, msgs } = await pair();
    const cookie = ann.cookies.map((c) => c.split(";")[0]).join("; ");
    const annSocket = connect(url, { extraHeaders: { cookie }, transports: ["websocket"] });
    await new Promise((r) => annSocket.on("connect", () => r(null)));

    const m = (await ann.agent.post(msgs()).send({ content: "Did you see this?" }).expect(201)).body.message;
    const receipt = (list: { id: string; readReceipts: { userId: string; lastReadAt: string | null }[] }[]) =>
      list.find((c) => c.id === conv)!.readReceipts.find((r) => r.userId === ben.user.id)!.lastReadAt;
    expect(receipt((await ann.agent.get("/api/v1/conversations")).body.items)).toBeNull(); // Sent, not seen

    const read = new Promise<{ userId: string; lastReadAt: string }>((r) => annSocket.on("conversation:read", r));
    await ben.agent.get(msgs()).expect(200); // Ben opens the chat
    const ev = await read;
    expect(ev.userId).toBe(ben.user.id);
    expect(new Date(ev.lastReadAt) >= new Date(m.createdAt)).toBe(true);
    expect(receipt((await ann.agent.get("/api/v1/conversations")).body.items)).toBe(ev.lastReadAt); // Seen

    const updated = new Promise<{ content: string }>((r) => annSocket.on("message:updated", r));
    await ann.agent.patch(`${msgs()}/${m.id}`).send({ content: "Did you see this??" }).expect(200);
    expect((await updated).content).toBe("Did you see this??");

    // Loading older pages (with a cursor) doesn't count as reading.
    const spy = vi.fn();
    annSocket.on("conversation:read", spy);
    await ben.agent.get(`${msgs()}?cursor=${m.id}`).expect(200);
    await new Promise((r) => setTimeout(r, 100));
    expect(spy).not.toHaveBeenCalled();

    annSocket.close();
    io.close();
  });
});
