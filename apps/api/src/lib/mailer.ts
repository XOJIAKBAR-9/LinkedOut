import nodemailer, { type Transporter } from "nodemailer";
import { env, isTest, smtpEnabled } from "../config/env.js";
import { logger } from "./logger.js";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

/** Every message the app tried to send, newest last. Used by tests; capped so it can't grow forever. */
export const outbox: MailMessage[] = [];
const record = (m: MailMessage) => {
  outbox.push(m);
  if (outbox.length > 50) outbox.shift();
};

/** Used when SMTP isn't configured: prints the email (including any links) to the API console. */
export class ConsoleMailer implements Mailer {
  async send(message: MailMessage): Promise<void> {
    record(message);
    logger.info(
      { to: message.to, subject: message.subject },
      `\n📧 ${message.subject} (not actually sent: SMTP is not configured)\n${message.text}\n`,
    );
  }
}

/** Sends real email through any SMTP server (Gmail, Mailgun, Resend, SES, …). */
export class SmtpMailer implements Mailer {
  constructor(
    private readonly transport: Transporter,
    private readonly from: string,
  ) {}

  async send(message: MailMessage): Promise<void> {
    record(message);
    const info = await this.transport.sendMail({ from: this.from, ...message });
    logger.info({ to: message.to, subject: message.subject, messageId: info.messageId }, "email sent");
  }

  /** Checks the connection and credentials; logs a clear error instead of failing silently later. */
  async verify(): Promise<boolean> {
    try {
      await this.transport.verify();
      logger.info(`SMTP ready (${env.SMTP_HOST}:${env.SMTP_PORT}) — emails will be delivered`);
      return true;
    } catch (err) {
      logger.error({ err }, `SMTP connection to ${env.SMTP_HOST}:${env.SMTP_PORT} failed — check SMTP_* in apps/api/.env`);
      return false;
    }
  }
}

export function createSmtpTransport(): Transporter {
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE, // true for port 465, false for 587 (STARTTLS)
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
}

export const mailer: Mailer =
  smtpEnabled && !isTest ? new SmtpMailer(createSmtpTransport(), env.MAIL_FROM) : new ConsoleMailer();

/**
 * Sends without letting a mail failure break the request. Used for password reset
 * (the endpoint must answer the same way whether or not the email exists or sending fails).
 */
export async function sendSafely(message: MailMessage): Promise<boolean> {
  try {
    await mailer.send(message);
    return true;
  } catch (err) {
    logger.error({ err, to: message.to, subject: message.subject }, "email could not be sent");
    return false;
  }
}

/** Small, inline-styled HTML email with one call-to-action button (works in Gmail/Outlook). */
export function actionEmail(opts: { heading: string; body: string; button: string; url: string; footer: string }) {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#ffffff;border-radius:12px;padding:32px" cellpadding="0" cellspacing="0">
<tr><td style="font-size:22px;font-weight:800;padding-bottom:24px">Linked<span style="color:#0d9488">Out</span></td></tr>
<tr><td style="font-size:18px;font-weight:700;padding-bottom:12px">${esc(opts.heading)}</td></tr>
<tr><td style="font-size:15px;line-height:1.5;padding-bottom:24px">${esc(opts.body)}</td></tr>
<tr><td style="padding-bottom:24px"><a href="${esc(opts.url)}" style="display:inline-block;background:#0d9488;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:8px">${esc(opts.button)}</a></td></tr>
<tr><td style="font-size:12px;color:#64748b;line-height:1.5">${esc(opts.footer)}<br><br><a href="${esc(opts.url)}" style="color:#64748b;word-break:break-all">${esc(opts.url)}</a></td></tr>
</table></td></tr></table></body></html>`;
}
