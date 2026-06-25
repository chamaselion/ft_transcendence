# Portfolio API

Base path: `/api/portfolio`

All portfolio endpoints require the auth cookie and an active session.

## Core idea

- A transaction is a signed quantity for one asset.
- Positive quantity means buy.
- Negative quantity means sell.
- Current holdings are derived from the transaction ledger, not stored directly.

## Endpoints

### Get holdings

- Method: `GET`
- Path: `/`

Returns net quantity per asset for the authenticated user.

### List transactions

- Method: `GET`
- Path: `/transactions`

Returns the raw ledger rows for the authenticated user.

### Add transaction

- Method: `POST`
- Path: `/transactions`

Request body:

```json
{
  "assetKey": "bitcoin",
  "quantity": -0.5,
  "date": "2024-05-01"
}
```

Positive quantity records a buy. Negative quantity records a sell.

### Edit transaction

- Method: `PUT`
- Path: `/transactions/:id`

Updates `quantity` and/or `date` for one transaction.

### Delete transaction

- Method: `DELETE`
- Path: `/transactions/:id`

Deletes a ledger row. This is for correcting an entry, not for selling an asset.

### Historical portfolio value

- Method: `GET`
- Path: `/history?interval=<1d|1wk|1mo>`

Returns a time series of total portfolio value based on held quantities and historical closes.

Common errors:

- `400` invalid input, invalid date, or oversell attempt
- `401` unauthorized
- `404` unknown asset or missing transaction
- `500` server error