import crypto from "node:crypto";
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import db from "./db.js";
import { emailStatus, resetMessage, sendEmail, verificationMessage } from "./emailService.js";

const router = express.Router();
const secret = process.env.SESSION_SECRET || (process.env.NODE_ENV === "production" ? "" : "development-only-change-me");
if (process.env.NODE_ENV === "production" && secret.length < 32) throw new Error("SESSION_SECRET must be configured with at least 32 characters in production.");
const publicUrl = process.env.PUBLIC_APP_URL || "http://localhost:5173";
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });
const tokenHash = (value) => crypto.createHash("sha256").update(value).digest("hex");
const now = () => new Date().toISOString();

function issueSession(res, user) {
  const token = jwt.sign({ sub: user.id, workspaceId: user.workspace_id, role: user.role }, secret, { expiresIn: "7d" });
  res.cookie("recoverai_session", token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 7 * 24 * 60 * 60 * 1000 });
}

function userRecord(id) {
  return db.prepare(`SELECT u.id, u.email, u.full_name, u.provider, u.provider_id, u.profile_picture, u.email_verified_at, u.created_at, wm.workspace_id, wm.role FROM users u JOIN workspace_members wm ON wm.user_id = u.id WHERE u.id = ?`).get(id);
}

function requireUser(req, res, next) {
  try {
    const token = req.cookies.recoverai_session;
    const payload = jwt.verify(token, secret);
    const user = userRecord(payload.sub);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    req.user = user;
    next();
  } catch { res.status(401).json({ error: "Unauthorized" }); }
}

async function createToken(userId, type) {
  const raw = crypto.randomBytes(32).toString("hex");
  db.prepare("INSERT INTO email_tokens (token_hash, user_id, type, expires_at, created_at) VALUES (?, ?, ?, ?, ?)").run(tokenHash(raw), userId, type, new Date(Date.now() + 60 * 60 * 1000).toISOString(), now());
  return raw;
}

router.post("/register", authLimiter, async (req, res) => {
  const { email, password, fullName } = req.body || {};
  if (!/^\S+@\S+\.\S+$/.test(email || "") || typeof fullName !== "string" || fullName.trim().length < 2 || typeof password !== "string" || password.length < 10) return res.status(400).json({ error: "Enter a valid name, email, and password of at least 10 characters." });
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(email.trim())) return res.status(409).json({ error: "An account with those details already exists." });
  const userId = crypto.randomUUID();
  const workspaceId = crypto.randomUUID();
  const timestamp = now();
  const transaction = db.transaction(() => {
    db.prepare("INSERT INTO users (id, email, full_name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)").run(userId, email.trim().toLowerCase(), fullName.trim(), bcrypt.hashSync(password, 12), timestamp);
    db.prepare("INSERT INTO workspaces (id, name, created_at) VALUES (?, ?, ?)").run(workspaceId, `${fullName.trim()}'s workspace`, timestamp);
    db.prepare("INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, 'admin')").run(workspaceId, userId);
  });
  transaction();
  const raw = await createToken(userId, "verify");
  const verificationUrl = `${publicUrl}/verify-email?token=${raw}`;
  const emailResult = await sendEmail({ to: email, ...verificationMessage(verificationUrl) });
  res.status(201).json({ user: userRecord(userId), email: emailResult, developmentVerificationUrl: emailResult.status === "PREVIEW" ? verificationUrl : undefined });
});

router.post("/login", authLimiter, (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(String(email || "").trim().toLowerCase());
  if (!user || !user.password_hash || !bcrypt.compareSync(String(password || ""), user.password_hash)) return res.status(401).json({ error: "Email or password is incorrect." });
  if (!user.email_verified_at) return res.status(403).json({ error: "Please verify your email before signing in." });
  const profile = userRecord(user.id);
  issueSession(res, profile);
  res.json({ user: profile });
});

router.post("/logout", (req, res) => { res.clearCookie("recoverai_session"); res.status(204).end(); });
router.get("/me", requireUser, (req, res) => res.json({ user: req.user }));
router.get("/email-status", (_req, res) => res.json(emailStatus()));

router.get("/verify", async (req, res) => {
  const record = db.prepare("SELECT * FROM email_tokens WHERE token_hash = ? AND type = 'verify' AND used_at IS NULL").get(tokenHash(String(req.query.token || "")));
  if (!record || record.expires_at < now()) return res.status(400).json({ error: "This verification link is invalid or expired." });
  db.transaction(() => {
    db.prepare("UPDATE email_tokens SET used_at = ? WHERE token_hash = ?").run(now(), record.token_hash);
    db.prepare("UPDATE users SET email_verified_at = ? WHERE id = ?").run(now(), record.user_id);
  })();
  res.json({ message: "Email verified. You can now sign in." });
});

router.post("/resend-verification", authLimiter, async (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(String(req.body?.email || "").trim().toLowerCase());
  if (!user || user.email_verified_at) return res.json({ message: "If the account requires verification, a new message will be sent." });
  const raw = await createToken(user.id, "verify");
  const url = `${publicUrl}/verify-email?token=${raw}`;
  const email = await sendEmail({ to: user.email, ...verificationMessage(url) });
  res.json({ message: "Verification request processed.", email, developmentVerificationUrl: email.status === "PREVIEW" ? url : undefined });
});

router.post("/forgot-password", authLimiter, async (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(String(req.body?.email || "").trim().toLowerCase());
  if (user) {
    const raw = await createToken(user.id, "reset");
    const url = `${publicUrl}/reset-password?token=${raw}`;
    await sendEmail({ to: user.email, ...resetMessage(url) });
  }
  res.json({ message: "If an account matches, password reset instructions will be sent." });
});

router.post("/reset-password", authLimiter, (req, res) => {
  const { token, password } = req.body || {};
  const record = db.prepare("SELECT * FROM email_tokens WHERE token_hash = ? AND type = 'reset' AND used_at IS NULL").get(tokenHash(String(token || "")));
  if (!record || record.expires_at < now() || typeof password !== "string" || password.length < 10) return res.status(400).json({ error: "This reset request is invalid or expired." });
  db.transaction(() => {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(bcrypt.hashSync(password, 12), record.user_id);
    db.prepare("UPDATE email_tokens SET used_at = ? WHERE token_hash = ?").run(now(), record.token_hash);
  })();
  res.json({ message: "Password successfully updated." });
});

export { requireUser };
export default router;
