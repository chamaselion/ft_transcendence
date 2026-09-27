# Get a document

Base path: `/api/documents` — see [Documents API](README.md) for auth, the permission model and common errors.

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
