# Collab Whiteboard

A real-time collaborative whiteboard: multiple users draw on the same canvas
together, see each other's cursors, chat, and share boards — all synced live
over WebSockets.

- **`client/`** — React + TypeScript (Vite)
- **`server/`** — Express + TypeScript + Socket.io + SQLite

Two plain sibling folders, not a monorepo — see [Technical Decisions](#technical-decisions).

## Quick start

Requires Node 24+. Two terminals:

```bash
# Terminal 1 - backend
cd server
npm install
cp .env.example .env   # edit JWT_SECRET to any random string
npm run dev             # http://localhost:4000

# Terminal 2 - frontend
cd client
npm install
cp .env.example .env   # defaults are fine
npm run dev             # http://localhost:5173
```

Open `http://localhost:5173`, sign up, create a board, and open the same
board in a second browser tab (or an incognito window, for a second account)
to see the real-time sync.

Full setup details, environment variables, and scripts:
[`server/README.md`](./server/README.md) · [`client/README.md`](./client/README.md)

## Features

- Freehand drawing with color and brush size, plus an eraser
- Real-time sync — drawing, erasing, and undo/redo are streamed live to
  everyone on the board, not just visible after a refresh
- Live cursors and presence — see who's connected and where their cursor is
- Per-user undo/redo and a whole-board Clear
- Save/load — the server autosaves a board as it changes, and flushes when
  the last person leaves, so work isn't lost by forgetting to save; Save
  writes immediately. It reloads exactly as saved
- Real-time per-board chat, with history
- Invite collaborators by email (Owner/Editor roles)
- Real authentication (signup/login/logout, not just a display name)
- Responsive down to phone widths

Full feature walkthrough: [`client/README.md`](./client/README.md#features)

## API & WebSocket documentation

- **REST**: interactive docs at `http://localhost:4000/api-docs` once the
  server is running (Swagger UI), spec source in
  [`server/openapi.yaml`](./server/openapi.yaml)
- **WebSocket**: OpenAPI has no format for Socket.io events, so those are
  documented directly in [`server/README.md`](./server/README.md#websocket-socketio-events)
- **Authentication**: [`server/README.md`](./server/README.md#authentication)

## Technical decisions

This is a condensed summary of the choices that shaped the project — the
full decision log, with alternatives considered and trade-offs for every
entry, is kept locally in `ARCHITECTURE.md` (gitignored, not part of this
submission) as live-review prep material.

**Backend stack** — Express (not Nest.js/Next.js), `better-sqlite3`-style
synchronous SQLite via `node:sqlite` (no ORM, no migration framework —
`schema.sql` with `CREATE TABLE IF NOT EXISTS`), Socket.io over the raw
WebSocket API for reconnection handling and room-based broadcasting. All
three follow the same philosophy: minimal and transparent over
feature-rich, since every choice needs to be explained and defended, not
just work.

**Frontend stack** — React + TypeScript, plain React state (no
Redux/Zustand/React Query — nothing in this app is complex enough to
justify one, and most live data flows over sockets anyway, not REST), plain
CSS with custom properties for theming (no Tailwind/CSS-in-JS). The one
frontend/backend duplication that's deliberate: shared types (`Stroke`,
`Board`, etc.) are defined independently in both `client/src/types` and
`server/src/modules/*/`, rather than a shared package in an npm-workspaces
monorepo — avoids workspace tooling for a small amount of duplication.

**Canvas rendering** — a native `<canvas>` via a React ref and the raw
Canvas 2D API, not a wrapper library (Fabric.js/Konva). React owns the
surrounding UI; the canvas itself is drawn to imperatively. Strokes are
drawn incrementally (one segment per point) while active, and only fully
redrawn from state on resize, undo/redo, clear, or (re)join — resizing a
canvas clears its pixel buffer as a browser side-effect, so a
"redraw everything from current state" path has to exist unconditionally
for responsive layouts to work at all. Remote cursors are DOM overlays,
never drawn into canvas pixels.

**Data model** — boards are multi (not one shared canvas); a board's
drawing state is a JSON blob of strokes on the `Board` row, not a normalized
per-stroke table — strokes aren't persisted per-event, so there's nothing to
normalize. Persistence is the server writing its own board session on a
debounce (and on the last person leaving), not each client saving its copy:
one writer instead of N racing on the same row, and no work lost because
nobody pressed a button.
Undo/redo is per-user and lives in server memory per active board session,
not persisted — it's scoped to the live editing session, the same way
Figma/Google Docs don't guarantee undo history survives a reload either.

**Real-time sync** — strokes are streamed point-by-point over Socket.io as
they're drawn (not batched on pointer-up), so collaborators watch a line
being drawn live rather than see it "pop in" once finished. A client
resyncs by receiving full current state on every join/rejoin rather than
replaying missed events, which stays correct by construction with no event
log to maintain.

**Authentication** — real accounts (email + password + a unique username),
not just a display name, since the challenge overview lists authentication
as core rather than optional. JWT in an httpOnly cookie is the single
credential shared by REST and the Socket.io handshake. Login accepts either
username or email as the identifier, since users forget which one they
signed up with.
