# Market Data API

This document covers symbol search, chart history, stored valuations, and live prices.

## Symbol search

- Method: `GET`
- Path: `/api/symbols/search?q=<query>`

Returns matches from the seeded asset catalog. Search is case-insensitive and capped at 20 results.

Example response:

```json
{
  "results": [
    { "key": "aapl", "name": "Apple", "type": "stock" }
  ]
}
```

## Chart history

- Method: `GET`
- Path: `/api/symbols/:symbol/history?interval=<iv>`

Returns fresh OHLC candles from Yahoo-backed history fetching.

Common errors:

- `400` unsupported interval
- `502` history fetch failed

## Stored asset catalog

- Method: `GET`
- Path: `/api/assets`

Returns the seeded asset list stored in PostgreSQL.

## Stored valuations

- Method: `GET`
- Path: `/api/assets/:key/valuations`

Returns persisted OHLC rows for one asset. Supports `interval`, `from`, and `to` filtering.

## Latest stored valuation

- Method: `GET`
- Path: `/api/assets/:key/valuations/latest`

Returns the newest stored close for one asset.

## Live prices

- Protocol: WebSocket
- Path: `/ws`

Frontend clients send watch and unwatch messages:

```json
{ "type": "watch", "symbol": "AAPL" }
```

The backend broadcasts live ticks in this shape:

```json
{
  "asset": "AAPL",
  "price": 299.34,
  "change": 1.2
}
```

Live prices are fed by the `srcs/price-feed` sidecar, which subscribes only to watched symbols.