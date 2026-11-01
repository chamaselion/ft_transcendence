# Documents API

Base path: `/api/documents`

All endpoints below require the auth cookie and an active session
(`requireAuth` middleware).

Shares have their own docs: [Shares API](../shares/README.md).

## Endpoints

- [Create a document](create.md)
- [List documents](list.md)
- [Get a document](get.md)
- [Update a document](update.md)
- [Delete a document](delete.md)

## Permission model

Access to a document is resolved in one place,
[`controllers/documents/permissions.js`](../../../srcs/backend/src/controllers/documents/permissions.js),
and comes from three sources:

| Source | Effective level |
| --- | --- |
| `document.ownerId` matches the caller | `owner` |
| a `documentShare` row for (document, caller) | `editor` or `viewer` |
| the caller has `role: "admin"` | `owner` on every document |

The levels are ranked `viewer < editor < owner`:

| Action | Required level |
| --- | --- |
| read (`GET /:id`, WS `join`) | `viewer` |
| write (`PATCH /:id`, WS `update`) | `editor` |
| delete the document, manage its shares | `owner` |

Deleting is owner-only on purpose: an editor may change the contents but must
not be able to destroy the document and every share on it. Managing shares is
owner-only for the same reason — otherwise every editor could widen the circle
further and the owner would lose control over who reaches the document.

Every document in a response carries the caller's own `permission`, so a client
can render a read-only editor for a viewer without asking again per document.

A document the caller does **not** own additionally carries `owner`
(`{ id, login }`) on [List](list.md) and [Get](get.md), so a
viewer or editor can see who shared it with them. The login is included because
`GET /api/users` is admin-only — a bare owner id would be unresolvable for a
regular user. Your own documents omit it, and admins get `ownerId` instead.

Admins additionally get `ownerId` in their responses so they can tell whose
document they are looking at. The same rules apply to the WebSocket layer.

**Insufficient access always answers `404`, never `403`** — including on the
share endpoints. A `403` would confirm that the id exists and turn the API into
an oracle for enumerating document ids.

`:id` must be a UUID. A malformed id is rejected with `400`, not `404`.

`title` and `content` are sanitized server-side before being stored (all
HTML tags/attributes are stripped, see
[`controllers/documents/sanitize.js`](../../../srcs/backend/src/controllers/documents/sanitize.js)).
Submitting markup does not get rejected outright, but it never survives
into storage — a value that is markup-only (e.g. a bare `<script>...</script>`)
collapses to an empty string and is treated as invalid input (`400`).

## Live editing, and what it does not do

The WebSocket layer (`WS /api/ws`) mirrors the permissions above: `viewer` may
join a document and watch, `editor` may also push updates, and every saved
change is broadcast to the others in the same room.

**Reconnects and offline edits.** The server computes a sha-256 content hash
over the canonical block list (`[id, unescaped text, decorator]`, in order).
A client can send `baseHash` and `localHash` with `join`:

- If either hash matches the current content, the `init` response is marked
  `unchanged: true` and omits `document.content`. Title, permission, locks and
  the current `contentHash` are always included.
- Otherwise `init` contains the full snapshot and its `contentHash`.

After a reconnect, the client merges the server snapshot with its draft and
sends only the resulting changes through `sync`:

```json
{
  "type": "sync",
  "documentId": "uuid",
  "requestId": "client-generated-id",
  "ops": [
    { "kind": "set", "blockId": "block-id", "text": "text", "decorator": "{}", "expected": "sha256" },
    { "kind": "create", "block": { "id": "block-id", "text": "", "decorator": "{}" }, "afterBlockId": null, "expected": null },
    { "kind": "delete", "blockId": "block-id", "expected": "sha256" },
    { "kind": "move", "blockId": "block-id", "afterBlockId": "previous-block-id" },
    { "kind": "title", "title": "Title", "expectedTitle": "Previous title" }
  ]
}
```

Each operation carries the fingerprint the client last saw for that block. The
server applies the batch atomically under the per-document write lock and
rejects it if a target is locked by another client or its fingerprint changed.
The reply is either `sync_ok { contentHash }` or `sync_conflict` with the
current block (or title) so the client can update its conflict view. Saves are
broadcast as the usual granular `block_*`/`title_updated` events.

**Known limitation - live simultaneous editing is still last write wins.**
When two clients edit the same block while both are connected, locks normally
serialize them; if a full `update` is used, the server overwrites the stored
document. Offline reconnects are protected by the fingerprint checks above,
but this is not an OT/CRDT implementation.

The browser client keeps unsaved blocks and unresolved conflicts in
localStorage, restores them after a reload, and displays same-block conflicts
inline (local and server versions side by side). See
[`scripts/test-websocket-reconnect.js`](../../../scripts/test-websocket-reconnect.js)
for the server-side flow.

## Live rooms and persistence

While at least one client is connected to a document room, the title and block
content are kept in backend memory. WebSocket edits do **not** write to
PostgreSQL, and neither does `PATCH /api/documents/:id` while the room is live.
When the last participant leaves, the room is written back to the database in
one operation. Empty blocks (text is empty or whitespace only) are discarded at
that point. `GET` and list responses overlay the live snapshot so callers see
the current title/content even before persistence. While a room is live,
`PATCH /api/documents/:id` returns `409` if it tries to replace content while
any block is locked by another client.

Search and default `updatedAt` ordering in `GET /api/documents` still use PostgreSQL
values, so unsaved live content is not searchable until the room is persisted.

A user may have at most `MAX_WS_SESSIONS_PER_USER` concurrent WebSocket sessions
(default `3`). Additional connections receive a `Too many concurrent sessions` error and are closed.

API clients can use [API keys](../api-keys.md) instead of a browser session.

---

Common errors across all endpoints above: `401` unauthorized (missing/invalid
session), `500` internal server error.

Smoke tests: [`scripts/test-document-sharing.sh`](../../../scripts/test-document-sharing.sh)
for the REST side, and
[`scripts/test-websocket-sharing.sh`](../../../scripts/test-websocket-sharing.sh) for the
live side - a viewer being refused a write, a permission change reaching an
already-open socket, a revoke or logout closing one, and a demoted admin losing
their reach on the next heartbeat tick. That last case waits out a full tick, so
the live suite takes ~35s rather than a few seconds; it needs an admin account
(`ADMIN_EMAIL` / `ADMIN_PASS`) and skips itself without one.

Reconnect/sync smoke test: [`scripts/test-websocket-reconnect.sh`](../../../scripts/test-websocket-reconnect.sh)
(hash fast path, full snapshot, batched sync, stale fingerprint conflict, title-only reconnect).
