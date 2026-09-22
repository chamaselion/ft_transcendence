const http = require('http');
const sequelize = require('./db');
const { createApp } = require('./app');
const { requireEnv, requireNumberEnv } = require('./config');
const routes = require('./routes');
const { flushSessionStateToDb, hydrateSessionCacheFromDb } = require('./controllers/auth/helpers');
const { attachDocumentSocket } = require('./ws/documentSocket');
const { ensureAdminRole } = require('./services/adminBootstrap');

const app = createApp({ router: routes });
const PORT = requireNumberEnv('PORT');
const DB_RETRY_LIMIT = requireNumberEnv('DB_RETRY_LIMIT');
const DB_RETRY_DELAY_MS = requireNumberEnv('DB_RETRY_DELAY_MS');
const NODE_ENV = process.env.NODE_ENV || 'development';
const httpServer = http.createServer(app);

// Real-time collaboration layer (WebSocket on /api/ws).
attachDocumentSocket(httpServer);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connectWithRetry() {
  let attempt = 0;

  while (attempt < DB_RETRY_LIMIT) {
    try {
      await sequelize.authenticate();
      return;
    } catch (err) {
      attempt += 1;
      if (attempt >= DB_RETRY_LIMIT) throw err;
      console.log(`Database not ready yet, retrying in ${DB_RETRY_DELAY_MS}ms (${attempt}/${DB_RETRY_LIMIT})`);
      await sleep(DB_RETRY_DELAY_MS);
    }
  }
}

async function start() {
  try {
    await connectWithRetry();
    // `alter: true` so schema changes (such as the `role` column) also reach
    // databases that already exist, not just freshly created ones.
    await sequelize.sync({ alter: true });
    await hydrateSessionCacheFromDb();
    await ensureAdminRole();
    console.log('Database connected');
    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT} in ${NODE_ENV} mode`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

let shuttingDown = false;

const shutdown = async (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;

  try {
    console.log(`Received ${signal}. Flushing in-memory session state to database...`);
    await flushSessionStateToDb();
  } catch (err) {
    console.error('Failed to flush session state during shutdown:', err);
  }

  httpServer.close(() => {
    process.exit(0);
  });

  setTimeout(() => {
    process.exit(1);
  }, 10_000).unref?.();
};

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

start();
