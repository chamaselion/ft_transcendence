# Users API (admin)

Base path: `/api/users`

All endpoints below require the auth cookie and an active session
(`requireAuth`), **and** the caller's account must have the `admin` role
(`requireRole('admin')`). Any other authenticated user gets `403`; an
unauthenticated request gets `401`.

There is no self-service way to become an admin. The *first* admin is created
by the `ADMIN_EMAIL` startup bootstrap (see
[`services/adminBootstrap.js`](../../srcs/backend/src/services/adminBootstrap.js));
after that, an existing admin promotes others by `PATCH`ing the `role` field
below. The bootstrap matches `ADMIN_EMAIL` case-insensitively and only ever
promotes — clearing the variable does not demote anyone.

`:id` must be a UUID. A malformed id is rejected with `400`, not `404`.

`passwordHash` is never returned by any endpoint here.

These endpoints are rate limited to 60 requests per minute per admin.

**Deliberate design decision:** an admin can change another user's `login` and
`email` here *without* the one-time-code confirmation that the self-service
[`PATCH /api/auth/me`](auth-profile.md) flow requires. Combined with the
password reset flow that amounts to being able to take over any account. This
is accepted as inherent to the admin role rather than treated as a bug — the
mitigation is that admin accounts are handed out sparingly.

## List users

- Method: `GET`
- Path: `/`

### Query parameters

| Parameter | Values | Default | Meaning |
| --- | --- | --- | --- |
| `q` | any text, max 100 chars | — | matches `login` **or** `email`, case-insensitive |
| `role` | `admin`, `user` | — | only accounts with that role |
| `sort` | `login`, `email`, `createdAt` | `createdAt` | |
| `order` | `asc`, `desc` | `asc` | |
| `limit` | 1–100 | 20 | page size |
| `offset` | 0 or more | 0 | rows to skip |

`%` and `_` in `q` are matched literally, not as SQL wildcards. Passing no
parameters gives the previous behaviour — oldest account first — but paged.

Success response (`200`):

```json
{
  "users": [
    { "id": "uuid", "login": "alice", "email": "alice@example.com", "role": "user", "createdAt": "timestamp", "updatedAt": "timestamp" }
  ],
  "pagination": { "total": 42, "limit": 20, "offset": 0 }
}
```

`total` is the number of matches **before** paging.

Errors: `400` for an unknown `sort`, `order` or `role`, a `limit` outside
1–100, a non-numeric `limit`/`offset`, or a `q` longer than 100 characters.

## Get a user

- Method: `GET`
- Path: `/:id`

Success response (`200`):

```json
{
  "user": {
    "id": "uuid",
    "login": "alice",
    "email": "alice@example.com",
    "role": "user",
    "createdAt": "timestamp",
    "updatedAt": "timestamp"
  }
}
```

Errors: `400` if `:id` is not a valid UUID, `404` if no user with that id exists.

## Update a user

- Method: `PATCH`
- Path: `/:id`

`login`/`email` are validated with the same rules as registration
(`login`/`email` validators in
[`controllers/auth/validation.js`](../../srcs/backend/src/controllers/auth/validation.js)).
`role` must be `"admin"` or `"user"`. At least one field must be present.

An admin cannot change **their own** role through this endpoint, not even to
the value it already has. Self-demotion could leave the system without a
single admin, and the only way back would be an `ADMIN_EMAIL` bootstrap plus a
backend restart — so role changes always go through a *different* admin.

Request body (all fields optional, at least one required):

```json
{
  "login": "new-login",
  "email": "new-email@example.com",
  "role": "admin"
}
```

Success response (`200`): same shape as [Get a user](#get-a-user).

Errors: `400` nothing to update / invalid field / `:id` is not a valid UUID /
caller tried to change their own role, `404` user not found, `409` login or
email already in use.

## Delete a user

- Method: `DELETE`
- Path: `/:id`

Deleting a user also removes everything attached to them: their auth sessions
and documents (FK cascade), their GDPR export quota and GDPR audit events, and
their entries in the in-memory session cache. This mirrors what the
[GDPR self-service deletion](gdpr-api.md) flow does, so no orphaned rows about
a deleted user are left behind.

Success response: `204` (no body).

Errors: `400` if `:id` is not a valid UUID, or if the caller tries to delete
their own account through this endpoint (use the regular account deletion flow
instead), `404` user not found.

Common errors across all endpoints above: `401` unauthorized (missing/invalid
session), `403` authenticated but not an admin, `429` rate limit exceeded,
`500` internal server error.

Smoke test: [`scripts/test-user-search.sh`](../../scripts/test-user-search.sh)
covers the query parameters above, the role filter and the 403 for non-admins.
It needs the stack running, `EMAIL_TRANSPORT=console`, and an admin account
(`ADMIN_EMAIL` / `ADMIN_PASS`).
