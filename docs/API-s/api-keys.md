# API Keys

API keys let you call the REST API from scripts or a terminal without a browser
session or JWT cookie.

All endpoints below require an authenticated cookie session (or an existing API
key) and are mounted under `/api/auth`.

## Create a key

`POST /api/auth/api-keys`

```json
{
  "name": "My CLI key"
}
```

Response (`201`):

```json
{
  "apiKey": {
    "id": "uuid",
    "name": "My CLI key",
    "prefix": "transedit_ab12cd34",
    "lastUsedAt": null,
    "createdAt": "timestamp"
  },
  "token": "transedit_<secret>"
}
```

The `token` value is shown **once**. Store it somewhere safe.

## List keys

`GET /api/auth/api-keys`

Response:

```json
{
  "apiKeys": [
    {
      "id": "uuid",
      "name": "My CLI key",
      "prefix": "transedit_ab12cd34",
      "lastUsedAt": "timestamp or null",
      "createdAt": "timestamp"
    }
  ]
}
```

Revoked keys are omitted.

## Revoke a key

`DELETE /api/auth/api-keys/:id`

Returns `204` on success.

## Use a key

Send either header:

```bash
curl -k https://localhost:8443/api/documents \
  -H "Authorization: Bearer transedit_<secret>"
```

or:

```bash
curl -k https://localhost:8443/api/documents \
  -H "X-API-Key: transedit_<secret>"
```

The API key inherits the permissions and role of the user who created it. It
can be used with documents, shares, users (admin only), AI, profile icon, and
`GET /api/auth/me`. API keys are limited to 10 active keys per account and the
key secret is stored only as a SHA-256 hash.
