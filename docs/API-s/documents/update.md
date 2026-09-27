# Update a document

Base path: `/api/documents` — see [Documents API](README.md) for auth, the permission model and common errors.

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

Success response (`200`): same shape as [Get a document](get.md),
without `owner` — the client already has it from the list or the initial read,
and re-joining it on every save would cost a query per keystroke batch.

Errors: `400` nothing to update / invalid field / `:id` is not a valid UUID,
`404` document not found **or the caller is only a viewer**.
