# Backend Overview

This document describes how the project's backend is built and structured.

## Core Stack

- **Runtime:** Node.js (see [srcs/backend/package.json](../../srcs/backend/package.json))
- **Web Framework:** Express.js — handles HTTP routing and middleware
- **Database:** PostgreSQL with Sequelize ORM
- **Authentication:** JWT tokens with bcrypt password hashing

## Architecture

### Directory Structure
- [srcs/backend/src/app.js](../../srcs/backend/src/app.js) — Express app factory with middleware setup (CORS, JSON parsing)
- [srcs/backend/src/server.js](../../srcs/backend/src/server.js) — Entry point; starts the server and manages database connection with retry logic
- [srcs/backend/src/db.js](../../srcs/backend/src/db.js) — Sequelize database connection to PostgreSQL
- [srcs/backend/src/routes/](../../srcs/backend/src/routes/) — Request routing
  - [auth.js](../../srcs/backend/src/routes/auth.js) — Authentication endpoints
  - [index.js](../../srcs/backend/src/routes/index.js) — Router aggregation
- [srcs/backend/src/controllers/authController.js](../../srcs/backend/src/controllers/authController.js) — Business logic for register and login
- [srcs/backend/src/models/user.js](../../srcs/backend/src/models/user.js) — Sequelize User model (id, login, email, passwordHash, timestamps)

### Middleware
- **CORS:** Enabled to allow cross-origin requests from the frontend
- **JSON body parsing:** Express built-in middleware to parse request bodies

### Implemented Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check — returns `{"status":"ok"}` |
| POST | `/api/auth/register` | Register new user (login, email, password) |
| POST | `/api/auth/login` | Login and receive JWT token (email, password) |

## Environment Variables

The backend loads shared configuration from the repository root [`.env`](../../.env) file.

- `PORT` — server port
- `DATABASE_URL` — PostgreSQL connection URL (format: `postgres://user:pass@host:port/db`)
  - Parsed into host, port, username, password, and database name
- `JWT_SECRET` — secret key for signing JWT tokens
  - Generate a new one with `openssl rand -hex 32`
- `BCRYPT_SALT_ROUNDS` — bcrypt work factor used for password hashing
- `JWT_EXPIRES_IN` — JWT expiration value used when issuing tokens
- `DB_RETRY_LIMIT` — max attempts to connect to database
- `DB_RETRY_DELAY_MS` — milliseconds between retry attempts
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` — PostgreSQL container settings
- `BACKEND_HOST_PORT`, `DB_HOST_PORT`, `NGINX_HOST_PORT` — host port mappings for Docker Compose

## Running the Backend

### Via Docker Compose (recommended)
```bash
docker compose up --build
```

### Standalone (development)
```bash
cd srcs/backend
npm install
npm run start    # or use `npm run dev` for auto-reload with nodemon
```

The server will start on `PORT` and log `Server running on port XXXX`.

## Testing

### Health Check
```bash
curl http://localhost:3001/health
```

Expected: `{"status":"ok"}`

### Register User
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"login":"testuser","email":"test@example.com","password":"password123"}'
```

Expected response (201 Created):
```json
{"id":1,"login":"testuser","email":"test@example.com"}
```

### Login User
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

Expected response (200 OK, valid JWT token):
```json
{"token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}
```

## Deployment & Containerization

- Backend is containerized (see [srcs/backend/Dockerfile](../../srcs/backend/Dockerfile))
- Deployed with Nginx reverse proxy for HTTPS (see [nginx/nginx.conf](../../nginx/nginx.conf))
- All services orchestrated via [docker-compose.yaml](../../docker-compose.yaml)

## Security Considerations

- Passwords are hashed with bcrypt using `BCRYPT_SALT_ROUNDS`
- JWT tokens expire using `JWT_EXPIRES_IN`
- For HTTPS requirements: see subject requirements on all communications to backend using HTTPS

## Troubleshooting

Check service logs:
```bash
docker compose logs -f backend
docker compose logs -f db
docker compose logs -f nginx
```

````
