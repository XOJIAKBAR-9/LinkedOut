import { describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import { signUp } from "./helpers.js";

describe("unread messages", () => {
  it("counts people with unread messages and clears when the conversation is opened", async () => {
    const me = await signUp();
    const ann = await signUp();
    const ben = await signUp();
    const unread = async () => (await me.agent.get("/api/v1/conversations/unread").expect(200)).body;
    expect(await unread()).toEqual({ conversations: 0, messages: 0 });

    const c1 = (await ann.agent.post("/api/v1/conversations").send({ userId: me.user.id }).expect(200)).body.conversation.id;
    await ann.agent.post(`/api/v1/conversations/${c1}/messages`).send({ content: "hi" }).expect(201);
    await ann.agent.post(`/api/v1/conversations/${c1}/messages`).send({ content: "are you there?" }).expect(201);
    expect(await unread()).toEqual({ conversations: 1, messages: 2 });

    const c2 = (await ben.agent.post("/api/v1/conversations").send({ userId: me.user.id }).expect(200)).body.conversation.id;
    await ben.agent.post(`/api/v1/conversations/${c2}/messages`).send({ content: "hello" }).expect(201);
    expect(await unread()).toEqual({ conversations: 2, messages: 3 }); // badge shows 2 (two people)

    // Per-conversation counts in the list; my own messages never count.
    const list = (await me.agent.get("/api/v1/conversations").expect(200)).body.items;
    expect(Object.fromEntries(list.map((c: { id: string; unreadCount: number }) => [c.id, c.unreadCount]))).toEqual({ [c1]: 2, [c2]: 1 });
    expect((await ann.agent.get("/api/v1/conversations/unread")).body).toEqual({ conversations: 0, messages: 0 });

    // Opening a conversation (loading its messages) marks it read.
    await me.agent.get(`/api/v1/conversations/${c1}/messages`).expect(200);
    expect(await unread()).toEqual({ conversations: 1, messages: 1 });
    await me.agent.post(`/api/v1/conversations/${c2}/read`).expect(204);
    expect(await unread()).toEqual({ conversations: 0, messages: 0 });

    // Outsiders can't mark someone else's conversation.
    await ann.agent.post(`/api/v1/conversations/${c2}/read`).expect(404);
  });
});

describe("search", () => {
  it("matches partial words, like 'xoji' for 'Xojiakbar'", async () => {
    const { agent } = await signUp({ firstName: "Xojiakbar", lastName: "Akramov" });
    const people = (await agent.get("/api/v1/search?q=xoji&type=people").expect(200)).body.people;
    expect(people.map((p: { firstName: string }) => p.firstName)).toContain("Xojiakbar");
    const both = (await agent.get("/api/v1/search?q=xoji%20akr&type=people").expect(200)).body.people;
    expect(both).toHaveLength(1);
    // Advanced syntax still works.
    expect((await agent.get('/api/v1/search?q="xojiakbar akramov"&type=people').expect(200)).body.people).toHaveLength(1);
  });

  it("suggests real people by name prefix and never sample accounts", async () => {
    const { agent } = await signUp({ firstName: "Sardor", lastName: "Gulomov" });
    await signUp({ firstName: "Sarah", lastName: "Connor" });
    await prisma.user.create({ data: { email: "fake@example.test", firstName: "Sarvar", lastName: "Sample", isSample: true } });

    const names = async (q: string) =>
      (await agent.get(`/api/v1/search/suggest?q=${encodeURIComponent(q)}`).expect(200)).body.people.map(
        (p: { firstName: string; lastName: string }) => `${p.firstName} ${p.lastName}`,
      );
    expect(await names("sar")).toEqual(["Sarah Connor", "Sardor Gulomov"]);
    expect(await names("SARD")).toEqual(["Sardor Gulomov"]);
    expect(await names("gul")).toEqual(["Sardor Gulomov"]); // last name
    expect(await names("sardor g")).toEqual(["Sardor Gulomov"]); // full name
    expect(await names("sarv")).toEqual([]); // sample account hidden
    expect(await names("%")).toEqual([]); // LIKE wildcards are escaped
    await agent.get("/api/v1/search/suggest?q=").expect(400);
  });
});
