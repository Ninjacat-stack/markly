import { Router } from "express";
import { clearSessionCookie, loginUser, registerUser, setSessionCookie } from "../lib/auth.js";

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  try {
    const token = await registerUser(req.body ?? {});
    // httpOnly cookie = login survives refresh with zero browser storage.
    // The token is ALSO returned for in-memory Bearer use (dev simplicity).
    setSessionCookie(res, token);
    return res.status(201).json({ token });
  } catch (err) {
    const status = String(err.message ?? "").includes("already registered") ? 409 : 400;
    return res.status(status).json({ error: String(err.message ?? err) });
  }
});

authRouter.post("/login", async (req, res) => {
  try {
    const token = await loginUser(req.body ?? {});
    setSessionCookie(res, token);
    return res.json({ token });
  } catch (err) {
    return res.status(401).json({ error: String(err.message ?? err) });
  }
});

authRouter.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  return res.json({ ok: true });
});

authRouter.get("/me", (req, res) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  return res.json({ user: req.user });
});
