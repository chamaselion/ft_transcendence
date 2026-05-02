const dotenv = require('dotenv');
const { sequelize } = require('./db');
const { createApp } = require('./app');
const routes = require('./routes');

dotenv.config();

const app = createApp({ router: routes });

const PORT = process.env.PORT || 3001;
const DB_RETRY_LIMIT = Number(process.env.DB_RETRY_LIMIT || 10);
const DB_RETRY_DELAY_MS = Number(process.env.DB_RETRY_DELAY_MS || 2000);

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
    console.log('Database connected');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
