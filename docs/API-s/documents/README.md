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

**Known limitation - last write wins.** An `update` carries the whole document
rather than the edit that produced it, so the server simply overwrites what is
stored. If two editors type at the same moment, one of the two versions is
lost, and it is lost *silently*: both messages are accepted, no error is
returned, and the overwritten text cannot be recovered. Taking turns works as
expected; genuinely simultaneous editing does not. Closing this gap means
sending operations instead of full text and merging them (OT, or a CRDT such
as yjs) - a rewrite of the update path on both ends, not a patch. This is a
deliberate scope decision, not an oversight.

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
