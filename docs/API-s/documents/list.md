# List documents

Base path: `/api/documents` — see [Documents API](README.md) for auth, the permission model and common errors.

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
