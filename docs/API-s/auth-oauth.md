# OAuth API

Base path: `/api/auth`

Supported providers: `github`, `42`.

## Start OAuth login

- Method: `GET`
- Path: `/oauth/:provider/authorize`

Query params:

- `nonce` (required): client-generated nonce used in OAuth state
- `next` (optional): safe relative redirect target after successful auth

This starts the OAuth login flow for the selected provider. The backend creates a one-time server-side state intent and redirects the browser to the provider authorization URL.

Example:

- `/api/auth/oauth/github/authorize`
- `/api/auth/oauth/42/authorize`

Success response (`302`):

- Redirect to the provider authorization page.

Common errors:

- `400` missing or unsupported provider
- `400` missing or invalid nonce
- `501` provider is not configured yet
- `500` server error

## Finish OAuth from frontend callback

- Method: `POST`
- Path: `/oauth/:provider/exchange`

Use this endpoint when the OAuth provider redirects to the frontend first. The frontend validates `nonce` from `state`, then forwards `code` and `state` to backend.

Important:

- The backend no longer accepts provider callbacks directly.
- Configure the provider redirect URI to point to the frontend callback route.

Request body:

```json
{
  "code": "provider-auth-code",
  "state": "base64url-encoded-state"
}
```

Success response (`200`):

```json
{
  "id": "uuid",
  "login": "github-user",
  "email": "john@example.com",
  "loggedIn": true,
  "provider": "github",
  "oauthAccountId": "uuid"
}
```

Common errors:

- `400` invalid provider, code, or state
- `401` unauthorized or unable to resolve the user
- `409` account conflict that requires explicit linking
- `501` provider is not configured yet
- `500` server error

## Link OAuth provider to an existing user

All endpoints below require the auth cookie and an active session.

- Method: `GET`
- Path: `/oauth/:provider/link`

Query params:

- `nonce` (required): client-generated nonce used in OAuth state
- `next` (optional): safe relative redirect target after successful linking

This starts the provider authorization flow for linking a provider account to the currently authenticated user.

Example:

- `/api/auth/oauth/github/link`
- `/api/auth/oauth/42/link`

Success response (`302`):

- Redirect to the provider authorization page.

Common errors:

- `400` unsupported provider
- `400` missing or invalid nonce
- `401` unauthorized
- `409` provider account is already linked to another user
- `501` provider is not configured yet
- `500` server error

## Finish linking provider account

- Method: `POST`
- Path: `/oauth/:provider/exchange`

For link requests, the backend validates the server-side user id stored in the one-time state and attaches the provider account to the authenticated local user without creating a new session.

Success response (`200`):

- API clients receive:

```json
{
  "linked": true,
  "provider": "github",
  "id": "uuid",
  "login": "john_doe",
  "email": "john@example.com",
  "oauthAccountId": "uuid"
}
```

Common errors:

- `400` invalid state or unsupported provider
- `401` unauthorized or user not found
- `409` provider account already belongs to another user
- `500` server error

## Set password for an OAuth-only account

- Method: `POST`
- Path: `/oauth/:provider/password`

This allows a user who authenticated with OAuth and does not yet have a local password to create one.

Request body:

```json
{
  "password": "password123"
}
```

Success response (`200`):

```json
{
  "passwordSet": true,
  "userId": "uuid"
}
```

Common errors:

- `400` invalid password format
- `401` unauthorized
- `409` password already set
- `500` server error
