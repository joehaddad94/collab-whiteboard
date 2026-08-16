# Collab Whiteboard — Client

React + TypeScript frontend, built with Vite. Plain CSS (no framework), plain
React state (no Redux/Zustand/React Query) — see the root
[`README.md`](../README.md#technical-decisions) for why.

## Setup

```bash
cd client
npm install
cp .env.example .env   # defaults are fine for local dev against the server's default port
npm run dev
```

Opens on `http://localhost:5173`. The backend needs to be running too — see
[`server/README.md`](../server/README.md) — the client won't do anything
useful on its own.

### Environment variables (`.env`)

| Variable | Default | Notes |
|---|---|---|
| `VITE_API_BASE` | `http://localhost:4000` | Both the REST base URL and the Socket.io connection target. |

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Vite dev server with HMR. |
| `npm run build` | Type-check (`tsc -b`) then production build to `dist/`. |
| `npm run preview` | Serve the production build locally. |
| `npm run lint` | oxlint. |

## Features

### Auth
Sign up with an email, a unique username (3-20 letters/numbers), and a
password (8+ characters). Log in with **either your username or your email**,
plus the password. Session persists via an httpOnly
cookie; refreshing the page keeps you logged in until the token expires (7
days) or you log out.

### Boards
`/boards` lists every board you're a member of, as a card grid, with a role
badge (Owner/Editor). Create one from the input at the top. Owners can rename
or delete a board inline; either action needs confirmation first (a real
dialog, not a browser `confirm()`). Click anywhere on a card to open it.

### The whiteboard
`/boards/:id` — a full-screen canvas. The floating toolbar (bottom center)
has pen/eraser, 6 preset colors, a brush-size slider, and undo/redo/clear.
Clearing asks for confirmation, since it affects everyone on the board and
can't be undone. Drawing, erasing, and undo/redo all sync live to everyone
else connected to the same board as you make them — there's no save step
required to see each other's changes in real time.

Boards **autosave** — there's no Save button. The server writes a board a
couple of seconds after it stops changing, and again when the last person
leaves, so nothing is lost by forgetting to save. The status text next to the
board title ("Saved" / "Unsaved changes") reflects what the server has
actually written, not what this browser thinks it sent.

Real-time sync and saving are still two different things: the live drawing
you see is relayed by the server without touching the database per stroke,
and persistence is what makes a board survive a restart or reload correctly
after it goes idle.

If the connection drops, drawing is **paused** rather than accepted and
thrown away — the canvas stops taking input and says so, because anything
drawn while disconnected never reaches the server and would be replaced by
the full board state on reconnect.

### Presence & cursors
Everyone currently viewing the board shows up as an avatar chip in the
header (you're labeled "You"), live, as people join and leave. Move your
mouse over the canvas and everyone else sees a labeled, colored cursor
tracking it.

### People
The "People" button opens a dialog listing everyone with access to the board,
with their role and a green dot for anyone currently connected. Anyone on the
board can open it — seeing who else has access isn't an owner-only concern.

Owners additionally get to invite and remove from here. Invite is by
**username** — the same name people are shown by everywhere else in the app,
matched case-insensitively — and the field checks as you type, so "no account
with that username", "already on this board", or a confirmed match appears
before you submit rather than after. They're added as an Editor immediately,
with no accept step, and the list refreshes so they appear in it. Removing
takes a second click to confirm in the row, and takes effect immediately — if
that person is on the board right now, they're dropped from it.

Note this is *membership*, which is a different question from *presence*: the
avatar chips in the header show who is connected this second and update live
over the socket, while this dialog shows who is allowed in.

### Chat
Toggle the chat panel from the header icon. Per-board, persisted (not just
for people currently online — history loads when you open a board), and
delivered in real time.

### Responsive
Below ~720px wide, the header wraps instead of overflowing, the chat panel
becomes a full-screen overlay instead of squeezing the canvas down to
nothing, and the toolbar scrolls horizontally instead of getting clipped.

## Project structure

Every page and every component with real logic (state, effects, handlers)
is a folder: `index.tsx` (markup only) + `useX.ts` (the logic) — e.g.
`pages/BoardPage/index.tsx` + `useBoardPage.ts`. Purely presentational
components with nothing to split out (`Toolbar`, `UserList`, icons) stay a
single file. `ErrorBoundary` is the one forced exception — React has no hook
equivalent for `getDerivedStateFromError`/`componentDidCatch`, so it has to
be a class component.

```
src/
  pages/            LoginPage, SignupPage, BoardListPage, BoardPage
  components/       Whiteboard, Toolbar, UserList, CursorOverlay, ChatPanel,
                     PeopleDialog, Dialog, ConfirmDialog, Avatar, icons,
                     ErrorBoundary
  hooks/            useAuth, useApi, useBoardSocket
  lib/              worldView (board coordinate space), formatRelativeTime
  types/            shared types (deliberately duplicated from the backend's
                     own types, not a shared package - see root README)
```
