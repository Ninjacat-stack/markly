import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Minimal local auth (Phase 9). Users live in memory in dev; Mongo persistence
// is best-effort when connected. Set AUTH_REQUIRED=1 to enforce tokens on
// write endpoints; otherwise the API runs open for local development.

const users = new Map(); // email -> { id, email, name, passwordHash, tenantIds }

function secret() {
  if (!process.env.JWT_SECRET) {
    console.warn("[auth] JWT_SECRET not set — using insecure dev default. Set it in production.");
  }
  return process.env.JWT_SECRET ?? "dev-only-insecure-secret";
}

export async function registerUser({ email, password, name }) {
  const key = String(email ?? "").toLowerCase().trim();
  if (!key.includes("@")) throw new Error("Valid email is required");
  if (!password || String(password).length < 8) throw new Error("Password must be at least 8 chars");
  if (users.has(key)) throw new Error("Email already registered");
  const passwordHash = await bcrypt.hash(String(password), 10);
  const user = { id: `usr_${Date.now()}`, email: key, name: name ?? "", passwordHash, tenantIds: [] };
  users.set(key, user);
  tryPersist(user);
  return signToken(user);
}

export async function loginUser({ email, password }) {
  const user = users.get(String(email ?? "").toLowerCase().trim());
  if (!user || !(await bcrypt.compare(String(password ?? ""), user.passwordHash))) {
    throw new Error("Invalid email or password");
  }
  return signToken(user);
}

export function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, secret(), { expiresIn: "7d" });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, secret());
  } catch {
    return null;
  }
}

// Attaches req.user when a valid Bearer token is present; never rejects.
export function authAttach(req, _res, next) {
  const header = req.headers.authorization ?? "";
  if (header.startsWith("Bearer ")) {
    const claims = verifyToken(header.slice(7));
    if (claims) req.user = claims;
  }
  next();
}

// Enforces auth only when AUTH_REQUIRED=1 (production); open otherwise.
export function requireAuthIfEnabled(req, res, next) {
  if (process.env.AUTH_REQUIRED === "1" && !req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  return next();
}

async function tryPersist(user) {
  try {
    const mongoose = (await import("mongoose")).default;
    if (mongoose.connection.readyState !== 1) return;
    const { User } = await import("../models/index.js");
    const { passwordHash: _drop, ...safe } = user;
    await User.updateOne({ email: safe.email }, { $set: safe }, { upsert: true });
  } catch {
    // Non-fatal in local mode.
  }
}
