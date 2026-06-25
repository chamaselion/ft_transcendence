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

Returns a downloadable JSON file containing user data, referenced assets, and transactions.

## Data export (CSV)

- Method: `GET`
- Path: `/me/data-export/csv`

Returns a downloadable CSV file with the same data grouped into readable sections.

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
    "transactions": 0,
    "valuations": 0,
    "assets": 0
  }
}
```

Common errors across GDPR endpoints:

- `401` unauthorized
- `429` export quota exceeded
- `400` invalid confirmation input for deletion confirm
- `410` expired or missing deletion challenge
- `500` internal server error