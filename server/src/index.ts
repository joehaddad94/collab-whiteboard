// Must run before any module that reads process.env at import time (e.g. db/index.ts).
import "dotenv/config";

import { createServer } from "node:http";
import { Server } from "socket.io";
import { createApp } from "./app.js";
import "./db/index.js";

const app = createApp();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
    credentials: true,
  },
});

// Auth (ADR-015) and event handlers (ADR-017) are wired up in a later step —
// this is just the skeleton connection for now.
io.on("connection", (socket) => {
  console.log("socket connected:", socket.id);
});

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
httpServer.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
