# Shares

Base path: `/api/documents/:id/shares`

All four endpoints require `owner` on `:id` and answer `404` otherwise.

They are rate-limited to **60 requests per minute** per user (falling back to
the client IP), for the reason given under [Create a share](create.md).

The permission model is described in [Documents API](../documents/README.md#permission-model).

## Endpoints

- [List shares](list.md)
- [Create a share](create.md)
- [Update a share](update.md)
- [Delete a share](delete.md)

---

Common errors across all endpoints above: `401` unauthorized (missing/invalid
session), `429` rate limit exceeded, `500` internal server error.

Smoke tests: [`scripts/test-document-sharing.sh`](../../../scripts/test-document-sharing.sh)
for the REST side, and
[`scripts/test-websocket-sharing.sh`](../../../scripts/test-websocket-sharing.sh) for the
live side - a viewer being refused a write, a permission change reaching an
already-open socket, a revoke or logout closing one, and a demoted admin losing
their reach on the next heartbeat tick. That last case waits out a full tick, so
the live suite takes ~35s rather than a few seconds; it needs an admin account
(`ADMIN_EMAIL` / `ADMIN_PASS`) and skips itself without one.
