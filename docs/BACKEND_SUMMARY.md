# Backend Overview

This document summarizes how the current backend starts, what it exposes, and where to find more detailed API documentation.

## Core stack

- Node.js
- Express
- PostgreSQL
- Sequelize
- Nodemailer
- JWT + bcryptjs authentication

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

CORS is enabled to allow authenticated browser requests with cookies.

Code example from middleware setup:

```js
app.use(cors({
	credentials: true,
	allowedHeaders: ['Content-Type', 'Authorization'],
	methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
}));
```

This comes from [srcs/backend/src/app.js](../srcs/backend/src/app.js).

### Nodemailer

Nodemailer is used for OTP and confirmation email delivery (login challenge, password reset, profile update, GDPR actions).

Code example from the email service:

```js
const transporter = nodemailer.createTransport(smtpOptions);
const info = await transporter.sendMail({
	from: fromAddress,
	to,
	subject,
	text,
	html,
});
```

This comes from [srcs/backend/src/services/emailService.js](../srcs/backend/src/services/emailService.js).

## Startup flow

1. [srcs/backend/src/config.js](../srcs/backend/src/config.js) loads environment variables from a local `.env` file.
2. [srcs/backend/src/server.js](../srcs/backend/src/server.js) starts the HTTP server, connects to PostgreSQL, syncs models, and hydrates the session cache.
3. [srcs/backend/src/app.js](../srcs/backend/src/app.js) mounts middleware, `/health`, and `/api` routes.

## Main files

- [srcs/backend/src/app.js](../srcs/backend/src/app.js) — Express app and middleware setup
- [srcs/backend/src/server.js](../srcs/backend/src/server.js) — HTTP server startup
- [srcs/backend/src/db/index.js](../srcs/backend/src/db/index.js) — Sequelize connection and model registration
- [srcs/backend/src/routes/auth.js](../srcs/backend/src/routes/auth.js) — auth + GDPR routes

- [srcs/backend/src/controllers/documents/permissions.js](../srcs/backend/src/controllers/documents/permissions.js) — the single place document access is resolved (ownership, shares, admin role); both the REST controllers and the WebSocket go through it
- [srcs/backend/src/ws/documentSocket.js](../srcs/backend/src/ws/documentSocket.js) — live collaboration rooms

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
- `GET|PATCH|DELETE /api/users[/:id]` — admin only
- `POST|GET /api/documents`
- `GET|PATCH|DELETE /api/documents/:id`
- `GET|POST /api/documents/:id/shares`
- `PATCH|DELETE /api/documents/:id/shares/:userId`
- `WS /api/ws` — live document collaboration

Detailed endpoint docs live in [docs/API-s/auth-register.md](API-s/auth-register.md), [docs/API-s/auth-login.md](API-s/auth-login.md), [docs/API-s/auth-password-reset.md](API-s/auth-password-reset.md), [docs/API-s/auth-profile.md](API-s/auth-profile.md), [docs/API-s/auth-logout.md](API-s/auth-logout.md), [docs/API-s/gdpr-api.md](API-s/gdpr-api.md), [docs/API-s/users-api.md](API-s/users-api.md), [docs/API-s/documents/](API-s/documents/README.md), and [docs/API-s/shares/](API-s/shares/README.md).

## Configuration sources

- `.env` provides runtime configuration, including database connection values, JWT settings, and SMTP settings.

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

The backend uses bcryptjs salting through:

- `hashLib.hash(password, BCRYPT_SALT_ROUNDS)`

`BCRYPT_SALT_ROUNDS` is loaded from configuration and controls the work factor.

Based on the current user model and auth controllers, the codebase stores salted password hashes only and does not persist plain-text passwords.

## Running

Recommended path:

```bash
make up
```

Running the backend directly is possible as long as required `.env` values are set.

## Troubleshooting

- `GET /health` should return `{ "status": "ok" }`.
- For service logs:

```bash
docker compose logs -f backend
docker compose logs -f db
```

## Some useful resources:

- Backend on node.js: https://www.geeksforgeeks.org/node-js/how-to-use-node-js-for-backend-web-development/
- API-s: https://swagger.io/specification/
- API-s: https://spec.openapis.org/oas/v3.1.0.html
- API-s: https://www.youtube.com/watch?v=-MTSQjw5DrM
- API-s: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Methods
- JWT: https://www.youtube.com/watch?v=7Q17ubqLfaM
- JWT: https://www.youtube.com/watch?v=iFeVEFVmFZw
- JWT: https://www.jwt.io/introduction#what-is-json-web-token
- node.js at its best: https://www.theodinproject.com/paths/full-stack-javascript/courses/nodejs
