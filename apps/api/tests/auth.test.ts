import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { mailer, outbox } from "../src/lib/mailer.js";
import { app, signUp } from "./helpers.js";

const tokenFromLastMail = () => {
  const link = outbox.at(-1)!.text.match(/https?:\/\/\S+/)![0];
  return new URL(link).searchParams.get("token")!;
};

describe("auth", () => {
  it("registers, sets httpOnly cookies and returns the user", async () => {
    const { user, cookies } = await signUp({ email: "ada@example.test" });
    expect(user.email).toBe("ada@example.test");
    expect(cookies.some((c) => c.startsWith("lo_access=") && c.includes("HttpOnly"))).toBe(true);
    expect(cookies.some((c) => c.startsWith("lo_refresh=") && c.includes("Path=/api/v1/auth"))).toBe(true);
  });

  it("rejects duplicate emails and weak passwords", async () => {
    await signUp({ email: "dup@example.test" });
    const dup = await request(app)
      .post("/api/v1/auth/register")
      .send({ firstName: "A", lastName: "B", email: "dup@example.test", password: "password123" })
      .expect(409);
    expect(dup.body.error.code).toBe("EMAIL_TAKEN");
    const weak = await request(app)
      .post("/api/v1/auth/register")
      .send({ firstName: "A", lastName: "B", email: "x@example.test", password: "short" })
      .expect(400);
    expect(weak.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("logs in with correct credentials only", async () => {
    await signUp({ email: "login@example.test" });
    const bad = await request(app).post("/api/v1/auth/login").send({ email: "login@example.test", password: "wrong-pass1" }).expect(401);
    expect(bad.body.error.code).toBe("INVALID_CREDENTIALS");
    await request(app).post("/api/v1/auth/login").send({ email: "nobody@example.test", password: "password123" }).expect(401);
    const res = await request(app).post("/api/v1/auth/login").send({ email: "LOGIN@example.test", password: "password123" }).expect(200);
    expect(res.body.user.email).toBe("login@example.test");
  });

  it("protects /me and rotates refresh tokens, detecting reuse", async () => {
    await request(app).get("/api/v1/auth/me").expect(401);
    const { agent, cookies } = await signUp();
    await agent.get("/api/v1/auth/me").expect(200);

    const oldRefresh = cookies.find((c) => c.startsWith("lo_refresh="))!.split(";")[0]!;
    await agent.post("/api/v1/auth/refresh").expect(200);
    // Replaying the old token is treated as theft: every session is revoked.
    await request(app).post("/api/v1/auth/refresh").set("Cookie", oldRefresh).expect(401);
    await agent.post("/api/v1/auth/refresh").expect(401);
  });

  it("logs out by revoking the refresh token", async () => {
    const { agent } = await signUp();
    await agent.post("/api/v1/auth/logout").expect(204);
    await agent.post("/api/v1/auth/refresh").expect(401);
  });

  it("verifies email with the emailed token", async () => {
    const { agent } = await signUp();
    const token = tokenFromLastMail();
    await request(app).post("/api/v1/auth/verify-email").send({ token }).expect(204);
    const me = await agent.get("/api/v1/auth/me").expect(200);
    expect(me.body.user.emailVerified).toBe(true);
    const reused = await request(app).post("/api/v1/auth/verify-email").send({ token }).expect(400); // single use
    expect(reused.body.error.code).toBe("INVALID_TOKEN");
  });

  it("still creates the account when the verification email can't be sent", async () => {
    const send = vi.spyOn(mailer, "send").mockRejectedValue(new Error("Invalid login: 535 Username and Password not accepted"));
    try {
      const res = await request(app)
        .post("/api/v1/auth/register")
        .send({ firstName: "Mail", lastName: "Down", email: "maildown@example.test", password: "password123" })
        .expect(201);
      expect(res.body.user.email).toBe("maildown@example.test");

      // Retrying sign-up now correctly says the email is taken, and logging in works.
      await request(app)
        .post("/api/v1/auth/register")
        .send({ firstName: "Mail", lastName: "Down", email: "maildown@example.test", password: "password123" })
        .expect(409);
      const agent = request.agent(app);
      await agent.post("/api/v1/auth/login").send({ email: "maildown@example.test", password: "password123" }).expect(200);

      // Resending reports the failure instead of pretending it worked.
      const resend = await agent.post("/api/v1/auth/resend-verification").expect(502);
      expect(resend.body.error.code).toBe("EMAIL_NOT_SENT");

      // Forgot-password answers the same as always.
      await request(app).post("/api/v1/auth/forgot-password").send({ email: "maildown@example.test" }).expect(204);
    } finally {
      send.mockRestore();
    }
  });

  it("resets the password and signs out other sessions", async () => {
    const { agent } = await signUp({ email: "reset@example.test" });
    await request(app).post("/api/v1/auth/forgot-password").send({ email: "reset@example.test" }).expect(204);
    const mail = outbox.at(-1)!;
    expect(mail.to).toBe("reset@example.test");
    expect(mail.html).toContain("Choose a new password");
    await request(app).post("/api/v1/auth/forgot-password").send({ email: "ghost@example.test" }).expect(204);
    await request(app).post("/api/v1/auth/reset-password").send({ token: tokenFromLastMail(), password: "newpassword9" }).expect(204);
    await agent.post("/api/v1/auth/refresh").expect(401);
    await request(app).post("/api/v1/auth/login").send({ email: "reset@example.test", password: "newpassword9" }).expect(200);
  });
});
