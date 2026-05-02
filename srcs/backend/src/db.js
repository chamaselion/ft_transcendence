const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

dotenv.config();

const databaseUrl = new URL(process.env.DATABASE_URL || 'postgres://postgres:postgres@127.0.0.1:5432/ft_transcendence');

const sequelize = new Sequelize(databaseUrl.pathname.slice(1), databaseUrl.username, databaseUrl.password, {
  host: databaseUrl.hostname,
  port: databaseUrl.port ? Number(databaseUrl.port) : 5432,
  dialect: 'postgres',
  logging: false,
});

module.exports = { sequelize };
