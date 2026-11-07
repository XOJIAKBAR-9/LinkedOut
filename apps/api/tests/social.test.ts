import type { AddressInfo } from "node:net";
import http from "node:http";
import { io as connect } from "socket.io-client";
import { afterEach, describe, expect, it } from "vitest";
import { createSocketServer } from "../src/socket/index.js";
import { setIO } from "../src/socket/realtime.js";
import { app, signUp } from "./helpers.js";

const cookieHeader = (cookies: string[]) => cookies.map((c) => c.split(";")[0]).join("; ");

describe("connections", () => {
  it("sends, accepts and lists connections; feed narrows to the network", async () => {
    const a = await signUp();
    const b = await signUp();
    const stranger = await signUp();
    await stranger.agent.post("/api/v1/posts").field("content", "from a stranger").expect(201);
    await b.agent.post("/api/v1/posts").field("content", "from b").expect(201);

    const req = await a.agent.post(`/api/v1/users/${b.user.id}/connect`).expect(201);
    await a.agent.post(`/api/v1/users/${b.user.id}/connect`).expect(409);
    const pending = await b.agent.get("/api/v1/connections/pending").expect(200);
    expect(pending.body.items[0].user.id).toBe(a.user.id);

    await a.agent.post(`/api/v1/connections/${req.body.connection.id}/accept`).expect(404); // only addressee
    await b.agent.post(`/api/v1/connections/${req.body.connection.id}/accept`).expect(200);

    const list = await a.agent.get("/api/v1/connections").expect(200);
    expect(list.body.items[0].user.id).toBe(b.user.id);

    const feed = await a.agent.get("/api/v1/posts").expect(200);
    const contents = feed.body.items.map((p: { content: string }) => p.content);
    expect(contents).toContain("from b");
    expect(contents).not.toContain("from a stranger");

    const profile = await a.agent.get(`/api/v1/users/${b.user.id}`).expect(200);
    expect(profile.body.profile.connectionCount).toBe(1);
  });
});

describe("messaging", () => {
  let server: http.Server | undefined;

  afterEach(async () => {
    setIO(null);
    await new Promise<void>((r) => (server ? server.close(() => r()) : r()));
  });

  it("delivers messages and typing indicators in real time", async () => {
    server = http.createServer(app);
    const io = createSocketServer(server);
    await new Promise<void>((r) => server!.listen(0, r));
    const url = `http://localhost:${(server.address() as AddressInfo).port}`;

    const alice = await signUp({ firstName: "Alice" });
    const bob = await signUp({ firstName: "Bob" });

    const bobSocket = connect(url, { extraHeaders: { cookie: cookieHeader(bob.cookies) }, transports: ["websocket"] });
    const aliceSocket = connect(url, { extraHeaders: { cookie: cookieHeader(alice.cookies) }, transports: ["websocket"] });
    await Promise.all([
      new Promise((r) => bobSocket.on("connect", () => r(null))),
      new Promise((r) => aliceSocket.on("connect", () => r(null))),
    ]);

    const conv = await alice.agent.post("/api/v1/conversations").send({ userId: bob.user.id }).expect(200);
    const conversationId = conv.body.conversation.id as string;
    // Opening again returns the same conversation.
    const again = await bob.agent.post("/api/v1/conversations").send({ userId: alice.user.id }).expect(200);
    expect(again.body.conversation.id).toBe(conversationId);

    const typing = new Promise((r) => bobSocket.on("typing", r));
    aliceSocket.emit("typing", { conversationId, isTyping: true });
    expect(await typing).toEqual({ conversationId, userId: alice.user.id, isTyping: true });

    const received = new Promise((r) => bobSocket.on("message:new", r));
    await alice.agent.post(`/api/v1/conversations/${conversationId}/messages`).send({ content: "Hi Bob" }).expect(201);
    expect(await received).toMatchObject({ conversationId, content: "Hi Bob", senderId: alice.user.id });

    const history = await bob.agent.get(`/api/v1/conversations/${conversationId}/messages`).expect(200);
    expect(history.body.items[0].content).toBe("Hi Bob");

    // Outsiders can't read the conversation.
    const eve = await signUp();
    await eve.agent.get(`/api/v1/conversations/${conversationId}/messages`).expect(404);

    bobSocket.close();
    aliceSocket.close();
    io.close();
  });

  it("rejects sockets without a valid token", async () => {
    server = http.createServer(app);
    createSocketServer(server);
    await new Promise<void>((r) => server!.listen(0, r));
    const url = `http://localhost:${(server.address() as AddressInfo).port}`;
    const s = connect(url, { transports: ["websocket"] });
    const err = await new Promise<Error>((r) => s.on("connect_error", r));
    expect(err.message).toBe("UNAUTHORIZED");
    s.close();
  });
});

describe("profile banners", () => {
  it("accepts preset banners, rejects arbitrary URLs and can clear the banner", async () => {
    const { agent, user } = await signUp();
    const set = await agent.patch("/api/v1/users/me").send({ bannerUrl: "/banners/ocean.svg" }).expect(200);
    expect(set.body.user.id).toBe(user.id);
    expect((await agent.get(`/api/v1/users/${user.id}`)).body.profile.bannerUrl).toBe("/banners/ocean.svg");

    await agent.patch("/api/v1/users/me").send({ bannerUrl: "https://evil.example/x.png" }).expect(400);
    await agent.patch("/api/v1/users/me").send({ bannerUrl: "/banners/../../etc.svg" }).expect(400);

    await agent.patch("/api/v1/users/me").send({ bannerUrl: null }).expect(200);
    expect((await agent.get(`/api/v1/users/${user.id}`)).body.profile.bannerUrl).toBeNull();
  });
});

describe("search", () => {
  it("finds people, posts and companies with full-text search", async () => {
    const { agent } = await signUp({ firstName: "Grace", lastName: "Hopper" });
    await agent.patch("/api/v1/users/me").send({ headline: "Compiler engineer" }).expect(200);
    await agent.post("/api/v1/posts").field("content", "Shipping a new compiler optimisation today").expect(201);
    const { prisma } = await import("../src/lib/prisma.js");
    await prisma.company.create({ data: { name: "Quillstone Labs", slug: "quillstone-labs", industry: "Compilers and developer tools" } });

    const res = await agent.get("/api/v1/search?q=compiler").expect(200);
    expect(res.body.people[0].lastName).toBe("Hopper");
    expect(res.body.posts[0].author.firstName).toBe("Grace");
    expect(res.body.companies[0].name).toBe("Quillstone Labs");

    const people = await agent.get("/api/v1/search?q=grace&type=people").expect(200);
    expect(people.body.posts).toEqual([]);
    await agent.get("/api/v1/search?q=").expect(400);
  });
});
