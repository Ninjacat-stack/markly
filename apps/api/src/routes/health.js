import { Router } from "express";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "assignmentai-api",
    version: "0.1.0",
    mongo: process.env.MONGODB_URI ? "configured" : "not-configured (in-memory mode)",
    aiService: process.env.AI_SERVICE_URL ?? "http://127.0.0.1:8001",
  });
});
