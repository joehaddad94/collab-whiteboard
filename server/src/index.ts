import "dotenv/config";

import { createServer } from "node:http";
import { Server } from "socket.io";
import cookieParser from "cookie-parser";
import { createApp } from "./app.js";
import { verifyToken } from "./middleware/auth.js";
import { registerBoardHandlers } from "./sockets/board.js";
import "./db/index.js";

const app = createApp();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
    credentials: true,
  },
});

io.engine.use(cookieParser());

io.use((socket, next) => {
  const token = (socket.request as { cookies?: Record<string, string> }).cookies
    ?.token;
  if (!token) {
    next(new Error("Not authenticated"));
    return;
  }

  try {
    socket.data.user = verifyToken(token);
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
