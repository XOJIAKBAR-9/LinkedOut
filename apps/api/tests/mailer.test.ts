import type { AddressInfo } from "node:net";
import nodemailer from "nodemailer";
import { SMTPServer } from "smtp-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SmtpMailer, actionEmail } from "../src/lib/mailer.js";

/** A throwaway in-process SMTP server that records what it receives. */
let server: SMTPServer;
let port: number;
const received: { from: string; to: string[]; raw: string }[] = [];

beforeAll(async () => {
  server = new SMTPServer({
    authOptional: true,
    disabledCommands: ["STARTTLS"],
    onAuth(auth, _session, cb) {
      if (auth.username === "user" && auth.password === "secret") cb(null, { user: "user" });
      else cb(new Error("Invalid login"));
    },
    onData(stream, session, cb) {
      let raw = "";
      stream.on("data", (c: Buffer) => (raw += c.toString()));
      stream.on("end", () => {
        received.push({
          from: session.envelope.mailFrom ? session.envelope.mailFrom.address : "",
          to: session.envelope.rcptTo.map((r) => r.address),
          raw,
        });
        cb();
      });
    },
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.server.address() as AddressInfo).port;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

const transport = (pass: string) =>
  nodemailer.createTransport({ host: "127.0.0.1", port, secure: false, ignoreTLS: true, auth: { user: "user", pass } });

describe("SmtpMailer", () => {
  it("delivers a password-reset email with text and HTML parts", async () => {
    const mailer = new SmtpMailer(transport("secret"), "LinkedOut <no-reply@linkedout.test>");
    expect(await mailer.verify()).toBe(true);

    const url = "http://localhost:5173/reset-password?token=abc123";
    await mailer.send({
      to: "someone@example.test",
      subject: "Reset your LinkedOut password",
      text: `Reset your password: ${url}`,
      html: actionEmail({ heading: "Reset", body: "Body", button: "Choose a new password", url, footer: "Footer" }),
    });

    const mail = received.at(-1)!;
    expect(mail.from).toBe("no-reply@linkedout.test");
    expect(mail.to).toEqual(["someone@example.test"]);
    expect(mail.raw).toContain("Subject: Reset your LinkedOut password");
    expect(mail.raw).toContain("text/html");
    expect(mail.raw.replace(/=\r\n/g, "")).toContain("reset-password?token=abc123");
  });

  it("reports bad credentials instead of failing silently", async () => {
    const mailer = new SmtpMailer(transport("wrong"), "LinkedOut <no-reply@linkedout.test>");
    expect(await mailer.verify()).toBe(false);
    await expect(mailer.send({ to: "x@example.test", subject: "s", text: "t" })).rejects.toThrow();
  });

  it("escapes HTML in email content", () => {
    const html = actionEmail({ heading: "<script>", body: "a & b", button: "Go", url: "http://x/?a=1&b=2", footer: "" });
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("a &amp; b");
    expect(html).not.toContain("<script>");
  });
});
