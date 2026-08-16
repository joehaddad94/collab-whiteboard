import "dotenv/config";

import { createServer } from "node:http";
import { Server } from "socket.io";
import cookieParser from "cookie-parser";
import { createApp } from "./app.js";
import { verifyToken } from "./middleware/auth.js";
import { findUserById } from "./modules/auth/auth.repository.js";
import { registerBoardHandlers } from "./sockets/board.js";
import { setIo } from "./sockets/realtime.js";
import "./db/index.js";

const app = createApp();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
    credentials: true,
  },
  // Defaults are 25s/20s, so a client that vanishes isn't noticed for 45
  // seconds. The frontend covers the case the browser can see (see
  // useBoardSocket), but a dead server or a silent partition leaves the
  // heartbeat as the only signal - 10s/5s detects those in about 15.
  pingInterval: 10_000,
  pingTimeout: 5_000,
});

setIo(io);

io.engine.use(cookieParser());

io.use((socket, next) => {
  const token = (socket.request as { cookies?: Record<string, string> }).cookies
    ?.token;
  if (!token) {
    next(new Error("Not authenticated"));
    return;
  }

  try {
    const { userId } = verifyToken(token);
    const user = findUserById(userId);
    if (!user) {
      next(new Error("Not authenticated"));
      return;
    }
    socket.data.user = { userId: user.id, username: user.username };
    next();
  } catch {
    next(new Error("Not authenticated"));
  }
});

io.on("connection", (socket) => {
  const { userId, username } = socket.data.user as {
    userId: number;
    username: string;
  };
  console.log("socket connected:", socket.id, username);

  socket.join(`user:${userId}`);

  registerBoardHandlers(io, socket);
});

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
httpServer.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
