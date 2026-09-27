# List shares

Base path: `/api/documents/:id/shares` — see [Shares API](README.md) for auth, the permission model and common errors.

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
