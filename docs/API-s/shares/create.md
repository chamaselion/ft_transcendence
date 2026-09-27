# Create a share

Base path: `/api/documents/:id/shares` — see [Shares API](README.md) for auth, the permission model and common errors.

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
