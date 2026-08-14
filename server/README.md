# Collab Whiteboard — Server

Express + TypeScript + Socket.io backend for the collaborative whiteboard.
REST for auth/CRUD, Socket.io for everything real-time (drawing, cursors,
presence, undo/redo, chat). SQLite (`node:sqlite`) for persistence.

See the root [`README.md`](../README.md) for the project overview and how
to run frontend + backend together, and [`client/README.md`](../client/README.md)
for the frontend specifically.

## Setup

Requires Node 24+.

```bash
cd server
npm install
cp .env.example .env   # then edit JWT_SECRET - see below
npm run dev
```

The server listens on `http://localhost:4000` by default and creates
`data/whiteboard.sqlite` on first run (schema applied automatically, safe
to re-run).

### Environment variables (`.env`)

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `4000` | |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Must be an exact origin, not `*` — cookies require it, since credentials don't work with a wildcard CORS origin. |
| `JWT_SECRET` | *(required, no default)* | Any long random string for local dev, e.g. `openssl rand -hex 32`. |
| `DB_FILE` | `./data/whiteboard.sqlite` | SQLite file path, created automatically. |

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Run with `tsx watch` — auto-restarts on file changes. |
| `npm run build` | Type-check and compile to `dist/`. |
| `npm start` | Run the compiled build (`dist/index.js`). |

## REST API

Interactive docs (Swagger UI) are served by the app itself once it's
running:

**http://localhost:4000/api-docs**

The full request/response spec lives in [`openapi.yaml`](./openapi.yaml).
Everything below is a summary — that's the authoritative reference.

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/auth/signup` | — | `{ email, password, username }` |
| POST | `/api/auth/login` | — | `{ identifier, password }` — identifier is a username or email |
| POST | `/api/auth/logout` | — | Clears the session cookie |
| GET | `/api/auth/me` | session | Current user |
| GET | `/api/boards` | session | Boards the user is a member of |
| POST | `/api/boards` | session | Create a board (creator becomes owner) |
| GET | `/api/boards/:id` | member | Includes current strokes (`data`) |
| PATCH | `/api/boards/:id` | owner | Rename |
| DELETE | `/api/boards/:id` | owner | Cascades memberships + chat history |
| PUT | `/api/boards/:id/data` | member | Explicit save — replaces the whole strokes array |
| GET | `/api/boards/:id/members` | member | List members with roles |
| POST | `/api/boards/:id/members` | owner | Invite by email, immediate `editor` membership |
| DELETE | `/api/boards/:id/members/:userId` | owner | Can't remove the owner |

Conventions worth knowing before you poke at this with curl/Postman:
- **404, not 403, for "you can't see this"** — a board that exists but you're
  not a member of returns 404, same as one that doesn't exist at all. 403 is
  reserved for "you can see it, you're a member, you just can't do *this*"
  (e.g. a non-owner trying to rename).
- **Login never confirms whether an identifier exists** — an unknown
  username/email and a wrong password both return the same generic 401, to
  prevent account enumeration.
- **Inviting an existing member is a no-op, not an error** — returns 200
  instead of 201 with the same body, rather than a conflict.

## Authentication

A JWT is issued on signup/login and set as an **httpOnly cookie** named
`token`. It's the single credential for both REST and Socket.io:

- **REST**: the `requireAuth` middleware reads the cookie, verifies it, and
  attaches the decoded `{ userId, username }` to `req.user`. Client requests
  need `credentials: 'include'` (fetch) or equivalent to send the cookie
  cross-origin.
- **Socket.io**: a connection middleware (`io.use(...)` in `index.ts`) reads
  the same cookie from the handshake headers, verifies it the same way, and
  rejects the connection outright if it's missing or invalid — a socket
  never gets to register any event handlers without a valid session.

There's no `Authorization` header anywhere in this API — the browser sends
the cookie automatically on same-origin-configured requests, and a non-browser
client (curl, a test script) needs to carry it explicitly (`-b cookies.txt`
with curl, or read `Set-Cookie` and pass it back as `Cookie` for a raw
Socket.io client).

## WebSocket (Socket.io) events

Connect to the same origin as the REST API (`http://localhost:4000` by
default) with `withCredentials: true` so the auth cookie rides along on the
handshake. All events below happen after that connection is authenticated —
there's no separate WS-level login step.

### Client → Server

| Event | Payload | Notes |
|---|---|---|
| `join-board` | `{ boardId }` | Rejects (via `error`) if you're not a member. Leaves any previously-joined board first. |
| `leave-board` | `{ boardId }` | For SPA navigation away from a board without disconnecting the socket. |
| `stroke-start` | `{ strokeId, tool, color, brushSize, point }` | Starts a new stroke. `tool` is `"pen"` or `"eraser"` — erasing is a stroke, not a separate mechanism. |
| `stroke-point` | `{ strokeId, point }` | One point at a time, streamed while drawing — not batched. |
| `stroke-end` | `{ strokeId }` | Finishes the stroke, pushes it onto your undo stack. |
| `clear-board` | — | Empties the board **and everyone's** undo/redo stacks. Not itself undoable. |
| `undo` | — | Pops your own last stroke. Silent no-op if your stack is empty. Can't undo someone else's stroke. |
| `redo` | — | Restores your own last undone stroke. |
| `cursor-move` | `{ x, y }` | Throttle this client-side (the frontend does ~25/sec) — it's rebroadcast to everyone else on the board. |
| `chat-message` | `{ text }` | 1–2000 characters after trimming. |

### Server → Client

| Event | Payload | Notes |
|---|---|---|
| `board-joined` | `{ strokes, users, messages }` | Full current state, sent only to you in reply to `join-board`. Also what a reconnect resyncs from — there's no "replay missed events," every join/rejoin gets the complete current state. |
| `user-joined` | `{ userId, username }` | Broadcast to the room when someone else joins. |
| `user-left` | `{ userId }` | Broadcast on `leave-board` or disconnect. |
| `stroke-start` | full stroke object | Rebroadcast to everyone *except* the sender. |
| `stroke-point` | `{ strokeId, point }` | Rebroadcast, sender excluded. |
| `stroke-end` | `{ strokeId }` | Rebroadcast, sender excluded. |
| `board-cleared` | — | Broadcast to the **whole room including the sender**. |
| `stroke-removed` | `{ strokeId }` | Undo result. Whole room including sender. |
| `stroke-restored` | `{ stroke }` | Redo result. Whole room including sender. |
| `cursor-update` | `{ userId, username, x, y }` | Rebroadcast, sender excluded. |
| `chat-message` | `{ id, boardId, userId, username, text, createdAt }` | Whole room including the sender — there's no optimistic local echo on the frontend, it just waits for this like everyone else. |
| `error` | `{ message }` | One generic channel for every rejected action (bad join, invalid chat text, an unexpected server-side error) rather than a bespoke event per failure type. |
| `removed-from-board` | `{ boardId }` | Sent to a specific user if their membership is revoked while they're connected to that board. |
| `board-deleted` | `{ boardId }` | Sent to everyone connected to a board if its owner deletes it. |

A connected client that unexpectedly drops gets Socket.io's default
reconnection behavior (automatic, exponential backoff) — on reconnect it
just re-emits `join-board` and gets a fresh `board-joined`, so recovering
from a dropped connection is identical to joining fresh, no special
resync logic needed.
