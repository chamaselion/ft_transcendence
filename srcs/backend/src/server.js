const fs = require('fs');
const https = require('https');
const sequelize = require('./db');
const { createApp } = require('./app');
const { requireEnv, requireNumberEnv } = require('./config');
const routes = require('./routes');
const { createWsServer } = require('./wsServer');      // add this
const { startBinanceConnection } = require('./services/binanceService'); // add this
const { startGoldPolling } = require('./services/goldService');         // add this
const { startFinnhub } = require('./services/finnhubService');
const { flushSessionStateToDb, hydrateSessionCacheFromDb } = require('./controllers/auth/helpers');

const app = createApp({ router: routes });

const tlsCertFile = requireEnv('TLS_CERT_FILE');
const tlsKeyFile = requireEnv('TLS_KEY_FILE');

const httpsServer = https.createServer(
  {
    cert: fs.readFileSync(tlsCertFile),
    key: fs.readFileSync(tlsKeyFile),
  },
  app
);

createWsServer(httpsServer);                            // attach WS server

const PORT = requireNumberEnv('PORT');
const DB_RETRY_LIMIT = requireNumberEnv('DB_RETRY_LIMIT');
const DB_RETRY_DELAY_MS = requireNumberEnv('DB_RETRY_DELAY_MS');
const NODE_ENV = process.env.NODE_ENV || 'development';

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
    await sequelize.sync();
    await hydrateSessionCacheFromDb();
    console.log('Database connected');
    // use httpServer.listen instead of app.listen
    httpsServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      startBinanceConnection();                        // start after server is up
      startGoldPolling();                              // poll gold/silver prices
      startFinnhub();                                  // stream US stock prices
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

  httpsServer.close(() => {
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
