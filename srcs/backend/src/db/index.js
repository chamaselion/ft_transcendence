const { Sequelize } = require('sequelize');
const { requireEnv } = require('../config');
const { applyAssociations } = require('./associations')

const databaseUrl = new URL(requireEnv('DATABASE_URL'));

if (!databaseUrl.port) {
  throw new Error('DATABASE_URL must include a port');
}

const sequelize = new Sequelize(databaseUrl.pathname.slice(1), databaseUrl.username, databaseUrl.password, {
  host: databaseUrl.hostname,
  port: Number(databaseUrl.port),
  dialect: 'postgres',
  logging: false,
  define: {
    underscored: true
  }
});

const modelDefiners = [
  require('./models/user'),
  require('./models/gdpr-export-quota'),
  require('./models/gdpr-audit-event'),
  require('./models/auth-session'),
  require('./models/one-time-challenge'),
];

for (const modelDefiner of modelDefiners) {
  modelDefiner(sequelize);
}

applyAssociations(sequelize);

module.exports = sequelize;
