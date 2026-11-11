import fs from "node:fs";
import path from "node:path";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import { uploadRoot } from "../src/lib/storage.js";
import { app, signUp } from "./helpers.js";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);
const fileFor = (url: string) => path.join(uploadRoot, url.split("/uploads/")[1]!);

describe("delete account", () => {
  it("requires login and the correct password", async () => {
    await request(app).delete("/api/v1/auth/account").send({ password: "password123" }).expect(401);
    const { agent } = await signUp();
    await agent.delete("/api/v1/auth/account").send({}).expect(400);
    const wrong = await agent.delete("/api/v1/auth/account").send({ password: "not-my-password1" }).expect(403);
    expect(wrong.body.error.code).toBe("WRONG_PASSWORD");
    await agent.get("/api/v1/auth/me").expect(200); // still there
  });

  it("removes the account, its data and uploaded files, and signs it out", async () => {
    const me = await signUp({ email: "leaving@example.test" });
    const friend = await signUp();

    // Data owned by the user…
    const avatar = (await me.agent.post("/api/v1/users/me/avatar").attach("image", PNG, { filename: "a.png", contentType: "image/png" }).expect(200)).body.user.avatarUrl;
    const post = (await me.agent.post("/api/v1/posts").field("content", "bye").attach("image", PNG, { filename: "p.png", contentType: "image/png" }).expect(201)).body.post;
    expect(fs.existsSync(fileFor(avatar)) && fs.existsSync(fileFor(post.imageUrl))).toBe(true);

    // …and data touching other people.
    const friendPost = (await friend.agent.post("/api/v1/posts").field("content", "hello").expect(201)).body.post;
    await me.agent.put(`/api/v1/posts/${friendPost.id}/reaction`).send({ type: "SAME" }).expect(200);
    await me.agent.post(`/api/v1/posts/${friendPost.id}/comments`).send({ content: "nice" }).expect(201);
    const conn = (await me.agent.post(`/api/v1/users/${friend.user.id}/connect`).expect(201)).body.connection;
    await friend.agent.post(`/api/v1/connections/${conn.id}/accept`).expect(200);
    const conv = (await me.agent.post("/api/v1/conversations").send({ userId: friend.user.id }).expect(200)).body.conversation;
    await me.agent.post(`/api/v1/conversations/${conv.id}/messages`).send({ content: "hi" }).expect(201);
    const group = await prisma.group.create({
      data: { name: "Leavers", slug: "leavers", ownerId: me.user.id, members: { create: [{ userId: me.user.id, role: "ADMIN" }, { userId: friend.user.id }] } },
    });

    const res = await me.agent.delete("/api/v1/auth/account").send({ password: me.password }).expect(204);
    const cookies = res.headers["set-cookie"] as unknown as string[];
    expect(cookies.some((c) => c.startsWith("lo_access=;"))).toBe(true);

    // Signed out and can't log back in.
    await me.agent.get("/api/v1/auth/me").expect(401);
    await request(app).post("/api/v1/auth/login").send({ email: "leaving@example.test", password: me.password }).expect(401);

    // Nothing left in the database.
    const id = me.user.id;
    expect(await prisma.user.count({ where: { id } })).toBe(0);
    expect(await prisma.post.count({ where: { authorId: id } })).toBe(0);
    expect(await prisma.comment.count({ where: { authorId: id } })).toBe(0);
    expect(await prisma.reaction.count({ where: { userId: id } })).toBe(0);
    expect(await prisma.connection.count({ where: { OR: [{ requesterId: id }, { addresseeId: id }] } })).toBe(0);
    expect(await prisma.message.count({ where: { senderId: id } })).toBe(0);
    expect(await prisma.refreshToken.count({ where: { userId: id } })).toBe(0);
    expect(await prisma.notification.count({ where: { OR: [{ actorId: id }, { recipientId: id }] } })).toBe(0);
    expect(await prisma.conversation.count({ where: { id: conv.id } })).toBe(0);

    // The friend's post survives, with the reaction and comment gone; the group has a new owner.
    const fp = (await friend.agent.get(`/api/v1/posts/${friendPost.id}`).expect(200)).body.post;
    expect(fp).toMatchObject({ reactionCount: 0, commentCount: 0 });
    expect((await prisma.group.findUniqueOrThrow({ where: { id: group.id } })).ownerId).toBe(friend.user.id);
    expect((await friend.agent.get("/api/v1/notifications")).body.items).toEqual([]);

    // Uploaded files are deleted from disk.
    expect(fs.existsSync(fileFor(avatar))).toBe(false);
    expect(fs.existsSync(fileFor(post.imageUrl))).toBe(false);

    // The email can be used for a new account.
    await signUp({ email: "leaving@example.test" });
  });

  it("lets GitHub-only accounts confirm with their email", async () => {
    const u = await prisma.user.create({ data: { email: "gh@example.test", githubId: "42", firstName: "Git", lastName: "Hub", emailVerified: true } });
    const { createSession } = await import("../src/services/auth.service.js");
    const { accessToken } = await createSession(u.id);
    const auth = { Authorization: `Bearer ${accessToken}` };
    const me = await request(app).get("/api/v1/auth/me").set(auth).expect(200);
    expect(me.body.user.hasPassword).toBe(false);
    await request(app).delete("/api/v1/auth/account").set(auth).send({ email: "other@example.test" }).expect(403);
    await request(app).delete("/api/v1/auth/account").set(auth).send({ email: "GH@example.test" }).expect(204);
    expect(await prisma.user.count({ where: { id: u.id } })).toBe(0);
  });
});
