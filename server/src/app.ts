import express, {
  type ErrorRequestHandler,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { load as loadYaml } from "js-yaml";
import swaggerUi, { type JsonObject } from "swagger-ui-express";
import authRouter from "./modules/auth/auth.routes.js";
import boardsRouter from "./modules/boards/boards.routes.js";
import { AppError } from "./errors.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const openApiSpec = loadYaml(
  readFileSync(join(__dirname, "../openapi.yaml"), "utf-8"),
) as JsonObject;

const errorHandler: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
};

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

  app.use("/api/auth", authRouter);
  app.use("/api/boards", boardsRouter);

  app.use(errorHandler);

  return app;
}
