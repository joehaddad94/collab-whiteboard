# Collab Whiteboard — Server

Express + TypeScript. REST for auth and CRUD, Socket.io for everything live,
SQLite (`node:sqlite`) for storage.

See the [root README](../README.md) for running both halves together, and
[`client/README.md`](../client/README.md) for the frontend.

## Setup

Node 24+.

```bash
cd server
npm install
cp .env.example .env    # set JWT_SECRET before starting
npm run dev
```

Listens on `http://localhost:4000`. The database file and schema are created on
first run, and re-applied harmlessly on every start.

### Environment

| Variable | Default | |
|---|---|---|
| `PORT` | `4000` | |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Must be an exact origin. Wildcard CORS can't carry cookies. |
| `JWT_SECRET` | none, required | `openssl rand -hex 32` |
| `DB_FILE` | `./data/whiteboard.sqlite` | |

### Scripts

| | |
|---|---|
| `npm run dev` | `tsx watch`, restarts on save |
| `npm run build` | compile to `dist/` |
| `npm start` | run the build |

`build` also copies `schema.sql` into `dist/`, since `tsc` only emits JavaScript
and the server reads that file at startup.

## Layout

```
src/
  app.ts, index.ts        express app, http server, socket auth
  middleware/auth.ts      requireAuth, JWT sign/verify
  modules/                auth, boards, chat
    *.routes.ts           url -> controller, auth requirements
    *.controller.ts       read the request, call the service, pick a status
    *.service.ts          rules: validation and permissions
    *.repository.ts       SQL
  sockets/                board handlers, per-board session state, autosave
  db/                     connection and schema.sql
```

Controllers don't write SQL. Repositories don't make decisions. Errors are
thrown as `AppError` subclasses and turned into responses in one place, in
`app.ts`.

## REST

Swagger UI at **http://localhost:4000/api-docs** while the server is running.
[`openapi.yaml`](./openapi.yaml) is the full spec; the table below is a summary.

| Method | Path | Auth | |
|---|---|---|---|
| POST | `/api/auth/signup` | — | `{ email, password, username }` |
| POST | `/api/auth/login` | — | `{ identifier, password }`, username or email |
| POST | `/api/auth/logout` | — | clears the cookie |
| GET | `/api/auth/me` | session | current user |
| GET | `/api/boards` | session | boards you're a member of |
| POST | `/api/boards` | session | creator becomes owner |
| GET | `/api/boards/:id` | member | includes the strokes in `data` |
| PATCH | `/api/boards/:id` | owner | rename |
| DELETE | `/api/boards/:id` | owner | cascades memberships and chat |
| PUT | `/api/boards/:id/data` | member | replaces the whole strokes array |
| GET | `/api/boards/:id/members` | member | members and roles |
| GET | `/api/boards/:id/members/lookup?username=` | owner | can this person be invited |
| POST | `/api/boards/:id/members` | owner | invite by username, joins as `editor` |
| DELETE | `/api/boards/:id/members/:userId` | member | remove someone, or leave |

Four things that will surprise you with curl:

**A board you can't see returns 404, not 403.** Same as one that doesn't exist.
403 means you're a member but lack the role, like a non-owner renaming. The
membership check only queries `BoardMember`, so it never learns whether the
board exists.

**Login gives the same 401 for an unknown identifier and a wrong password.**
Otherwise you could enumerate accounts by watching the responses.

**Inviting an existing member returns 200 instead of 201**, same body. It's a
no-op, not a conflict.

**The lookup endpoint doesn't 404 for a missing user.** "No such username" is a
successful answer to what it was asked; it only 404s when the board isn't
visible to you. It's owner-only because it does confirm whether a username
exists.

`PUT /:id/data` is there for completeness. The app doesn't call it — boards
autosave server-side.

## Authentication

Signup and login issue a JWT and set it as an httpOnly cookie named `token`.
That one cookie is the credential for both REST and Socket.io. There is no
`Authorization` header anywhere.

REST goes through `requireAuth`, which verifies the cookie and puts
`{ userId, username }` on `req.user`. Browsers need `credentials: 'include'`
to send it cross-origin.

Sockets are checked once, in `io.use(...)` in `index.ts`, before any handler is
registered. It reads the same cookie off the handshake request, verifies it,
and looks the user up in the database. The username used for broadcasts comes
from that lookup, not from the token.

With curl, use `-b cookies.txt -c cookies.txt`. For a raw Socket.io client,
read `Set-Cookie` from login and pass it back as a `Cookie` header.

## Socket events

Connect to the same origin as the REST API with `withCredentials: true`.
Authentication happens during the handshake, so there's no login event.

### Client to server

| Event | Payload | |
|---|---|---|
| `join-board` | `{ boardId }` | leaves any previous board first |
| `leave-board` | `{ boardId }` | for SPA navigation, keeps the socket |
| `stroke-start` | `{ strokeId, tool, color, brushSize, point }` | `tool` is `pen` or `eraser` |
| `stroke-point` | `{ strokeId, point }` | one point per message |
| `stroke-end` | `{ strokeId }` | commits the stroke, pushes your undo stack |
| `undo` / `redo` | — | your own strokes only |
| `clear-board` | — | wipes the board and everyone's stacks |
| `cursor-move` | `{ x, y }` | throttle it; the client sends ~25/sec |
| `chat-message` | `{ text }` | 1–2000 characters after trimming |

Rejected actions come back on `error`, one channel for everything.

### Server to client

| Event | Payload | |
|---|---|---|
| `board-joined` | `{ strokes, inProgressStrokes, users, messages }` | to the joiner only |
| `user-joined` | `{ userId, username }` | someone arrived |
| `user-left` | `{ userId }` | their last connection went |
| `stroke-start` | full stroke | sender excluded |
| `stroke-point` | `{ strokeId, point }` | sender excluded |
| `stroke-end` | `{ strokeId }` | sender excluded |
| `stroke-removed` | `{ strokeId }` | undo, or an abandoned stroke |
| `stroke-restored` | `{ stroke }` | redo |
| `board-cleared` | — | whole room |
| `cursor-update` | `{ userId, username, x, y }` | sender excluded |
| `chat-message` | `{ id, boardId, userId, username, text, createdAt }` | whole room |
| `board-saved` | `{ boardId, savedAt }` | autosave wrote to disk |
| `removed-from-board` | `{ boardId }` | your access was revoked |
| `board-deleted` | `{ boardId }` | the owner deleted it |
| `error` | `{ message }` | any rejected action |

Drawing events exclude the sender because they've already drawn it locally.
Undo, redo, clear and chat go to the whole room including the sender, because
the client doesn't apply those optimistically — it waits for the broadcast.

`inProgressStrokes` matters more than it looks. A stroke someone is still
drawing isn't in `strokes` yet, and the `stroke-point` and `stroke-end` events
that follow carry only a `strokeId`. Without the in-progress list, a client
joining mid-stroke has nothing to attach them to and loses the stroke entirely.

`users` is deduplicated per user rather than per socket, and `user-joined` and
`user-left` only fire when someone's presence actually changes. Two tabs is one
person.

### Reconnecting

Socket.io reconnects on its own with backoff. The client re-emits `join-board`
and gets a fresh `board-joined`, so recovery is the same code path as joining
for the first time. There's no event replay to get wrong.

The heartbeat is set to 10s/5s rather than the 25s/20s defaults, so a dead
connection is noticed in about fifteen seconds instead of forty-five.

## Notes

Live strokes are held in memory per board and written by a debounced autosave,
plus a flush when the last person leaves. Nothing is written per stroke.

There are no migrations. `schema.sql` runs with `CREATE TABLE IF NOT EXISTS`,
which means schema changes don't touch an existing database — delete
`data/whiteboard.sqlite` and let it rebuild.

Board state lives in one process. Running more than one instance needs Redis
and the Socket.io adapter.
