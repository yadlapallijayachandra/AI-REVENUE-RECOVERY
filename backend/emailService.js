import fs from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";

const configured = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.EMAIL_FROM);
const outbox = path.resolve(process.cwd(), "data", "email-outbox");

function transport() {
  if (!configured) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
}

export function emailStatus() {
  return { configured, provider: configured ? (process.env.EMAIL_PROVIDER || "smtp") : "development-log" };
}

export async function sendEmail({ to, subject, text, html }) {
  const sender = process.env.EMAIL_FROM || "RecoverAI <no-reply@recoverai.local>";
  if (!configured) {
    await fs.mkdir(outbox, { recursive: true });
    const filename = `${Date.now()}-${to.replace(/[^a-z0-9]/gi, "_")}.json`;
    const preview = { status: "DEVELOPMENT_PREVIEW", to, subject, text, html, createdAt: new Date().toISOString() };
    await fs.writeFile(path.join(outbox, filename), JSON.stringify(preview, null, 2));
    return { status: "PREVIEW", previewPath: path.join("data", "email-outbox", filename) };
  }
  const info = await transport().sendMail({ from: sender, to, subject, text, html });
  return { status: "SENT", messageId: info.messageId };
}

export function verificationMessage(url) {
  return { subject: "Verify your RecoverAI account", text: `Verify your account: ${url}`, html: `<p>Verify your RecoverAI account.</p><p><a href="${url}">Verify email</a></p>` };
}

export function resetMessage(url) {
  return { subject: "Reset your RecoverAI password", text: `Reset your password: ${url}`, html: `<p>Reset your RecoverAI password.</p><p><a href="${url}">Reset password</a></p>` };
}
