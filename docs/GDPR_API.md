# GDPR API Documentation

## Overview

These endpoints cover GDPR-related user actions under `/api/auth/me/*`.

**Base URL (through WAF):** `https://localhost:9443/api/auth`

All GDPR endpoints require an authenticated JWT cookie and an active server-side session.

---

## API Endpoints

### 1. Data Request

**Endpoint:** `POST /me/data-request`

**Description:** Register a GDPR data-access request and send a confirmation email.

**Request Headers:**
```
Cookie: token=JWT_TOKEN_HERE
```

**Success Response (202 Accepted):**
```json
{
	"requestAccepted": true,
	"reference": "request-userId-timestamp",
	"emailSent": true,
	"message": "Your data request has been received. A confirmation email has been sent."
}
```

**Error Responses:**

| Status | Response | Reason |
|--------|----------|--------|
| 401 | `{ "error": "Unauthorized" }` | Missing/invalid token, inactive session, or user not found |
| 500 | `{ "error": "Internal server error" }` | Unexpected server error |

---

### 2. Data Export

**Endpoint:** `GET /me/data-export`

**Description:** Export all user-related data as a downloadable JSON file.

**Request Headers:**
```
Cookie: token=JWT_TOKEN_HERE
```

**Success Response (200 OK):**
- Content is returned as an attachment (`Content-Type: application/json`)
- Response includes rate-limit headers:
	- `X-RateLimit-Limit`
	- `X-RateLimit-Remaining`
	- `X-RateLimit-Reset`
- Exported JSON fields:
	- `userData`: current account profile fields
	- `assets`: distinct assets referenced by the user's transactions
	- `transactions`: the user's transaction rows, including their linked asset data

```json
{
	"exportDate": "2026-06-20T10:30:00.000Z",
	"userData": {
		"id": "uuid",
		"login": "john_doe",
		"email": "john@example.com",
		"createdAt": "timestamp",
		"updatedAt": "timestamp"
	},
	"assets": [
		{
			"id": "uuid",
			"key": "bitcoin",
			"symbol": "BTC-USD",
			"type": "crypto",
			"name": "Bitcoin",
			"assetValuations": []
		}
	],
	"transactions": [
		{
			"id": "uuid",
			"quantity": "0.5",
			"date": "2026-06-20",
			"createdAt": "timestamp",
			"updatedAt": "timestamp",
			"asset": {
				"id": "uuid",
				"key": "bitcoin",
				"symbol": "BTC-USD",
				"type": "crypto",
				"name": "Bitcoin",
				"assetValuations": []
			}
		}
	]
}
```

**Error Responses:**

| Status | Response | Reason |
|--------|----------|--------|
| 401 | `{ "error": "Unauthorized" }` | Missing/invalid token, inactive session, or user not found |
| 429 | `{ "error": "...", "retryAfterSeconds": number, "limit": number, "remaining": number, "resetAt": number }` | Export quota/rate limit exceeded |
| 500 | `{ "error": "Internal server error" }` | Unexpected server error |

### 2b. Data Export (CSV)

**Endpoint:** `GET /me/data-export/csv`

**Description:** Export all user-related data as a single downloadable CSV file with sectioned rows.

**Request Headers:**
```
Cookie: token=JWT_TOKEN_HERE
```

**Success Response (200 OK):**
- Content is returned as an attachment (`Content-Type: text/csv; charset=utf-8`)
- Response includes rate-limit headers:
	- `X-RateLimit-Limit`
	- `X-RateLimit-Remaining`
	- `X-RateLimit-Reset`
- CSV is organized into readable sections in one file:
	- `meta` (export timestamp)
	- `user` (profile fields)
	- `asset` (assets referenced by the user's transactions)
	- `assetValuation` (valuation history rows)
	- `transaction` (transaction rows, including asset id/key/symbol metadata and trade date)

**Error Responses:**

| Status | Response | Reason |
|--------|----------|--------|
| 401 | `{ "error": "Unauthorized" }` | Missing/invalid token, inactive session, or user not found |
| 429 | `{ "error": "...", "retryAfterSeconds": number, "limit": number, "remaining": number, "resetAt": number }` | Export quota/rate limit exceeded |
| 500 | `{ "error": "Internal server error" }` | Unexpected server error |

---

### 3. Data Deletion

Data deletion is a two-step flow: request deletion, then confirm with a one-time code.

### 3a. Request Data Deletion

**Endpoint:** `POST /me/data-deletion/request`

**Description:** Start deletion flow and send a one-time confirmation code by email.

**Request Headers:**
```
Cookie: token=JWT_TOKEN_HERE
```

**Success Response (202 Accepted):**
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
	"expiresAt": "2026-06-20T10:30:00.000Z",
	"debugCode": "123456",
	"message": "A confirmation code has been sent. Confirm it to permanently delete your data."
}
```

**Error Responses:**

| Status | Response | Reason |
|--------|----------|--------|
| 401 | `{ "error": "Unauthorized" }` | Missing/invalid token, inactive session, or user not found |
| 500 | `{ "error": "Internal server error" }` | Unexpected server error |

### 3b. Confirm Data Deletion

**Endpoint:** `POST /me/data-deletion/confirm`

**Description:** Verify confirmation code and permanently delete user data.

**Request Headers:**
```
Cookie: token=JWT_TOKEN_HERE
Content-Type: application/json
```

**Request Body:**
```json
{
	"confirmationId": "uuid",
	"code": "123456"
}
```

**Success Response (200 OK):**
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

`deletedRecords.assets` and `deletedRecords.valuations` count orphaned assets and valuations that were only reachable through the deleted user's transactions. Shared assets that are still referenced by other users' transactions are preserved.

**Error Responses:**

| Status | Response | Reason |
|--------|----------|--------|
| 400 | `{ "error": "confirmationId must be a valid UUID" }` | Confirmation identifier is missing or malformed |
| 400 | `{ "error": "code must contain only digits" }` | Confirmation code is missing, blank, or malformed |
| 400 | `{ "error": "Confirmation code purpose mismatch", "attemptsRemaining": number }` | Code issued for a different purpose |
| 400 | `{ "error": "Confirmation code recipient mismatch", "attemptsRemaining": number }` | Challenge recipient mismatch |
| 401 | `{ "error": "Unauthorized" }` | Missing/invalid token, inactive session, user mismatch, or user not found |
| 401 | `{ "error": "Invalid code...", "attemptsRemaining": number }` | Wrong code or attempts exhausted |
| 410 | `{ "error": "Confirmation code expired or was not found", "attemptsRemaining": number }` | Expired/unknown challenge |
| 500 | `{ "error": "Internal server error" }` | Unexpected server error |
