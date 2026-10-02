import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import { assignmentsRouter } from "./routes/assignments.js";
import { authRouter } from "./routes/auth.js";
import { examplesRouter } from "./routes/examples.js";
import { healthRouter } from "./routes/health.js";
import { jobsRouter } from "./routes/jobs.js";
import { templatesRouter } from "./routes/templates.js";
import { authAttach, requireAuthIfEnabled } from "./lib/auth.js";
import { assetsDir, ensureDirs } from "./lib/storage.js";

dotenv.config();

// Surface async route bugs loudly instead of dropping connections silently.
process.on("unhandledRejection", (err) => {
  console.error("[api] UNHANDLED_REJECTION:", err);
});

const app = express();
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Minimal request logging (Phase 9 observability baseline).
app.use((req, _res, next) => {
  console.log(`[api] ${req.method} ${req.path}`);
  next();
});
app.use(authAttach);

// Tenant artwork (headers, watermarks, logos) served as static files.
ensureDirs();
app.use("/assets", express.static(assetsDir));

// Basic rate limiting (in-memory window; point at Redis when REDIS_URL is set in production).
const hits = new Map();
app.use("/api/", (req, res, next) => {
  const key = req.ip ?? "unknown";
  const now = Date.now();
  const entry = hits.get(key);
  const limit = Number(process.env.RATE_LIMIT_PER_MIN ?? 60);
  if (!entry || entry.reset < now) {
    hits.set(key, { count: 1, reset: now + 60_000 });
    return next();
  }
  entry.count += 1;
  if (entry.count > limit) return res.status(429).json({ error: "Rate limit exceeded" });
  return next();
});

app.use("/api/v1/health", healthRouter);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/assignments", requireAuthIfEnabled, assignmentsRouter);
app.use("/api/v1/examples", examplesRouter);
app.use("/api/v1/jobs", jobsRouter);
app.use("/api/v1/templates", templatesRouter);

app.get("/", (_req, res) => {
  res.json({ service: "Markly-api", docs: "/api/v1/health" });
});

const PORT = Number(process.env.PORT ?? 4000);

async function main() {
  if (process.env.MONGODB_URI) {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log("[api] connected to MongoDB");
    } catch (err) {
      console.warn("[api] MongoDB connection failed, continuing in-memory:", String(err));
    }
  } else {
    console.warn("[api] MONGODB_URI not set — running in-memory (Phase 1 POC mode)");
  }
  app.listen(PORT, () => console.log(`[api] listening on :${PORT}`));
}

if (process.env.NODE_ENV !== "test") {
  void main();
}

export default app;

