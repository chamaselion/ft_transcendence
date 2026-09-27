# Delete a document

Base path: `/api/documents` — see [Documents API](README.md) for auth, the permission model and common errors.

- Method: `DELETE`
- Path: `/:id`
- Requires: `owner`

Success response: `204` (no body).

Errors: `400` if `:id` is not a valid UUID, `404` document not found or the
caller is not its owner (an editor gets `404` here as well).
