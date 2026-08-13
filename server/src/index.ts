// Must run before any module that reads process.env at import time (e.g. db/index.ts).
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

// Runs cookie-parser on the underlying handshake request so socket.request.cookies
// is populated the same way req.cookies is for REST (ADR-015) — the officially
// supported way to share Express middleware with Socket.io.
io.engine.use(cookieParser());

// Namespace middleware: verifies the same httpOnly cookie/JWT used by REST, before
// the connection is accepted. Rejecting here (via next(error)) means an unauthorized
// client never reaches the `connection` event or any event handlers at all.
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

  // Personal room for board-invite notifications (ADR-009), independent of any
  // specific board — joined once per connection, not per board.
  socket.join(`user:${userId}`);

  registerBoardHandlers(io, socket);
});

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
httpServer.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
