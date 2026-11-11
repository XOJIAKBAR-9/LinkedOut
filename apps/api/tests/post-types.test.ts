import { describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import { signUp } from "./helpers.js";

describe("typed posts", () => {
  it("creates an 'I quit' story with structured fields and links a known company", async () => {
    const { agent } = await signUp();
    await prisma.company.create({ data: { name: "Quillstone Labs", slug: "quillstone-labs" } });
    const res = await agent
      .post("/api/v1/posts")
      .field("type", "QUIT")
      .field("headline", "Families pay overtime.")
      .field("content", "Two years of 'we are a family'.")
      .field("companyName", "quillstone labs")
      .field("role", "Backend engineer")
      .field("tenureMonths", "27")
      .field("reasons", JSON.stringify(["unpaid_overtime", "burnout"]))
      .expect(201);
    expect(res.body.post).toMatchObject({
      type: "QUIT",
      headline: "Families pay overtime.",
      companyName: "quillstone labs",
      company: { name: "Quillstone Labs", slug: "quillstone-labs" },
      role: "Backend engineer",
      tenureMonths: 27,
      reasons: ["unpaid_overtime", "burnout"],
      anonymous: false,
      isMine: true,
      reactionCounts: { RESPECT: 0, SAME: 0, RUN: 0, FUNNY: 0 },
    });
  });

  it("requires a company on typed posts, limits reasons and ignores exit fields on updates", async () => {
    const { agent } = await signUp();
    const noCompany = await agent.post("/api/v1/posts").field("type", "WARNING").field("content", "Avoid").expect(400);
    expect(noCompany.body.error.code).toBe("VALIDATION_ERROR");
    await agent
      .post("/api/v1/posts")
      .field("type", "QUIT")
      .field("content", "x")
      .field("companyName", "Acme")
      .field("reasons", "burnout,low_pay,chaos,layoffs,other")
      .expect(400);
    await agent.post("/api/v1/posts").field("type", "QUIT").field("content", "x").field("companyName", "Acme").field("reasons", "not_a_reason").expect(400);
    const update = (await agent.post("/api/v1/posts").field("content", "Hello").field("companyName", "Acme").expect(201)).body.post;
    expect(update).toMatchObject({ type: "UPDATE", companyName: null, reasons: [] });
  });

  it("hides the author of anonymous posts from everyone else, everywhere", async () => {
    const me = await signUp({ firstName: "Secret", lastName: "Quitter" });
    const other = await signUp();
    const post = (
      await me.agent
        .post("/api/v1/posts")
        .field("type", "RED_FLAG")
        .field("content", "Unpaid 8-hour test task, zephyrcanary")
        .field("companyName", "Acme")
        .field("anonymous", "true")
        .expect(201)
    ).body.post;
    expect(post).toMatchObject({ anonymous: true, isMine: true, author: { id: me.user.id } }); // I still see it's mine

    const seen = (await other.agent.get(`/api/v1/posts/${post.id}`).expect(200)).body.post;
    expect(seen).toMatchObject({ anonymous: true, isMine: false, author: null });
    expect(JSON.stringify(seen)).not.toContain(me.user.id);

    const feed = (await other.agent.get("/api/v1/posts").expect(200)).body.items;
    expect(feed.find((p: { id: string }) => p.id === post.id).author).toBeNull();
    // Not listed on my public profile for others, but listed for me.
    expect((await other.agent.get(`/api/v1/users/${me.user.id}/posts`)).body.items).toEqual([]);
    expect((await me.agent.get(`/api/v1/users/${me.user.id}/posts`)).body.items).toHaveLength(1);
    // Search can't unmask it either.
    const found = (await other.agent.get("/api/v1/search?q=zephyrcanary&type=posts").expect(200)).body.posts;
    expect(found).toHaveLength(1);
    expect(found[0].author).toBeNull();
  });

  it("shows quit stories and warnings from outside your network in the feed", async () => {
    const a = await signUp();
    const b = await signUp();
    const stranger = await signUp();
    const conn = (await a.agent.post(`/api/v1/users/${b.user.id}/connect`).expect(201)).body.connection;
    await b.agent.post(`/api/v1/connections/${conn.id}/accept`).expect(200);
    await stranger.agent.post("/api/v1/posts").field("content", "stranger update").expect(201);
    await stranger.agent.post("/api/v1/posts").field("type", "QUIT").field("content", "stranger quit").field("companyName", "Acme").expect(201);
    const contents = (await a.agent.get("/api/v1/posts").expect(200)).body.items.map((p: { content: string }) => p.content);
    expect(contents).toContain("stranger quit");
    expect(contents).not.toContain("stranger update");
  });

  it("counts each themed reaction separately", async () => {
    const author = await signUp();
    const fans = await Promise.all([signUp(), signUp(), signUp()]);
    const id = (await author.agent.post("/api/v1/posts").field("content", "I quit!").expect(201)).body.post.id;
    await fans[0]!.agent.put(`/api/v1/posts/${id}/reaction`).send({ type: "RESPECT" }).expect(200);
    await fans[1]!.agent.put(`/api/v1/posts/${id}/reaction`).send({ type: "RESPECT" }).expect(200);
    const last = (await fans[2]!.agent.put(`/api/v1/posts/${id}/reaction`).send({ type: "RUN" }).expect(200)).body.post;
    expect(last).toMatchObject({ reactionCount: 3, reactionCounts: { RESPECT: 2, SAME: 0, RUN: 1, FUNNY: 0 }, myReaction: "RUN" });
    await fans[0]!.agent.put(`/api/v1/posts/${id}/reaction`).send({ type: "LIKE" }).expect(400); // old type is gone
  });
});

describe("feed insights", () => {
  it("ranks most-warned companies this week, trending reasons, and my quit counter", async () => {
    const me = await signUp();
    const p = (type: string, company: string, reasons: string[] = []) =>
      me.agent.post("/api/v1/posts").field("type", type).field("content", "x").field("companyName", company).field("reasons", reasons.join(",")).expect(201);
    await p("WARNING", "Acme");
    await p("RED_FLAG", "acme"); // same company, different case
    await p("WARNING", "Globex");
    const old = (await p("WARNING", "Initech")).body.post.id;
    await prisma.post.update({ where: { id: old }, data: { createdAt: new Date(Date.now() - 10 * 24 * 3600 * 1000) } });
    await p("QUIT", "Acme", ["burnout", "low_pay"]);
    await p("QUIT", "Globex", ["burnout"]);

    const res = (await me.agent.get("/api/v1/posts/insights").expect(200)).body;
    expect(res.mostWarned.map((w: { name: string; count: number }) => [w.name.toLowerCase(), w.count])).toEqual([
      ["acme", 2],
      ["globex", 1],
    ]); // Initech is older than a week
    expect(res.trendingReasons).toEqual([{ reason: "burnout", count: 2 }, { reason: "low_pay", count: 1 }]);
    expect(res.me).toMatchObject({ quitCount: 2, lastQuitCompany: "Globex" });
    expect(new Date(res.me.lastQuitAt).getTime()).toBeGreaterThan(Date.now() - 60_000);
  });
});
