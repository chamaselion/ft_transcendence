# Profile API

Base path: `/api/auth`

All endpoints below require the auth cookie and an active session.

## Get current user

- Method: `GET`
- Path: `/me`

Success response (`200`):

```json
{
  "loggedIn": true,
  "user": {
    "id": "uuid",
    "login": "john_doe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

`role` is either `"user"` or `"admin"` and is what the frontend uses to decide
whether to show admin-only views (see [Users API](users-api.md)).

Unauthenticated response (`401`):

```json
{
  "loggedIn": false
}
```

## Request profile update

- Method: `PATCH`
- Path: `/me`

Request body:

```json
{
  "login": "john_doe_v2",
  "email": "john.new@example.com"
}
```

Success response (`202`):

```json
{
  "profileUpdateConfirmationRequired": true,
  "confirmationId": "uuid",
  "email": "john.new@example.com",
  "attemptsRemaining": 3,
  "codeLength": 6,
  "expiresAt": "timestamp",
  "codeSent": true,
  "pendingUpdate": {
    "login": "john_doe_v2",
    "email": "john.new@example.com"
  }
}
```

Common errors:

- `400` invalid input or no changes requested
- `401` unauthorized
- `409` login or email already in use
- `500` server error

## Confirm profile update

- Method: `POST`
- Path: `/me/update/confirm`

Request body:

```json
{
  "confirmationId": "uuid",
  "email": "john.new@example.com",
  "code": "123456"
}
```

Success response (`200`):

```json
{
  "updated": true,
  "loggedIn": true,
  "user": {
    "id": "uuid",
    "login": "john_doe_v2",
    "email": "john.new@example.com"
  }
}
```

Common errors:

- `400` invalid confirmation id, email, code, or empty change set
- `401` unauthorized or invalid code
- `409` login or email already in use
- `410` expired or missing challenge
- `500` server error