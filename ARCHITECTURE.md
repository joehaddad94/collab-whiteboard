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

## How to use this file

Whenever a new non-trivial technical decision is made (library choice, architecture
pattern, data model shape, auth strategy, etc.), append a new `ADR-00N` entry above in
the same Decision / Context / Alternatives considered / Trade-offs format, in the order
decisions are actually made.
