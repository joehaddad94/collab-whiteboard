# Collab Whiteboard

Several people draw on the same canvas at once, see each other's cursors,
chat, and share boards. Everything live over WebSockets.

- **`client/`** — React 19 + TypeScript, Vite
- **`server/`** — Express 5 + TypeScript + Socket.io + SQLite

Two sibling folders rather than a monorepo. The only thing they share is a
handful of type definitions, which are duplicated on purpose.

## Running it

Node 24+, two terminals.

```bash
# backend
cd server
npm install
cp .env.example .env    # set JWT_SECRET to any random string
npm run dev             # http://localhost:4000

# frontend
cd client
npm install
cp .env.example .env
npm run dev             # http://localhost:5173
```

Open `http://localhost:5173` and sign up. To see the collaboration, open the
same board in a second browser tab, or in an incognito window as a second
account.

Setup detail, environment variables and scripts are in
[`server/README.md`](./server/README.md) and
[`client/README.md`](./client/README.md).

## What it does

- Freehand drawing, colour and brush size, eraser
- Live sync: strokes stream point by point as they're drawn, so you watch a
  line appear rather than see it pop in when finished
- Cursors and presence for everyone on the board
- Per-user undo and redo, plus a Clear that wipes the board for everyone
- Autosave, with no Save button. The board reloads exactly as it was left
- Per-board chat with history
- Invite people by username, as Owner or Editor
- Real accounts: signup, login, logout
- Responsive down to phone widths

## Documentation

- **REST** — Swagger UI at `http://localhost:4000/api-docs` while the server
  runs. Spec in [`server/openapi.yaml`](./server/openapi.yaml)
- **WebSocket** — OpenAPI has no format for socket events, so they're
  documented in [`server/README.md`](./server/README.md#socket-events)
- **Frontend architecture** — [`client/README.md`](./client/README.md)

## Technical decisions

**Express, not Nest or Next.** The app needs a long-lived WebSocket server
alongside a REST API. Next's deployment model assumes request-response and
would have meant bolting a custom Node server onto it anyway, which cancels
most of the benefit. Nest brings structure this size of project doesn't need.

**SQLite through `node:sqlite`, no ORM, no migrations.** `schema.sql` runs
with `CREATE TABLE IF NOT EXISTS` on boot. Synchronous queries suit a
single-process server, and the SQL stays visible instead of being generated.

**Socket.io over raw WebSockets** for reconnection with backoff and
room-based broadcasting. Both would otherwise be hand-written, and the
reconnection logic is the part that's easy to get subtly wrong.

**Plain React state, no Redux or Zustand or React Query.** Most live data
arrives over the socket, not REST, so there's little to cache or invalidate.
State is split across four hooks by lifetime: session, board connection,
canvas, cursors.

**Plain CSS with custom properties.** One stylesheet, sectioned by feature,
with a token layer that carries a dark theme. No Tailwind, no CSS-in-JS.

**A native canvas, drawn imperatively.** No Fabric.js or Konva. React owns
the surrounding UI; strokes go straight to the 2D context through a ref,
segment by segment. Full redraws happen only on resize, undo, redo, clear
and join — a resize clears the pixel buffer as a browser side effect, so a
redraw-from-state path has to exist regardless.

**A board's drawing is one JSON blob**, not a normalised stroke table.
Nothing queries individual strokes, and live drawing never touches the
database, so there's nothing to normalise.

**The server owns persistence.** It writes its own in-memory board session on
a debounce, and again when the last person leaves, rather than each client
saving its copy. One writer instead of several racing on the same row, and
nothing lost because nobody pressed a button.

**Undo is per user and lives in memory** for the length of a session. It
isn't persisted, the same way Figma and Google Docs don't promise undo
survives a reload. Only the resulting state is saved.

**Clients resync by receiving full state on every join**, rather than
replaying missed events. Correct by construction, with no event log to
maintain or reconcile.

**A JWT in an httpOnly cookie**, as the single credential for both REST and
the Socket.io handshake. There's no `Authorization` header anywhere. Login
takes either a username or an email, because people forget which they used.

**Types are duplicated between client and server** rather than shared through
an npm workspace. A handful of interfaces isn't worth the tooling.

### Known limits

Board state lives in one process, so running more than one instance would
need Redis and the Socket.io adapter. There's no rate limiting. Inviting
someone requires them to already have an account. No automated tests ship
with the project.
