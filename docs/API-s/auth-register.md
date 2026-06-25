# Register API

Base path: `/api/auth`

## Create account

- Method: `POST`
- Path: `/register`

Request body:

```json
{
  "login": "john_doe",
  "email": "john@example.com",
  "password": "password123"
}
```

Success response (`201`):

```json
{
  "id": "uuid",
  "login": "john_doe",
  "email": "john@example.com",
  "registered": true
}
```

Common errors:

- `400` invalid login, email, or password
- `409` login or email already in use
- `500` server error