# OAuth API

Base path: `/api/auth`

Supported providers: `github`, `42`.

## Start OAuth login

- Method: `GET`
- Path: `/oauth/:provider/authorize`

This starts the provider login flow for the selected OAuth provider.

Example:

- `/api/auth/oauth/github/authorize`
- `/api/auth/oauth/42/authorize`

The backend redirects the browser to the provider authorization URL.

Success response (`302`):

- Redirect to the provider's authorization page.

Common errors:

- `400` missing or unsupported provider
- `501` provider is not configured yet
- `500` server error

## OAuth callback

- Method: `GET`
- Path: `/oauth/:provider/callback`

This is the callback URL configured with the provider. The provider redirects the user here with `code` and `state` in the query string.

The backend exchanges the authorization code for a provider access token, resolves or creates the user, and signs the app JWT cookie.

Success response (`200` or `302`):

- Browser clients are redirected to the original `next` target or `/`.
- API clients receive a JSON response like:

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

On success the backend also sets the auth cookie.

Common errors:

- `400` missing code/state, invalid state, or unsupported provider
- `401` unable to resolve the user for this OAuth account
- `501` provider is not configured yet
- `500` server error

## Link OAuth provider to an existing user

- Method: `GET`
- Path: `/oauth/:provider/link`

All endpoints below require the auth cookie and an active session.

This starts the provider login flow for linking a provider account to the currently authenticated local user.

Example:

- `/api/auth/oauth/github/link`
- `/api/auth/oauth/42/link`

Success response (`302`):

- Redirect to the provider authorization page.

Common errors:

- `400` unsupported provider
- `401` unauthorized
- `409` provider account is already linked to another user
- `501` provider is not configured yet
- `500` server error

## Finish linking provider account

- Method: `GET`
- Path: `/oauth/:provider/callback`

This is the same callback path as the login flow. When the request includes a linked user from the state payload, the backend attaches the provider account to the authenticated user instead of creating a new app user.

Success response (`200` or `302`):

- Browser clients are redirected to the original `next` target or `/`.
- API clients receive a JSON response like:

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
- `401` unauthorized
- `409` provider account already belongs to another user
- `500` server error

## Set a password for an OAuth-only account

- Method: `POST`
- Path: `/oauth/:provider/password`

All endpoints below require the auth cookie and an active session.

This allows a user who logged in via OAuth but does not yet have a local password to create one.

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
