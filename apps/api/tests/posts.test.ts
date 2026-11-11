import { describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import { signUp } from "./helpers.js";

// 1x1 transparent PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

describe("posts", () => {
  it("creates a post with an image and shows it in the feed", async () => {
    const { agent } = await signUp();
    const created = await agent
      .post("/api/v1/posts")
      .field("content", "Hello LinkedOut")
      .attach("image", PNG, { filename: "dot.png", contentType: "image/png" })
      .expect(201);
    expect(created.body.post.imageUrl).toMatch(/\/uploads\/posts\/.+\.png$/);

    const feed = await agent.get("/api/v1/posts").expect(200);
    expect(feed.body.items.map((p: { content: string }) => p.content)).toContain("Hello LinkedOut");
  });

  it("rejects empty posts and non-image uploads", async () => {
    const { agent } = await signUp();
    await agent.post("/api/v1/posts").field("content", "   ").expect(400);
    await agent
      .post("/api/v1/posts")
      .field("content", "hi")
      .attach("image", Buffer.from("not an image"), { filename: "x.txt", contentType: "text/plain" })
      .expect(400);
  });

  it("paginates the feed with a cursor", async () => {
    const { agent, user } = await signUp();
    for (let i = 0; i < 5; i++) {
      await prisma.post.create({ data: { authorId: user.id, content: `post ${i}`, createdAt: new Date(Date.now() - i * 1000) } });
    }
    const first = await agent.get("/api/v1/posts?limit=3").expect(200);
    expect(first.body.items).toHaveLength(3);
    expect(first.body.nextCursor).toBeTruthy();
    const second = await agent.get(`/api/v1/posts?limit=3&cursor=${first.body.nextCursor}`).expect(200);
    expect(second.body.items.map((p: { content: string }) => p.content)).toEqual(["post 3", "post 4"]);
    expect(second.body.nextCursor).toBeNull();
  });

  it("reacts, comments and notifies the author", async () => {
    const author = await signUp();
    const reader = await signUp();
    const { body } = await author.agent.post("/api/v1/posts").field("content", "Big news").expect(201);
    const postId = body.post.id as string;

    const reacted = await reader.agent.put(`/api/v1/posts/${postId}/reaction`).send({ type: "RESPECT" }).expect(200);
    expect(reacted.body.post).toMatchObject({ reactionCount: 1, myReaction: "RESPECT" });
    // Changing the reaction type keeps one reaction per user.
    const changed = await reader.agent.put(`/api/v1/posts/${postId}/reaction`).send({ type: "SAME" }).expect(200);
    expect(changed.body.post).toMatchObject({ reactionCount: 1, myReaction: "SAME" });

    await reader.agent.post(`/api/v1/posts/${postId}/comments`).send({ content: "Congrats!" }).expect(201);
    const comments = await author.agent.get(`/api/v1/posts/${postId}/comments`).expect(200);
    expect(comments.body.items[0].content).toBe("Congrats!");

    const notes = await author.agent.get("/api/v1/notifications").expect(200);
    expect(notes.body.unread).toBe(2);
    expect(notes.body.items.map((n: { type: string }) => n.type).sort()).toEqual(["COMMENT", "REACTION"]);
  });

  it("threads replies one level deep and notifies the person replied to", async () => {
    const author = await signUp({ firstName: "Author" });
    const alice = await signUp({ firstName: "Alice" });
    const bob = await signUp({ firstName: "Bob" });
    const { body } = await author.agent.post("/api/v1/posts").field("content", "Thoughts?").expect(201);
    const postId = body.post.id as string;

    const top = (await alice.agent.post(`/api/v1/posts/${postId}/comments`).send({ content: "Great post" }).expect(201)).body.comment;
    const reply = (await bob.agent.post(`/api/v1/posts/${postId}/comments`).send({ content: "Agreed", parentId: top.id }).expect(201)).body.comment;
    expect(reply).toMatchObject({ parentId: top.id, replyTo: { id: alice.user.id }, replyCount: 0 });

    // Replying to a reply stays in the same thread and points at the reply's author.
    const nested = (await alice.agent.post(`/api/v1/posts/${postId}/comments`).send({ content: "Thanks Bob", parentId: reply.id }).expect(201)).body.comment;
    expect(nested).toMatchObject({ parentId: top.id, replyTo: { id: bob.user.id } });

    const topLevel = await author.agent.get(`/api/v1/posts/${postId}/comments`).expect(200);
    expect(topLevel.body.items).toHaveLength(1);
    expect(topLevel.body.items[0]).toMatchObject({ id: top.id, replyCount: 2, parentId: null });

    const replies = await author.agent.get(`/api/v1/posts/${postId}/comments?parentId=${top.id}`).expect(200);
    expect(replies.body.items.map((c: { content: string }) => c.content)).toEqual(["Agreed", "Thanks Bob"]);

    // Post comment count includes replies.
    expect((await author.agent.get(`/api/v1/posts/${postId}`)).body.post.commentCount).toBe(3);

    const types = async (agent: typeof alice.agent) =>
      (await agent.get("/api/v1/notifications")).body.items.map((n: { type: string }) => n.type).sort();
    expect(await types(alice.agent)).toEqual(["REPLY"]); // Bob replied to Alice
    expect(await types(bob.agent)).toEqual(["REPLY"]); // Alice replied to Bob
    expect(await types(author.agent)).toEqual(["COMMENT", "COMMENT", "COMMENT"]);
  });

  it("notifications point at the exact post, comment and thread, and vanish with the post", async () => {
    const author = await signUp();
    const alice = await signUp();
    const bob = await signUp();
    const postId = (await author.agent.post("/api/v1/posts").field("content", "Hi").expect(201)).body.post.id;
    await alice.agent.put(`/api/v1/posts/${postId}/reaction`).send({ type: "SAME" }).expect(200);
    const top = (await alice.agent.post(`/api/v1/posts/${postId}/comments`).send({ content: "Top" }).expect(201)).body.comment;
    const reply = (await bob.agent.post(`/api/v1/posts/${postId}/comments`).send({ content: "Re", parentId: top.id }).expect(201)).body.comment;

    const mine = (await author.agent.get("/api/v1/notifications")).body;
    const byType = (type: string) => mine.items.filter((n: { type: string }) => n.type === type);
    expect(byType("REACTION")[0]).toMatchObject({ postId, commentId: null, threadId: null });
    // Two COMMENT notifications: Alice's top-level comment and Bob's reply (a reply inside Alice's thread).
    expect(byType("COMMENT")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ postId, commentId: top.id, threadId: null }),
        expect.objectContaining({ postId, commentId: reply.id, threadId: top.id }),
      ]),
    );
    const aliceReply = (await alice.agent.get("/api/v1/notifications")).body.items[0];
    expect(aliceReply).toMatchObject({ type: "REPLY", postId, commentId: reply.id, threadId: top.id });

    // Mark a single notification as read; other users can't touch it.
    await bob.agent.post(`/api/v1/notifications/${aliceReply.id}/read`).expect(204);
    expect((await alice.agent.get("/api/v1/notifications")).body.unread).toBe(1);
    await alice.agent.post(`/api/v1/notifications/${aliceReply.id}/read`).expect(204);
    expect((await alice.agent.get("/api/v1/notifications")).body.unread).toBe(0);

    await author.agent.delete(`/api/v1/posts/${postId}`).expect(204);
    expect((await author.agent.get("/api/v1/notifications")).body.items).toEqual([]);
  });

  it("rejects replies to comments on other posts and deletes replies with their thread", async () => {
    const { agent } = await signUp();
    const p1 = (await agent.post("/api/v1/posts").field("content", "one").expect(201)).body.post.id;
    const p2 = (await agent.post("/api/v1/posts").field("content", "two").expect(201)).body.post.id;
    const c1 = (await agent.post(`/api/v1/posts/${p1}/comments`).send({ content: "on one" }).expect(201)).body.comment;
    await agent.post(`/api/v1/posts/${p2}/comments`).send({ content: "wrong post", parentId: c1.id }).expect(404);
    await agent.post(`/api/v1/posts/${p1}/comments`).send({ content: "x", parentId: "missing" }).expect(404);

    await agent.post(`/api/v1/posts/${p1}/comments`).send({ content: "reply", parentId: c1.id }).expect(201);
    await agent.delete(`/api/v1/posts/${p1}/comments/${c1.id}`).expect(204);
    expect((await agent.get(`/api/v1/posts/${p1}`)).body.post.commentCount).toBe(0);
  });

  it("only lets the author delete a post", async () => {
    const author = await signUp();
    const other = await signUp();
    const { body } = await author.agent.post("/api/v1/posts").field("content", "Mine").expect(201);
    await other.agent.delete(`/api/v1/posts/${body.post.id}`).expect(403);
    await author.agent.delete(`/api/v1/posts/${body.post.id}`).expect(204);
    await author.agent.get(`/api/v1/posts/${body.post.id}`).expect(404);
  });
});
