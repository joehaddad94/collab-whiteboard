import express from "express";
import cors from "cors";

export function createApp() {
  const app = express();

  // Explicit origin (not "*") + credentials: true is required for the httpOnly
  // auth cookie to work across the client/server origins in dev (ADR-015).
  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
      credentials: true,
    }),
  );
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  return app;
}
