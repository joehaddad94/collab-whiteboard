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

const JSON_BODY_LIMIT = "5mb";

const BODY_PARSER_MESSAGES: Record<string, string> = {
  "entity.too.large": `Request body is too large (limit ${JSON_BODY_LIMIT})`,
  "entity.parse.failed": "Request body is not valid JSON",
};

function asBodyParserFailure(
  err: unknown,
): { status: number; message: string } | null {
  if (typeof err !== "object" || err === null) return null;
  const { type, status, statusCode } = err as {
    type?: unknown;
    status?: unknown;
    statusCode?: unknown;
  };
  if (typeof type !== "string" || !(type in BODY_PARSER_MESSAGES)) return null;
  const code =
    typeof status === "number"
      ? status
      : typeof statusCode === "number"
        ? statusCode
        : 400;
  return { status: code, message: BODY_PARSER_MESSAGES[type] };
}

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

  const bodyFailure = asBodyParserFailure(err);
  if (bodyFailure) {
    res.status(bodyFailure.status).json({ error: bodyFailure.message });
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
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
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
