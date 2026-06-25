# Login API

Base path: `/api/auth`

## Start login

- Method: `POST`
- Path: `/login`

Request body:

```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

Success response (`202`):

```json
{
  "loginChallenge": true,
  "challengeId": "uuid",
  "email": "john@example.com",
  "emailMasked": "jo***@example.com",
  "attemptsRemaining": 3,
  "codeLength": 6,
  "expiresAt": "timestamp",
  "codeSent": true
}
```

Common errors:

- `400` invalid email or password format
- `401` invalid credentials
- `500` server error

## Confirm login

- Method: `POST`
- Path: `/login/confirm`

Request body:

```json
{
  "challengeId": "uuid",
  "email": "john@example.com",
  "code": "123456"
}
```

Success response (`200`):

```json
{
  "id": "uuid",
  "login": "john_doe",
  "email": "john@example.com",
  "loggedIn": true
}
```

On success the backend also sets the auth cookie.

Common errors:

- `400` invalid challenge id, email, or code format
- `401` invalid code or exhausted attempts
- `404` user not found
- `410` expired or missing challenge
- `500` server error