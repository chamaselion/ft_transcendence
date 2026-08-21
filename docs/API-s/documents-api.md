# Documents API

Base path: `/api/documents`

All endpoints below require the auth cookie and an active session
(`requireAuth` middleware). Access is owner-scoped: a user can only see,
edit, or delete documents they own — there is no sharing between regular
users yet.

Admins (`role: "admin"`, see [Users API](users-api.md)) are the exception:
they can list, read, edit and delete **every** document in the system, and
their responses additionally carry `ownerId` so they can tell whose document
they are looking at. The same rule applies to the WebSocket layer — an admin
can join and edit any document room.

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

Returns every document owned by the caller, newest first — or every document
in the system if the caller is an admin.

Success response (`200`):

```json
{
  "documents": [
    { "id": "uuid", "title": "...", "content": "...", "createdAt": "timestamp", "updatedAt": "timestamp" }
  ]
}
```

## Get a document

- Method: `GET`
- Path: `/:id`

Success response (`200`):

```json
{
  "document": {
    "id": "uuid",
    "title": "My document",
    "content": "Some text",
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
}
```

Errors: `400` if `:id` is not a valid UUID, `404` if the document doesn't
exist or isn't owned by the caller (admins: only if it doesn't exist).

## Update a document

- Method: `PATCH`
- Path: `/:id`

`title`/`content` are validated and sanitized the same way as on create;
at least one of them must be present.

Request body:

```json
{
  "title": "New title",
  "content": "New content"
}
```

Success response (`200`): same shape as [Get a document](#get-a-document).

Errors: `400` nothing to update / invalid field / `:id` is not a valid UUID,
`404` document not found or not owned by the caller (admins: only if it
doesn't exist).

## Delete a document

- Method: `DELETE`
- Path: `/:id`

Success response: `204` (no body).

Errors: `400` if `:id` is not a valid UUID, `404` document not found or not
owned by the caller (admins: only if it doesn't exist).

Common errors across all endpoints above: `401` unauthorized (missing/invalid
session), `500` internal server error.
