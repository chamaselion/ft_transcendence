# Backend Overview

This document summarizes how the current backend starts, what it exposes, and where to find more detailed API documentation.

## Core stack

- Node.js
- Express
- PostgreSQL
- Sequelize
- WebSocket server (`ws`)
- JWT + bcrypt authentication

## Why these choices are used

### Express

Express is used as the HTTP layer because the backend mainly needs routing, middleware, JSON handling, and simple composition.

Code example from the app setup:

```js
const app = express();
app.use(express.json());
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api', router);
```

This comes from [srcs/backend/src/app.js](../srcs/backend/src/app.js).

### Sequelize

Sequelize is used to define models, register associations, and connect the application to PostgreSQL through one ORM layer.

Code example from the database bootstrap:

```js
const sequelize = new Sequelize(databaseUrl.pathname.slice(1), databaseUrl.username, databaseUrl.password, {
	host: databaseUrl.hostname,
	port: Number(databaseUrl.port),
	dialect: 'postgres',
	logging: false,
	define: {
		underscored: true
	}
});
```

This comes from [srcs/backend/src/db/index.js](../srcs/backend/src/db/index.js).

### CORS

CORS is enabled because the frontend and backend communicate across the reverse-proxy chain and authenticated requests need credential support.

Code example from middleware setup:

```js
app.use(cors({
	credentials: true,
	allowedHeaders: ['Content-Type', 'Authorization'],
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
}));
```

This comes from [srcs/backend/src/app.js](../srcs/backend/src/app.js).

## Startup flow

1. [srcs/backend/src/bootstrap.js](../srcs/backend/src/bootstrap.js) authenticates to Vault and injects `JWT_SECRET`, `SMTP_PASS`, and `DATABASE_URL` into `process.env`.
2. [srcs/backend/src/server.js](../srcs/backend/src/server.js) creates the HTTPS server, attaches the WebSocket server, connects to PostgreSQL, syncs models, and seeds assets.
3. [srcs/backend/src/app.js](../srcs/backend/src/app.js) mounts middleware, `/health`, `/internal/watched`, and `/api` routes.

## Main files

- [srcs/backend/src/app.js](../srcs/backend/src/app.js) — Express app and middleware setup
- [srcs/backend/src/server.js](../srcs/backend/src/server.js) — HTTPS server startup
- [srcs/backend/src/wsServer.js](../srcs/backend/src/wsServer.js) — `/ws` and `/internal/feed`
- [srcs/backend/src/db/index.js](../srcs/backend/src/db/index.js) — Sequelize connection and model registration
- [srcs/backend/src/routes/auth.js](../srcs/backend/src/routes/auth.js) — auth + GDPR routes
- [srcs/backend/src/routes/portfolio.js](../srcs/backend/src/routes/portfolio.js) — portfolio routes
- [srcs/backend/src/routes/symbols.js](../srcs/backend/src/routes/symbols.js) — search + history routes
- [srcs/backend/src/routes/assets.js](../srcs/backend/src/routes/assets.js) — seeded assets + stored valuations routes

## API surface

- `GET /health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/login/confirm`
- `POST /api/auth/password-reset/request`
- `POST /api/auth/password-reset/confirm`
- `GET /api/auth/me`
- `PATCH /api/auth/me`
- `POST /api/auth/me/update/confirm`
- `POST /api/auth/logout`
- `POST /api/auth/me/data-request`
- `GET /api/auth/me/data-export`
- `GET /api/auth/me/data-export/csv`
- `POST /api/auth/me/data-deletion/request`
- `POST /api/auth/me/data-deletion/confirm`
- `GET /api/portfolio`
- `GET /api/portfolio/history`
- `GET /api/portfolio/transactions`
- `POST /api/portfolio/transactions`
- `PUT /api/portfolio/transactions/:id`
- `DELETE /api/portfolio/transactions/:id`
- `GET /api/symbols/search`
- `GET /api/symbols/:symbol/history`
- `GET /api/assets`
- `GET /api/assets/:key/valuations`
- `GET /api/assets/:key/valuations/latest`
- `WS /ws`

Detailed endpoint docs live in [API-s/README.md](API-s/README.md).

## Configuration sources

- `.env` provides non-secret runtime configuration such as ports, SMTP host settings, and `PRICE_FEED_TOKEN`.
- Vault provides the main backend secrets: `DATABASE_URL`, `JWT_SECRET`, and `SMTP_PASS`.
- Docker secrets provide the AppRole credentials used to authenticate to Vault.

## Password hashing, salting, and storage

Passwords are not stored as plain text in the database.
The stored value is a salted bcrypt password hash.

The user model stores only `passwordHash`:

```js
passwordHash: {
	type: DataTypes.STRING,
	allowNull: false,
}
```

This is defined in [srcs/backend/src/db/models/user.js](../srcs/backend/src/db/models/user.js).

### Registration

During registration, the backend hashes and salts the validated password with bcrypt before creating the user record:

```js
const hash = await hashLib.hash(password, BCRYPT_SALT_ROUNDS);
const user = await resolvedUserModel.create({ login, email, passwordHash: hash });
```

This is implemented in [srcs/backend/src/controllers/auth/register.js](../srcs/backend/src/controllers/auth/register.js).

### Login verification

During login, the submitted password is compared against the stored hash:

```js
const match = await hashLib.compare(password, user.passwordHash);
```

This is implemented in [srcs/backend/src/controllers/auth/login.js](../srcs/backend/src/controllers/auth/login.js).

### Password reset

When a password is changed through reset flow, the new password is hashed and salted again before storage:

```js
const passwordHash = await hashLib.hash(newPassword, BCRYPT_SALT_ROUNDS);
await user.update({ passwordHash });
```

This is implemented in [srcs/backend/src/controllers/auth/passwordResetConfirm.js](../srcs/backend/src/controllers/auth/passwordResetConfirm.js).

### Salting method

The backend uses bcrypt's built-in salting through:

- `bcrypt.hash(password, BCRYPT_SALT_ROUNDS)`

`BCRYPT_SALT_ROUNDS` is loaded from configuration and controls the work factor.

Based on the current user model and auth controllers, the codebase stores salted password hashes only and does not persist plain-text passwords.

## Running

Recommended path:

```bash
make up
```

Running the backend directly is possible, but you must provide TLS files and Vault-related environment setup manually.

## Troubleshooting

- `GET /health` should return `{ "status": "ok" }`.
- If startup fails before the backend listens, check Vault status first.
- For service logs:

```bash
docker compose logs -f backend
docker compose logs -f db
docker compose logs -f vault
```
