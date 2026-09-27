# Update a share

Base path: `/api/documents/:id/shares` — see [Shares API](README.md) for auth, the permission model and common errors.

- Method: `PATCH`
- Path: `/:id/shares/:userId`

Request body:

```json
{ "permission": "editor" }
```

Success response (`200`): same shape as [Create a share](create.md).

Errors: `400` invalid `permission` or malformed id, `404` no such share.

A change of level is pushed into any open WebSocket connection of that user
immediately (message `{ "type": "permission", ... }`), so a user downgraded to
viewer stops being able to write without reloading the page.

The socket additionally re-resolves its own permission on every heartbeat tick
(30s). That covers the changes the share endpoints cannot push — above all a
**role** change: an admin demoted to `user` loses admin reach in an already
open room within one tick instead of keeping it until they rejoin. The same
check emits `{ "type": "revoked", ... }` if access disappeared entirely.
