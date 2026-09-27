# Delete a share

Base path: `/api/documents/:id/shares` — see [Shares API](README.md) for auth, the permission model and common errors.

- Method: `DELETE`
- Path: `/:id/shares/:userId`

Success response: `204` (no body).

Errors: `400` malformed id, `404` no such share.

The revoked user is evicted from the live document room immediately (message
`{ "type": "revoked", ... }`); their next `update` is rejected with
`Join a document first`, and re-joining fails like any other stranger.
