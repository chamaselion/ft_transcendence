# Create a document

Base path: `/api/documents` — see [Documents API](README.md) for auth, the permission model and common errors.

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
