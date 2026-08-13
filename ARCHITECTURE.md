# Architecture Decision Log

This file is a running log of the technical decisions made while building this project,
kept up to date **as decisions happen**, not written after the fact. It exists so that:

- The reasoning behind each choice is captured while it's fresh, including the
  alternatives that were considered and rejected.
- It can be used as prep material for the technical review (Anexya's review process
  requires being able to explain and defend every choice, including AI-assisted code).
- It eventually feeds directly into the README's "technical decisions" section.

Each entry follows the same shape: **Decision / Context / Alternatives considered /
Trade-offs**. New entries are appended at the bottom as new decisions are made — existing
entries are not rewritten after the fact.

---

## Status (updated 2026-08-13)

### Backend — done
- Project skeleton: TypeScript, `node:sqlite`, `db/schema.sql`, `.env`/`.env.example` (ADR-011–014)
- Auth: signup/login/logout/me, JWT httpOnly cookie, auth middleware, Socket.io handshake auth (ADR-008/015)
- Board CRUD REST routes: list/create/get/rename/delete/save (ADR-016)
- Membership REST routes: list/invite-by-username/remove, invite-link regenerate/join (ADR-009/016)
- Socket.io: `join-board`/`leave-board` + presence, streamed drawing events
  (`stroke-start`/`stroke-point`/`stroke-end`), `clear-board`, per-user `undo`/`redo`,
  `cursor-move` → `cursor-update` (ADR-017/019)
- Backend refactored into feature-grouped modules (repository/service/controller/routes)
  with centralized error handling and no code comments (ADR-021)

### Backend — not done
- Chat (`ChatMessage` persistence + `chat-message` event + history in `board-joined`) —
  **deliberately deferred to last**, per ADR-020. This is now the only remaining
  backend work.

### Frontend — done (built independently, outside this conversation)
- Vite + React + TypeScript scaffold
- Auth context + protected route guard
- Login/signup pages
- Board list page (create/rename/delete)

### Frontend — not done
- `BoardPage` (hosts the canvas + toolbar + user list + chat)
- `Whiteboard` component — canvas rendering, hybrid incremental/full-redraw strategy (ADR-018)
- `Toolbar`, `UserList`, `CursorOverlay`, `ChatPanel`
- `useBoardSocket` hook — wraps the socket connection and join/leave lifecycle, exposes
  draw/undo/redo/chat actions
- `JoinBoardPage` (redeems `/join/:code`)

### Not started at all
- README (setup, running locally, REST/WebSocket API docs, assumptions, technical
  decisions) — required for submission, per Anexya's review requirements

---

## ADR-001: Backend framework — Express

**Decision:** Use Express as the backend web framework.

**Context:** The app needs a WebSocket server (for real-time drawing sync) plus a REST
API for CRUD and auth. Two alternatives were seriously considered: Next.js (to unify
frontend and backend in one project) and Nest.js (a more structured/opinionated Node
framework).

**Alternatives considered:**
- **Next.js** — appealing for keeping "everything in one place" (frontend + backend in a
  single app/deploy). Rejected because Next's serverless/edge deployment model doesn't
  suit long-lived WebSocket connections — using it properly would require bolting on a
  custom Node server anyway, which cancels out most of the benefit while adding an extra
  layer of framework-specific complexity to justify in review.
- **Nest.js** — a more structured, DI/decorator-based framework, generally a strong
  choice for larger teams/apps. Rejected for this challenge because its module/provider/
  gateway machinery adds surface area that would need to be explained and defended in
  the review without adding real value at this project's scope.

**Trade-offs:** Express gives up Nest's built-in structure and Next's unified
frontend/backend deploy story, in exchange for a minimal, transparent codebase where
every line has an obvious purpose — better suited to a setting where each design choice
needs to be explained and defended live.

---

## ADR-002: Real-time transport — Socket.io

**Decision:** Use Socket.io for the WebSocket layer between clients and the server.

**Context:** The challenge requires real-time, bidirectional sync of drawing events
(strokes, erases, clears, cursor/presence) across all connected clients, plus handling
disconnects/reconnects gracefully.

**Alternatives considered:**
- **Raw WebSocket API** — lower-level, fewer built-in conveniences (would need manual
  reconnection handling, room/broadcast management, and message framing).

**Trade-offs:** Socket.io adds a small dependency/protocol overhead compared to raw
WebSockets, but provides reconnection handling, room-based broadcasting (useful for
multi-board support later), and a simpler event-based API — worth it for the amount of
real-time logic this challenge requires.

---

## ADR-003: Persistence — SQLite

**Decision:** Use SQLite for persistent storage (users/auth, saved whiteboard CRUD
records). Live drawing strokes are **not** persisted per-event — they're broadcast
directly between connected clients over the socket connection; only save/load snapshots
touch the database.

**Context:** The challenge overview explicitly calls for "REST API, CRUD, and
Authentication," which implies real persistent storage, not just in-memory state.

**Alternatives considered:**
- **PostgreSQL / MySQL** — more production-grade, but require an external service to
  install/run/explain, which is unnecessary overhead for a scoped take-home challenge.
- **MongoDB** — reasonable fit for storing stroke data as documents, but again requires
  an external service and doesn't provide meaningfully more value than SQLite here.

**Trade-offs:** SQLite doesn't scale to concurrent production traffic and has limited
concurrent-write support, but it's a single file with zero setup, which keeps the project
easy to run and easy to explain — the right trade-off for this challenge's scope.

---

## ADR-004: Frontend — React + TypeScript

**Decision:** Build the frontend with React and TypeScript.

**Context:** Frontend choice, per Joe's preference.

**Trade-offs:** N/A — direct preference, not a comparative decision.

---

## ADR-005: Repository/project structure — single repo, `server/` + `client/`

**Decision:** Keep one Git repository (this one) containing both the backend
(`server/`) and frontend (`client/`) as sibling folders, rather than splitting them into
separate repos.

**Context:** Joe wanted the convenience of "everything in one place" — the original
motivation for considering Next.js. Since Next.js was ruled out (see ADR-001), the same
goal is achieved instead by keeping backend and frontend in one repo with clearly
separated folders, without inheriting Next's serverless constraints on the WebSocket
server.

**Trade-offs:** No shared build/deploy pipeline out of the box (unlike a true Next.js
monorepo app), but the project stays simple to clone, run, and reason about as two plain
Node projects living side by side.

---

## ADR-006: Data model — `User`, `Board`, `BoardMember`, and the `Stroke` shape

**Decision:**
- `User` — `id`, `username` (unique), `password_hash`, `created_at`.
- `Board` — `id`, `name`, `owner_id` (FK → `User`), `created_at`, `updated_at`, `data`
  (JSON blob holding the current array of strokes).
- `BoardMember` — join table: `board_id`, `user_id`, `role` (e.g. `owner`/`editor`) —
  tracks who can access which board (see ADR-009).
- `Stroke` is not a table — it's the shared JSON shape used both inside `Board.data` and
  in socket event payloads: `{ id, userId, tool: "pen" | "eraser", color, brushSize,
  points: [{x,y}, ...] }`.

**Context:** Boards are multi (not a single shared canvas), so ownership and membership
need real rows. Live drawing doesn't need to touch the database at all (ADR-003) — only
the resulting snapshot does, on save.

**Alternatives considered:**
- **Normalized `Strokes` table** (one row per stroke) — considered specifically for
  supporting undo/redo (would let history be queried/replayed). Rejected: undo/redo turned
  out not to need it — see ADR-007. A JSON blob is simpler for save/load and we don't need
  server-side querying of individual strokes.

**Trade-offs:** The JSON blob can't be queried or indexed at the stroke level (e.g. "find
all strokes by user X across boards" isn't a cheap query), but nothing in the challenge
requires that, and it keeps save/load to a single read/write.

---

## ADR-007: Undo/redo — per-user, in-memory, session-scoped

**Decision:** Undo/redo is per-user (each user can only undo their own strokes, not
someone else's) and lives entirely in server memory per open board: an in-memory
`strokes` array (the live/current state), plus per-user undo/redo stacks. Undo pops a
stroke off the live array and the user's undo stack, broadcasts a `stroke-removed`
event, and pushes it onto their redo stack. None of this — the stacks or the history —
is persisted; only the resulting current state is written to `Board.data` on save.

**Context:** Raised directly: does undo/redo require the normalized `Strokes` table
considered in ADR-006? Concluded no — undo/redo is a live-editing-session feature, not
something that needs to survive a server restart (the same way Figma/Google Docs don't
guarantee undo history survives a hard reload either).

**Alternatives considered:**
- **Global undo** (undo the last action by *anyone* on the board) — rejected in favor of
  per-user, matching the standard collaborative pattern (Miro, Figma) so one person can't
  accidentally erase someone else's work via Ctrl+Z.
- **Persisted undo history** (normalized table, survives restart) — rejected as solving
  for a requirement nobody asked for; adds real schema/query complexity for no stated
  benefit.

**Trade-offs:** Undo/redo history is lost if the server restarts or the board goes fully
idle (no connected clients) — acceptable since this matches how most real collaborative
tools scope undo to the live session anyway.

---

## ADR-008: Authentication — real signup/login, JWT in an httpOnly cookie

**Decision:** Build real authentication (not just a display name) as a **core**
requirement, not deferred to the bonus list: `POST /api/auth/signup`, `POST
/api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`. Passwords hashed with
bcrypt. Auth token is a JWT stored in an **httpOnly cookie**, sent via
`withCredentials: true` on both REST calls and the Socket.io handshake — one unified
auth path for REST and WS.

**Context:** The challenge overview explicitly lists "Authentication" as a core
deliverable ("REST API, CRUD, and Authentication"), even though the detailed
requirements list full user auth under "Bonus Features" and only ask for a unique
display name under "User Management." Resolved the contradiction by treating real auth
as core, since the overview line is the more authoritative signal and it also gates the
CRUD/board-membership requirements.

**Alternatives considered:**
- **Bearer token kept in JS memory** (not a cookie) — simpler to wire through the socket
  handshake (`auth: { token }` on connect), but more exposed to XSS (any script has read
  access) and forces re-login on every page refresh since nothing persists.
- **Just a unique display name, no password** — matches the literal "User Management"
  wording, but doesn't actually satisfy "Authentication" as a real access-control
  mechanism, and would leave board membership/ownership meaningless (anyone could type
  any name).

**Trade-offs:** httpOnly cookies need a bit more plumbing (reading/verifying the cookie
during the Socket.io handshake, not just on REST middleware) versus a bearer token, but
they're the more defensible choice security-wise and still keep one auth mechanism
shared across REST and WS.

---

## ADR-009: Board invites — `BoardMember` with two entry paths, immediate membership

**Decision:**
- Access control is via the `BoardMember` join table (ADR-006); only members can open a
  board.
- Two ways to become a member:
  1. **Invite by username** — board owner only, `POST /api/boards/:id/members
     { username }`. Validated: target username must exist (404 if not), can't invite
     self, can't duplicate an existing membership (idempotent no-op).
  2. **Shareable invite link/code** — `Board.invite_code` (random, regenerable token) +
     a join endpoint that creates a `BoardMember` row for whichever authenticated user
     opens it. Supported via both a clickable link (`/join/<token>`) and a manual
     paste-the-code field — same token/endpoint underneath either way.
- Membership is granted **immediately** on invite/join — no pending/accept step.
- **Delivery mechanism:** invitation isn't a single "delivered" event. It's two layers:
  - *Reliable*: the board simply appears in the invitee's `GET /api/boards` list the
    next time they load the app, because the `BoardMember` row already exists. Nothing
    to click or accept.
  - *Optional/ambient*: if the invitee happens to be online at invite time, a real-time
    toast fires via a personal `user:<id>` socket room (separate from board-specific
    rooms) — clicking it navigates straight to `/boards/:id`. Purely a convenience layer
    on top of the reliable mechanism above, not required for the invite to "work."

**Context:** Multi-board was chosen over a single shared canvas, which raised: how does
an owner grant access, and how does the invitee find out? Also directly checked: does
`BoardMember` itself satisfy the bonus requirement "Add user authentication to restrict
access to the whiteboard"? No — that's already satisfied by core auth (ADR-008), which
gates the entire app regardless of board membership. `BoardMember` is an *additional*,
finer-grained authorization layer on top (which boards a logged-in user can see), not
what answers the bonus item.

**Alternatives considered:**
- **Shareable link only** (no explicit username invite) — rejected alone, since it
  doesn't let an owner deliberately grant access to one specific known collaborator
  without leaking the link elsewhere.
- **Board ID manually entered** instead of a link — rejected: a raw sequential ID would
  be guessable/enumerable, so a random unguessable token is required either way; a link
  gives identical backend cost with strictly better UX (one click vs. copy-paste into a
  form). Ended up supporting both entry *methods* for the same token as a middle ground.
- **Pending/accept invite flow** (`status: pending/accepted`) — rejected for now; adds a
  small state machine for realism that isn't required, in favor of immediate membership.

**Trade-offs:** No explicit consent step means an owner can add someone to a board
without them opting in first (closer to a Slack channel invite than a Google-Docs share
request) — acceptable at this scope. The shareable link's security relies on the token
being unguessable and revocable via regeneration, not on secrecy of a predictable ID.

---

## ADR-010: Frontend canvas rendering — native Canvas 2D API, no wrapper library

**Decision:** Draw directly on a real `<canvas>` element (via a React `ref`) using the
native Canvas 2D API (`beginPath`/`lineTo`/etc.) in response to pointer events. React
only owns the surrounding UI (toolbar, user list, board list) — not the drawing surface
itself.

**Context:** The challenge explicitly requires "an HTML canvas element representing the
whiteboard." Confirmed this is fully compatible with a React frontend — React and a raw
`<canvas>` aren't in tension, since the canvas is just a DOM node React can hold a ref
to and imperatively draw on outside of React's own render cycle.

**Alternatives considered:**
- **Canvas wrapper libraries** (Fabric.js, Konva) — would provide higher-level
  shape/object management for free, but add an abstraction layer that would need to be
  explained/defended in review without adding real value for what's actually needed here
  (freehand draw, erase, clear).

**Trade-offs:** Raw Canvas API means we handle pointer/touch event wiring and path
building ourselves instead of getting it from a library — more code, but every line is
directly traceable to a requirement, which fits this project's "explain everything"
constraint better.

---

## ADR-011: Backend language — TypeScript

**Decision:** Write the server in TypeScript, same as the client.

**Context:** Only the frontend language had been decided (React + TypeScript, ADR-004).
Raised explicitly when planning the server skeleton: should the backend match?

**Alternatives considered:**
- **Plain JavaScript** — less setup (no build/dev-run step), but forces either
  duplicating type shapes informally or losing type safety entirely on data that crosses
  the client/server boundary (the `Stroke` shape, API request/response bodies, socket
  event payloads).

**Trade-offs:** Adds a small dev/build step (`tsx`/`ts-node` + `tsc`) that a plain JS
server wouldn't need, in exchange for shared type definitions and consistency with the
frontend stack.

---

## ADR-012: SQLite access — `better-sqlite3`, no migration framework

**Decision:** Use `better-sqlite3` (synchronous, raw SQL, no code generation) as the
database layer. Schema is defined in a single `db/schema.sql` with
`CREATE TABLE IF NOT EXISTS` statements, executed once at server startup. No migration
framework (Prisma Migrate, node-pg-migrate, etc.).

**Context:** Weighed against Prisma (TS ORM with generated client + built-in migrations)
and Knex (query builder). Chose `better-sqlite3` to stay consistent with the philosophy
behind every other stack choice so far (Express over Nest.js, SQLite over Postgres/Mongo)
— minimal, transparent, nothing generated or "magic" that would need to be explained as
a black box in review.

**Alternatives considered:**
- **Prisma** — auto-generated types and migrations are genuinely useful, but reopens the
  same "more polish vs. more magic" trade-off already resolved elsewhere in the stack;
  picking `better-sqlite3` keeps that philosophy consistent end-to-end.
- **A real migration framework** — solves for iterative schema evolution over time,
  which isn't a real need here: the schema (`User`, `Board`, `BoardMember`) is small and
  fixed for the scope of this project.

**Clarification (important, came up during planning):** `CREATE TABLE IF NOT EXISTS` on
startup does **not** wipe data — it's a no-op once the tables exist. The SQLite database
is a single file on disk; restarting the server just reopens that same file, so data
persists across restarts exactly like any other database. "No migration framework" only
means we have no tooling to alter the schema over time, not that data resets on boot.

**Trade-offs:** No auto-generated types (write request/row interfaces by hand in
`types/`) and no schema-evolution tooling if requirements change later — both acceptable
at this scope.

---

## ADR-013: Server project layout

**Decision:**
```
server/
  src/
    index.ts        — entrypoint: create HTTP server, attach Express + Socket.io, listen
    app.ts           — Express app setup, middleware, route mounting
    db/
      index.ts        — better-sqlite3 connection singleton
      schema.sql       — CREATE TABLE statements (ADR-012)
    routes/
      auth.ts          — signup/login/logout/me
      boards.ts         — board CRUD + membership endpoints
    middleware/
      auth.ts           — verifies JWT cookie, attaches req.user
    sockets/
      index.ts           — io.on('connection'), personal room join, dispatch
      board.ts             — draw/erase/clear/cursor events per board room
    types/
      index.ts              — shared interfaces (independently defined, not a shared
                               package — see trade-off below)
  .env / .env.example
  package.json
  tsconfig.json
```

**Context:** Needed a layout where auth middleware, REST routes, and socket handlers are
each easy to point to individually in review, rather than one large file.

**Alternatives considered:**
- **npm workspaces monorepo**, sharing a single `types/` package between `server/` and
  `client/` — rejected: adds workspace/build-ordering configuration to set up and defend
  for the sake of avoiding a small amount of type duplication.

**Trade-offs:** Type definitions for shared shapes (e.g. `Stroke`, `Board`) are
duplicated independently in `server/src/types` and the client — a deliberate, accepted
trade-off in exchange for not introducing monorepo tooling.

---

## ADR-014: Environment/config

**Decision:** Use `dotenv` with a `.env` file (gitignored) for `JWT_SECRET`, `PORT`, and
`DB_FILE`; a checked-in `.env.example` with placeholder values so setup steps in the
README are self-consistent. Cookie flags (`secure`, `sameSite`) are driven off
`NODE_ENV`.

**Context:** Needed a place for secrets (JWT signing key) and environment-specific
values (DB path, port) that doesn't get committed, while still keeping setup
reproducible for anyone cloning the repo.

**Trade-offs:** N/A — standard practice, not a comparative decision.

---

## ADR-015: Auth implementation details

**Decision:**
- **Hashing:** `bcryptjs` (pure JS) rather than native `bcrypt`.
- **Tokens:** `jsonwebtoken`, payload `{ userId, username }`, ~7 day expiry, no refresh
  token — expired token means log in again.
- **Cookie:** `httpOnly: true`, `secure: NODE_ENV === 'production'`, `sameSite: 'lax'`.
- **CORS:** explicit origin + `credentials: true` on both Express (`cors()` middleware)
  and Socket.io (`cors` option) — never a wildcard `*` origin, since cookies don't work
  with one. Client sends `withCredentials: true` on REST calls and the socket connection.
- **Socket handshake auth:** server parses the same httpOnly cookie from
  `socket.handshake.headers.cookie`, verifies the JWT with the same logic as the REST
  auth middleware, attaches `socket.data.user`, rejects the connection if missing/invalid.
- **Login error handling:** generic "invalid credentials" for both unknown username and
  wrong password — never reveal which, to prevent username enumeration.
- **Validation:** username 3–20 chars alphanumeric; password minimum length (e.g. 8
  chars). Signup: `409` on duplicate username, `400` on validation failure. Login: `401`
  on any credential mismatch.

**Context:** ADR-008 established the high-level approach (real auth, JWT in an httpOnly
cookie, shared across REST and WS); this fills in the implementation details needed to
actually build it, including the CORS setup required because the client (Vite dev
server) and API server run on different ports/origins in dev.

**Alternatives considered:**
- **Native `bcrypt`** — rejected in favor of `bcryptjs` specifically to avoid native
  build-tool requirements (node-gyp) on Windows dev setup; performance difference is
  irrelevant at this scale.
- **Revealing "user not found" on login**, matching the board-invite behavior (ADR-009)
  — rejected deliberately: unlike inviting a known collaborator by username, login is a
  case where confirming a username exists helps an attacker enumerate accounts, so the
  two flows intentionally handle "unknown username" differently despite looking similar.
- **Refresh tokens** — rejected as solving a UX problem (staying logged in indefinitely)
  that isn't a stated requirement; a fixed-expiry token with re-login is simpler to
  implement and explain.

**Trade-offs:** No silent session renewal — users are logged out after the token expires
and must log in again, which is a worse UX than a refresh-token setup but much simpler to
build and reason about for this scope.

---

## ADR-016: REST API surface — boards & membership

**Decision:**

Auth (see ADR-008/015): `POST /api/auth/signup`, `POST /api/auth/login`,
`POST /api/auth/logout`, `GET /api/auth/me`.

Boards:
| Method & path | Auth | Notes |
|---|---|---|
| `GET /api/boards` | session | list boards where caller is a member — summaries only (`id, name, role, updated_at`), not the `data` blob |
| `POST /api/boards` | session | `{ name }` → creates board, auto-creates `BoardMember` row as `owner` |
| `GET /api/boards/:id` | member | full board incl. `data`. Non-members get `404`, not `403` |
| `PATCH /api/boards/:id` | owner | rename (`{ name }`, partial update) |
| `DELETE /api/boards/:id` | owner | cascades `BoardMember` rows |
| `PUT /api/boards/:id/data` | member | `{ data: Stroke[] }` — explicit save (replaces the whole strokes array); "load" is the `GET` above |

Membership & invites:
| Method & path | Auth | Notes |
|---|---|---|
| `GET /api/boards/:id/members` | member | `{ userId, username, role }[]` |
| `POST /api/boards/:id/members` | owner | `{ username }` — invite-by-username (ADR-009 validation) |
| `DELETE /api/boards/:id/members/:userId` | owner | cannot remove the owner via this route |
| `POST /api/boards/:id/invite-link/regenerate` | owner | rotates `invite_code` |
| `POST /api/boards/join/:code` | session | redeems link/code → creates `BoardMember` (`editor`), idempotent if already a member, `404` on bad code |

Conventions:
- Every `/api/boards/*` route runs auth middleware first (`401` on no session), then a
  per-route membership/ownership check.
- `404` = "you're not allowed to know this exists" (non-member board access, unknown
  invite code). `403` = "you can see it, you just can't do this" (non-owner member
  attempting an owner-only action).
- Error shape: `{ error: string }` on all failures. `201` on create, `204` on delete,
  `200` otherwise.
- No pagination on `GET /api/boards` — accepted simplification at this scope.

**Context:** Builds directly on the data model (ADR-006) and membership design (ADR-009)
— this is the concrete route list needed to actually implement them.

**Alternatives considered:**
- **One generic `PATCH /api/boards/:id`** handling both metadata (`name`) and drawing
  data — rejected in favor of a separate `PUT /api/boards/:id/data` endpoint: renaming
  and saving the canvas are semantically different actions (small partial update vs.
  replacing a potentially large array), and splitting them keeps the rename endpoint
  cheap and avoids accidentally clobbering drawing data through the wrong route. This is
  also why `PUT` (replace-the-whole-resource semantics) fits the data-save endpoint
  better than `PATCH` (partial-update semantics) fits the rename endpoint — see PUT vs.
  PATCH note below.
- **Uniform `403` for any board a user can't access** — rejected for `GET`/join in favor
  of `404`, consistent with the login-enumeration reasoning in ADR-015: don't confirm a
  resource exists to someone with no right to know.

**Trade-offs:** N/A beyond what's already covered in ADR-006/009.

---

## ADR-017: Socket.io event contract

**Decision:**

*Connection lifecycle:*
- On `connection`, server verifies the httpOnly cookie/JWT (ADR-015); disconnects
  immediately if invalid, before registering any other events.
- On success, server auto-joins the socket to a personal room `user:<userId>` (for
  board-invite toasts, ADR-009) — independent of any specific board.
- Client emits `join-board { boardId }`. Server re-checks membership (same rule as
  `GET /api/boards/:id`, ADR-016 — unauthorized join fails generically). On success,
  `socket.join(boardId)` and reply `board-joined { strokes, users }` — full current
  state, so a client fully resyncs on join *or reconnect* rather than replaying missed
  events.
- Server keeps an in-memory session per active board: `{ strokes, undoStack: Map<userId,
  Stroke[]>, redoStack: Map<userId, Stroke[]>, connectedUsers }`, hydrated from
  `Board.data` on first join, evicted once the last client leaves.

*Drawing (and erasing — no separate erase events):* eraser is just a stroke with
`tool: 'eraser'` (per the `Stroke` shape in ADR-006), so it shares the same events as
drawing. Strokes are **streamed point-by-point**, not batched on pointer-up:
- `stroke-start { strokeId, tool, color, brushSize, point }` — on pointer-down
- `stroke-point { strokeId, point }` — per pointer-move while drawing
- `stroke-end { strokeId }` — on pointer-up; finished stroke is pushed onto that user's
  undo stack server-side

*Clear:* client emits `clear-board`; server empties the live `strokes` array **and all
users' undo/redo stacks** for that board, broadcasts `board-cleared`. **Clear is not
itself undoable.**

*Cursor / presence:*
- `cursor-move { x, y }` (client, throttled client-side to avoid flooding) → server
  broadcasts `cursor-update { userId, username, x, y }` to the rest of the room.
- `user-joined { userId, username }` / `user-left { userId }` broadcast on
  connect/disconnect; the initial snapshot comes from `board-joined.users`.

*Undo/redo:* client emits `undo` / `redo` (no payload — user/board implicit from the
socket). Server mutates that user's stack + the live `strokes` array, broadcasts
`stroke-removed { strokeId }` or `stroke-restored { stroke }`. Empty stack → silent
no-op.

*Disconnect / errors:* `disconnect` removes the socket from any board's
`connectedUsers` and broadcasts `user-left` to the relevant room(s). One generic
`error { message }` event for all rejected actions, rather than a bespoke error event
per action type.

**Context:** Concrete event contract needed to implement real-time sync (ADR-002),
per-user undo/redo (ADR-007), and board membership access control (ADR-009/016).

**Alternatives considered:**
- **Batch whole strokes** (emit one `stroke` event with the full point array on
  pointer-up) — simpler to implement, but other clients only see a finished stroke
  "pop in" rather than watching it drawn live. Rejected in favor of streaming: more
  literal fit for "changes are immediately reflected in real-time," and the added
  complexity (assembling in-progress strokes per active drawer) is manageable.
- **Clear as an undoable action** — rejected: reconciling a global destructive action
  against *per-user* undo/redo stacks (whose redo history survives someone else's
  clear?) adds real complexity for a requirement that only asks clear to work, not to be
  reversible.
- **Replaying missed events on reconnect** — rejected in favor of always sending full
  current state (`board-joined`) on every join/rejoin; simpler and correct by
  construction, avoids needing an event log.

**Trade-offs:** Point-by-point streaming means more socket traffic than batching (worth
throttling `cursor-move` specifically); evicting a board's in-memory session when empty
means the first joiner after a lull pays a small DB read to rehydrate — acceptable.

---

## ADR-018: Frontend architecture — routing, state, canvas rendering

**Decision:**
- **Routing:** React Router. Pages: `/login`, `/signup`, `/boards` (list), `/boards/:id`
  (canvas view), `/join/:code` (redeems an invite link, then redirects into the board).
- **State management:** plain React state, no Redux/Zustand/React Query.
  - `AuthContext` — current user, populated via `GET /api/auth/me` on app load; guards
    `/boards/*` routes (redirect to `/login` if no session).
  - `useBoardSocket(boardId)` — custom hook owning per-board socket state (strokes,
    cursors, connected users) via `useState`/`useReducer`, exposing `draw`/`undo`/
    `redo`/`clear` actions.
  - Toolbar selection (color, brush size, tool) — local component state only.
- **API client:** thin `fetch` wrapper, `credentials: 'include'` (sends the httpOnly
  cookie), typed against the duplicated shared types (ADR-013), one place that redirects
  to `/login` on any `401`.
- **Canvas rendering — hybrid incremental + full redraw:** the strokes array (same
  shape as persisted `Board.data`) is the source of truth; the canvas is just a
  rendering of it, regenerated on demand.
  - **Incremental:** while a stroke is actively being drawn (any user), each new
    `stroke-point` draws just one short line segment onto the existing canvas — cheap,
    avoids repainting everything per point.
  - **Full redraw from state:** triggered by `stroke-removed`/`stroke-restored`
    (undo/redo), `board-cleared`, `board-joined` (initial load/reconnect), and window
    resize. Required, not optional, for resize specifically — resizing a `<canvas>`
    element clears its pixel buffer as a browser side-effect, so responsive layouts only
    work correctly if a "redraw everything from state" function always exists.
- **Cursors:** rendered as absolutely-positioned DOM elements overlaid on the canvas
  (from `cursor-update`), never drawn into the canvas pixels — drawing them onto the
  canvas would corrupt actual whiteboard content.
- **Folder structure:**
  ```
  client/src/
    main.tsx
    App.tsx              — routes
    pages/
      LoginPage.tsx / SignupPage.tsx
      BoardListPage.tsx
      BoardPage.tsx        — hosts Whiteboard + Toolbar + UserList
      JoinBoardPage.tsx
    components/
      Whiteboard.tsx / Toolbar.tsx / UserList.tsx / CursorOverlay.tsx
    hooks/
      useAuth.tsx / useBoardSocket.ts / useApi.ts
    types/
      index.ts
  ```

**Context:** Concrete frontend plan needed to actually implement the canvas, real-time
sync, and auth flows already decided server-side. The responsive-design requirement
directly motivated the full-redraw-on-resize rule.

**Alternatives considered:**
- **Redux/Zustand** — rejected; no cross-cutting client state complex enough to justify
  a state library over Context + local hooks, consistent with the project's minimal-
  dependency philosophy applied throughout (Express over Nest, `better-sqlite3` over
  Prisma).
- **React Query** — rejected; its value is caching/refetching REST data, but most live
  data here flows over sockets, not REST, and the few REST endpoints don't need
  automatic cache invalidation machinery — a manual refetch after a mutation is enough.
- **Wouter / TanStack Router** — considered as lighter/more type-safe alternatives to
  React Router; stuck with React Router since it's the de facto standard and needs no
  justification, unlike the deliberately-argued choices elsewhere in this stack.
- **Hand-rolled routing** (parsing `window.location` manually) — rejected outright:
  real URLs are needed (shareable `/join/:code` links, browser back/forward, refresh
  landing correctly), and reimplementing that is more risk than using a router.

**Trade-offs:** N/A beyond what's noted above.

---

## ADR-019: Socket contract addendum — explicit `leave-board` event

**Decision:** Add `leave-board { boardId }`, emitted by the client when navigating away
from a board *without* disconnecting the socket (SPA navigation between boards). Server
removes the socket from that board's room/`connectedUsers` and broadcasts `user-left`
immediately, the same as it would on a real disconnect.

**Context:** ADR-017 only defined behavior for a true `disconnect`. In a single-page
app, moving from `/boards/1` to `/boards/2` doesn't disconnect the socket at all — without
this event, a user would appear as a "phantom" connected participant on a board they've
already left, until the tab is eventually closed.

**Trade-offs:** N/A — closes a real gap, not a comparative choice.

---

## ADR-020: Bonus feature — real-time chat

**Decision:**
- **Scope:** per-board chat, tied to the same board room a user already joins for
  drawing (ADR-017) — not a global app-wide chat.
- **Persistence:** a real table, deliberately not a JSON blob:
  `ChatMessage — id, board_id (FK → Board), user_id (FK → User), text, created_at`,
  indexed on `board_id`.
- **Delivery — socket-driven, no new REST endpoint:** client emits
  `chat-message { text }` in the board room; server validates (non-empty after trim,
  length cap e.g. 2000 chars — membership already guaranteed by room presence), inserts
  the row, broadcasts `chat-message { id, userId, username, text, createdAt }` to the
  **whole room including the sender** — no optimistic local echo, so there's no
  duplicate-message reconciliation to get wrong.
- **History:** `board-joined` (ADR-017) extended to also include `messages` (most
  recent ~50) — consistent with the existing "full resync on join" pattern. No
  pagination/"load older messages" for now.
- **Security:** no sanitization library — messages render as plain text in JSX
  (`{message.text}`); React escapes text content by default as long as
  `dangerouslySetInnerHTML` is never used, so stored message text can never execute as
  HTML/script.
- **UI:** `ChatPanel.tsx` alongside `Whiteboard`/`Toolbar`/`UserList` in `BoardPage`;
  chat state (`messages`, `sendMessage`) folded into the existing
  `useBoardSocket(boardId)` hook rather than a new hook, since it shares the same
  socket/room lifecycle.

**Context:** The only bonus feature not already implied by the core design (save/load,
undo/redo, and auth are already core — see ADR-003/007/008). Chat needed its own design
pass.

**Alternatives considered:**
- **JSON blob on `Board`** (matching the strokes approach, ADR-006) — rejected: chat
  messages are discrete, append-only, individually meaningful records, which is exactly
  what a normalized table with a `board_id` index is for — unlike strokes, which are
  treated as one mutable canvas state. Deliberate contrast with ADR-006, not an
  inconsistency.
- **Separate `GET /api/boards/:id/messages` REST endpoint with pagination** — rejected
  for now; folding recent history into the existing `board-joined` payload is simpler
  and consistent with how strokes/users already resync on join. Noted as a scope cut,
  not an oversight, if asked.
- **Typing indicators, read receipts, edit/delete** — rejected: none required by "allows
  users to communicate in real-time," all add surface area without payoff at this scope.

**Trade-offs:** No older-message pagination means very long-lived boards only show
recent chat history in-app (though everything is still stored in `ChatMessage` and
could be exposed later); acceptable for this scope.

---

## ADR-021: Backend refactor — feature-grouped layering, no code comments

**Decision:**
- Replaced the flat `routes/auth.ts` / `routes/boards.ts` files with feature-grouped
  modules: `modules/{auth,boards}/`, each split into
  `*.repository.ts` (raw SQL only) → `*.service.ts` (business logic, throws typed
  errors) → `*.controller.ts` (thin — parses the request, calls the service, shapes
  the response) → `*.routes.ts` (path/method wiring only).
- Added `errors.ts` — `AppError` and typed subclasses (`ValidationError`,
  `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`), each
  carrying an HTTP status. `app.ts` now has one centralized error-handling middleware
  that maps any thrown `AppError` to its response, replacing the repeated
  `res.status(...).json({error...})` that used to appear in every handler.
- `sockets/board.ts` now calls `boardsService.isMember()` /
  `boardsService.getBoardStrokes()` instead of reimplementing them locally — this
  removes real duplication that existed between the REST and socket layers (the same
  membership-check logic was previously written twice).
- Removed every code comment from the backend. The reasoning they contained already
  lives in this file; keeping it in two places was pure duplication, not two
  different audiences.

**Context:** `routes/boards.ts` had grown to mix three concerns in every handler —
HTTP parsing, business rules (ownership/membership checks), and raw SQL — and,
concretely, `isMember()` and the strokes-hydration logic were duplicated between
`routes/boards.ts` and `sockets/board.ts` because there was no shared layer either
could call into. Requested explicitly after the fact, once the codebase had grown
enough for the problem to be visible.

**Alternatives considered:**
- **Layer-grouped folders** (top-level `routes/`, `controllers/`, `services/`,
  `repositories/`, one file per feature in each) — the more classic MVC layout;
  rejected in favor of feature-grouped, which keeps everything about one feature in
  one folder as the project's feature count grows.

**Trade-offs:** More files and more indirection to trace through than the original
flat routes — a real cost, weighed against removing actual duplication and giving the
404-vs-403 convention (ADR-016) one enforced home instead of trusting every handler to
replicate it correctly by hand. This adds more internal structure than ADR-001's
"minimal, avoid unnecessary abstraction" reasoning might suggest — worth being ready
to explain that distinction: ADR-001 was about avoiding a *framework's* baked-in
DI/decorator machinery (Nest), not about avoiding basic separation of concerns within
plain Express, which is what this still is.

**Caught along the way:** running `tsc --noEmit` — for the first time this session, having
relied on `tsx` (which does not type-check) throughout — surfaced 15 real type errors
that had been silently present in the codebase already, not introduced by this
refactor. All fixed as part of this change. Also re-ran the full regression suite
(auth, board CRUD, membership/invite, all socket events) live afterward; every
behavior confirmed identical to before the refactor.

---

## ADR-022: Auth identifier — email instead of username, separate `displayName`

**Decision:** Login/signup now key off `email` (unique, normalized to lowercase at the
service boundary before storage/lookup/comparison), not `username`. A separate
`displayName` field (not unique, no character restriction, 1-50 chars) is what's shown
to other users — connected-users list, `user-joined`/`cursor-update` presence events,
board membership lists, chat (later). **Email is deliberately excluded from the JWT
payload** (`AuthTokenPayload` is now `{ userId, displayName }`) — the token drives
real-time presence broadcasts, and a private credential like email shouldn't be
embedded in something that flows into those broadcasts. `GET /api/auth/me` does a real
DB lookup (`authService.getProfile`) rather than trusting the JWT payload directly,
specifically so it can return email (private, own-profile-only) alongside
`displayName`, keeping signup/login/me all returning the same `User` shape.

Board invites (ADR-009) now take an email, not a username — `findUserByEmail` instead
of `findUserByUsername`; member-list/invite responses carry `displayName`, never email.

**Context:** Raised directly: is email a better identifier than username? Concluded
yes for realism/defensibility in review, but only if paired with a separate display
name — otherwise other users' emails would be broadcast in real time to anyone sharing
a board, which is a privacy smell. This also closes out a bug found during the backend
audit: username matching was case-sensitive (`findUserByUsername` did an exact SQL
match), causing both duplicate-looking accounts (`Alice` vs `alice`) and failed invites
from a case mismatch. Normalizing email to lowercase at signup/login/invite time
resolves this the same way real systems do, without a separate fix.

**Alternatives considered:**
- **Email as the sole identifier, no separate display name** — rejected: would mean
  showing a stranger's raw email in the UI next to their cursor/drawing, which most
  comparable apps avoid.
- **Case-insensitive matching via SQL `COLLATE NOCASE`** instead of normalizing at the
  service layer — rejected in favor of lowercasing at the boundary; simpler, no schema
  collation change needed, and consistent with how virtually every real system treats
  email local-parts in practice.
- **Keeping `username` and adding `email` alongside it, unused** — rejected as the
  weakest option: adds schema/UX surface with no real function, harder to defend than
  either committing to email or leaving username as-is.

**Trade-offs:** No email verification exists (no SMTP capability, per ADR-009's
original "no email service" scope decision) — an unverified email is, at the trust
level, no stronger than an unverified username was. This is a realism/UX choice, not a
security upgrade, and worth being explicit about if asked. Also required deleting the
local dev SQLite file (no migration framework, ADR-012) since the schema itself
changed shape, not just restarted — a one-time local data loss, acceptable since only
test data existed.

---

## How to use this file

Whenever a new non-trivial technical decision is made (library choice, architecture
pattern, data model shape, auth strategy, etc.), append a new `ADR-00N` entry above in
the same Decision / Context / Alternatives considered / Trade-offs format, in the order
decisions are actually made.
