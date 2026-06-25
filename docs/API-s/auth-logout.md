# Logout API

Base path: `/api/auth`

## Logout

- Method: `POST`
- Path: `/logout`

Success response (`200`):

```json
{
  "loggedIn": false,
  "loggedOut": true
}
```

The backend clears the auth cookie even if the incoming request has no valid token.