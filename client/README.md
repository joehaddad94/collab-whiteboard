# Collab Whiteboard — Client

React 19 + TypeScript, built with Vite. Plain CSS, no UI framework. No Redux,
Zustand or React Query — nothing here is complex enough to need one, and most
live data arrives over a socket rather than through REST.

## Setup

```bash
cd client
npm install
cp .env.example .env    # defaults work against the server's default port
npm run dev
```

Opens on `http://localhost:5173`. The server has to be running too, see
[`server/README.md`](../server/README.md).

| Variable | Default | |
|---|---|---|
| `VITE_API_BASE` | `http://localhost:4000` | REST base URL and Socket.io target |

Vite inlines this at build time, so it isn't read at runtime. Pointing a build
at a different backend means rebuilding.

| | |
|---|---|
| `npm run dev` | dev server with HMR |
| `npm run build` | `tsc -b` then production build |
| `npm run preview` | serve the build |
| `npm run lint` | oxlint |

## How it's put together

```
src/
  pages/        LoginPage, SignupPage, BoardListPage, BoardPage
  components/   Whiteboard, Toolbar, UserList, CursorOverlay, ChatPanel,
                PeopleDialog, Dialog, ConfirmDialog, Avatar, icons,
                ErrorBoundary
  hooks/        useAuth, useApi, useBoardSocket
  lib/          worldView (coordinate space), formatRelativeTime
  types/        shared shapes, duplicated from the backend on purpose
```

Anything with real logic is a folder: `index.tsx` holds the markup, `useX.ts`
holds the state, effects and handlers. So `BoardPage/index.tsx` reads as a
description of the screen, and `useBoardPage.ts` is where the thinking is.
Components with nothing to separate (`Toolbar`, `UserList`, `icons`) stay a
single file. `ErrorBoundary` is a class, because React still has no hook
equivalent of `getDerivedStateFromError`.

### Where state lives

Four owners, deliberately kept apart:

- **`useAuth`** — the session. Context, because everything needs it. On mount
  it calls `/api/auth/me`, since the cookie is httpOnly and JavaScript can't
  read it: asking the server is the only way to know whether you're logged in.
- **`useBoardSocket`** — one board's live connection. Presence, chat, save
  status, connection state.
- **`useWhiteboard`** — the canvas. Strokes, tools, pointer handling.
- **`useCursorOverlay`** — other people's cursors, and nothing else.

Cursors get their own hook for a specific reason. `cursor-update` is by far
the highest-frequency event a client receives, roughly 25 a second per other
user. Holding that in `useBoardSocket` would re-render `BoardPage` and every
child on every mouse twitch. Isolated, a moving cursor re-renders one overlay.

`Toolbar`, `UserList` and `Whiteboard` are memoised, which is only worth
anything if their props are stable, so the callbacks passed to them are
wrapped in `useCallback`. One unstable prop and `memo` does nothing.

### The canvas

Strokes are drawn imperatively through a ref, not by re-rendering. A pointer
move appends a segment straight to the 2D context; React never sees it. The
`strokes` state exists for full redraws only — resize, undo, redo, joining a
board — which is also why the same data is held in a ref alongside it. The ref
is what the draw code reads, because it's always current; the state is what
triggers a re-render when something structural changes.

Repainting the whole canvas per mouse move would be wasted work, and routing
every point through React state would be worse.

### Coordinates

The board is a fixed 1920×1080 logical surface. Points are stored and sent in
those units, and each client computes a fit-to-container transform, so two
people on different screen sizes see the same drawing rather than the same
pixels. Drawing is clipped to that page, and the page is drawn as a visible
sheet so the margin beside it doesn't look drawable when it isn't.

Before this, strokes were in raw CSS pixels: the same stroke landed somewhere
different on every screen, and resizing your own window moved the drawing
under you.

## What it does

**Auth.** Email, a unique username (3–20 letters and numbers), password of 8+.
Log in with either the username or the email. The session survives a refresh
for 7 days.

**Boards.** `/boards` is a card grid of everything you're a member of, with
role and last-edited time. Owners can rename and delete inline, behind a real
confirmation dialog rather than `confirm()`. The list refetches when you return
to the tab, so a board shared with you while you were elsewhere is simply there
— there's no push, because the socket is per-board and this page holds no
connection.

**Drawing.** Pen and eraser, six colours, a brush size slider with a preview
dot at the actual size. Undo and redo are per person: you can only undo your
own strokes. Clear wipes the board for everyone, so it asks first.

**Saving.** There's no Save button. The server writes a couple of seconds after
changes stop, and again when the last person leaves. The indicator by the board
title reports what the server actually wrote, not what this browser believes it
sent.

**Presence and cursors.** Avatar chips in the header for whoever is on the
board, updating live. Other people's cursors follow their pointers, labelled
and coloured.

**People.** Lists everyone with access, their role, and a green dot for anyone
connected right now. Owners can invite by username — the field checks as you
type, so "no account with that username" or "already on this board" appears
before you submit. Everyone else gets a Leave button on their own row. Being
removed, leaving, or having a board deleted under you all return you to the
board list with a note saying which.

Presence and membership are different questions. The header chips answer who
is here; this dialog answers who is allowed in.

**Chat.** Per board, persisted, with history on join.

**Offline.** If the connection drops, drawing stops and the canvas says so.
Anything drawn while disconnected would never reach the server and would be
wiped by the next full sync, so it's refused rather than silently discarded.

## Responsive and accessibility

Below 720px the header wraps, chat becomes a full-screen overlay instead of
squeezing the canvas, and the toolbar scrolls sideways rather than clipping.

Dialogs take focus on open, trap Tab, restore focus to whatever opened them,
and close on Escape. Error messages are `role="alert"`, so a failed login is
announced rather than silently appearing. Every control has a label; the
brush-size slider has one too, since a bare range input announces as nothing.
