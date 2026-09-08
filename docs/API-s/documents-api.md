# Documents API

Base path: `/api/documents`

All endpoints below require the auth cookie and an active session
(`requireAuth` middleware).

## Permission model

Access to a document is resolved in one place,
[`controllers/documents/permissions.js`](../../srcs/backend/src/controllers/documents/permissions.js),
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
(`{ id, login }`) on [List](#list-documents) and [Get](#get-a-document), so a
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
[`controllers/documents/sanitize.js`](../../srcs/backend/src/controllers/documents/sanitize.js)).
Submitting markup does not get rejected outright, but it never survives
into storage — a value that is markup-only (e.g. a bare `<script>...</script>`)
collapses to an empty string and is treated as invalid input (`400`).

## Create a document

- Method: `POST`
- Path: `/`

Request body (both fields optional):

```json
{
  "title": "My document",
  "content": "Some text"
}
```

Success response (`201`):

```json
{
  "document": {
    "id": "uuid",
    "title": "My document",
    "content": "Some text",
    "permission": "owner",
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
}
```

Errors: `400` if `title` is provided but not a non-empty string (after
sanitization), or `content` is provided but not a string.

## List documents

- Method: `GET`
- Path: `/`

Returns the caller's own documents **plus every document shared with them**,
newest first — or every document in the system if the caller is an admin.
Each entry carries the caller's `permission` for that document.

Success response (`200`):

```json
{
  "documents": [
    {
      "id": "uuid",
      "title": "...",
      "content": "...",
      "permission": "editor",
      "owner": { "id": "uuid", "login": "alice" },
      "createdAt": "timestamp",
      "updatedAt": "timestamp"
    }
  ]
}
```

## Get a document

- Method: `GET`
- Path: `/:id`
- Requires: `viewer`

Success response (`200`):

```json
{
  "document": {
    "id": "uuid",
    "title": "My document",
    "content": "Some text",
    "permission": "viewer",
    "owner": { "id": "uuid", "login": "alice" },
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
}
```

Errors: `400` if `:id` is not a valid UUID, `404` if the document doesn't
exist or the caller has no access to it.

## Update a document

- Method: `PATCH`
- Path: `/:id`
- Requires: `editor`

`title`/`content` are validated and sanitized the same way as on create;
at least one of them must be present.

Request body:

```json
{
  "title": "New title",
  "content": "New content"
}
```

Success response (`200`): same shape as [Get a document](#get-a-document),
without `owner` — the client already has it from the list or the initial read,
and re-joining it on every save would cost a query per keystroke batch.

Errors: `400` nothing to update / invalid field / `:id` is not a valid UUID,
`404` document not found **or the caller is only a viewer**.

## Delete a document

- Method: `DELETE`
- Path: `/:id`
- Requires: `owner`

Success response: `204` (no body).

Errors: `400` if `:id` is not a valid UUID, `404` document not found or the
caller is not its owner (an editor gets `404` here as well).

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

# Shares

Base path: `/api/documents/:id/shares`

All four endpoints require `owner` on `:id` and answer `404` otherwise.

They are rate-limited to **60 requests per minute** per user (falling back to
the client IP), for the reason given under [Create a share](#create-a-share).

## List shares

- Method: `GET`
- Path: `/:id/shares`

Success response (`200`):

```json
{
  "shares": [
    {
      "userId": "uuid",
      "login": "bob",
      "email": "bob@example.com",
      "permission": "editor",
      "createdAt": "timestamp"
    }
  ]
}
```

The owner is not listed — ownership is `document.ownerId`, not a share row.

## Create a share

- Method: `POST`
- Path: `/:id/shares`

Request body:

```json
{
  "email": "bob@example.com",
  "permission": "viewer"
}
```

`permission` must be `viewer` or `editor`.

Grants are addressed by **email, not by user id**. That is not cosmetic:
`GET /api/users` is admin-only, so a regular user has no way to turn an email
into a user id and the feature would be unusable for everyone but admins. The
lookup happens server-side and is case-insensitive.

**Accepted trade-off:** the response reveals whether an email is registered
(`404 User not found`). The alternative — answering `204` for unknown
addresses — hides that, but then a typo silently produces a share that does not
exist. We chose the usable behaviour and rate-limit the endpoint instead.

Sharing with someone who already has a share **updates their level** and
answers `200` instead of creating a duplicate row (the unique index on
`(document_id, user_id)` would otherwise reject it).

Success response: `201` on a new share, `200` on an update:

```json
{
  "share": {
    "userId": "uuid",
    "login": "bob",
    "email": "bob@example.com",
    "permission": "viewer",
    "createdAt": "timestamp"
  }
}
```

Errors: `400` invalid email / invalid `permission` / target is the owner /
target is yourself, `404` no such user, or no such document for this caller.

## Update a share

- Method: `PATCH`
- Path: `/:id/shares/:userId`

Request body:

```json
{ "permission": "editor" }
```

Success response (`200`): same shape as [Create a share](#create-a-share).

Errors: `400` invalid `permission` or malformed id, `404` no such share.

A change of level is pushed into any open WebSocket connection of that user
immediately (message `{ "type": "permission", ... }`), so a user downgraded to
viewer stops being able to write without reloading the page.

The socket additionally re-resolves its own permission on every heartbeat tick
(30s). That covers the changes the share endpoints cannot push — above all a
**role** change: an admin demoted to `user` loses admin reach in an already
open room within one tick instead of keeping it until they rejoin. The same
check emits `{ "type": "revoked", ... }` if access disappeared entirely.

## Delete a share

- Method: `DELETE`
- Path: `/:id/shares/:userId`

Success response: `204` (no body).

Errors: `400` malformed id, `404` no such share.

The revoked user is evicted from the live document room immediately (message
`{ "type": "revoked", ... }`); their next `update` is rejected with
`Join a document first`, and re-joining fails like any other stranger.

---

Common errors across all endpoints above: `401` unauthorized (missing/invalid
session), `429` rate limit exceeded (share endpoints), `500` internal server
error.

Smoke tests: [`scripts/test-document-sharing.sh`](../../scripts/test-document-sharing.sh)
for the REST side, and
[`scripts/test-websocket-sharing.sh`](../../scripts/test-websocket-sharing.sh) for the
live side - a viewer being refused a write, a permission change reaching an
already-open socket, a revoke or logout closing one, and a demoted admin losing
their reach on the next heartbeat tick. That last case waits out a full tick, so
the live suite takes ~35s rather than a few seconds; it needs an admin account
(`ADMIN_EMAIL` / `ADMIN_PASS`) and skips itself without one.
