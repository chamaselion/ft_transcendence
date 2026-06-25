# Password Reset API

Base path: `/api/auth`

## Request reset

- Method: `POST`
- Path: `/password-reset/request`

Request body:

```json
{
  "email": "john@example.com"
}
```

Success response (`202`):

```json
{
  "accepted": true,
  "message": "If an account exists for that email, a password reset code has been sent."
}
```

The response is intentionally generic to avoid account enumeration.

## Confirm reset

- Method: `POST`
- Path: `/password-reset/confirm`

Request body:

```json
{
  "confirmationId": "uuid",
  "email": "john@example.com",
  "code": "123456",
  "newPassword": "new-password123"
}
```

Success response (`200`):

```json
{
  "passwordReset": true
}
```

Common errors:

- `400` invalid confirmation id, email, code, or password format
- `401` invalid code or exhausted attempts
- `404` user not found
- `410` expired or missing challenge
- `500` server error