const { Sequelize } = require('sequelize');
const { requireEnv } = require('./config');

const databaseUrl = new URL(requireEnv('DATABASE_URL'));

if (!databaseUrl.port) {
  throw new Error('DATABASE_URL must include a port');
}

const sequelize = new Sequelize(databaseUrl.pathname.slice(1), databaseUrl.username, databaseUrl.password, {
  host: databaseUrl.hostname,
  port: Number(databaseUrl.port),
  dialect: 'postgres',
  logging: false,
});

module.exports = { sequelize };
