# GDPR API

Base path: `/api/auth`

All endpoints below require the auth cookie and an active session.

## Data request

- Method: `POST`
- Path: `/me/data-request`

Success response (`202`):

```json
{
  "requestAccepted": true,
  "reference": "request-userId-timestamp",
  "emailSent": true
}
```

## Data export (JSON)

- Method: `GET`
- Path: `/me/data-export`

Returns a downloadable JSON file containing export metadata and all user-related
backend data currently associated with the account.

The payload includes:

- `exportDate`
- `userData.profile`
- `userData.authSessions`
- `userData.oauthAccounts`
- `userData.oneTimeChallenges`
- `userData.oauthStateIntents`
- `userData.gdprExportQuota`
- `userData.gdprAuditEvents`
- `userData.documentsOwned`
- `userData.documentSharesReceived`

## Data export (CSV)

- Method: `GET`
- Path: `/me/data-export/csv`

Returns a downloadable CSV file with the same data as JSON export, flattened into
`section`, `field`, `value` rows.

Both export endpoints return rate-limit headers:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `Retry-After` (only on `429`)

## Data deletion request

- Method: `POST`
- Path: `/me/data-deletion/request`

Success response (`202`):

```json
{
  "deletionRequested": true,
  "deletionConfirmationRequired": true,
  "confirmationId": "uuid",
  "reference": "deletion-userId-timestamp",
  "email": "john@example.com",
  "codeSent": true,
  "attemptsRemaining": 3,
  "codeLength": 6,
  "expiresAt": "timestamp"
}
```

## Data deletion confirm

- Method: `POST`
- Path: `/me/data-deletion/confirm`

Request body:

```json
{
  "confirmationId": "uuid",
  "code": "123456"
}
```

Success response (`200`):

```json
{
  "deleted": true,
  "loggedOut": true,
  "message": "Your data has been deleted.",
  "deletedRecords": {
    "user": 1,
    "authSessions": 2,
    "gdprExportQuota": 1,
    "gdprAuditEvents": 4,
    "userOauthAccounts": 1,
    "oauthStateIntents": 1,
    "oneTimeChallenges": 2,
    "documentShares": 3,
    "documents": 2
  }
}
```

`deletedRecords` values are delete counts for this request.

Common errors across GDPR endpoints:

- `401` unauthorized
- `429` export quota exceeded
- `400` invalid confirmation input for deletion confirm
- `410` expired or missing deletion challenge
- `500` internal server error