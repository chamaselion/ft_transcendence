const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const loadEnvFile = () => {
  const candidatePaths = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '..', '.env'),
    path.resolve(process.cwd(), '..', '..', '.env'),
    path.resolve(process.cwd(), '..', '..', '..', '.env'),
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../../../.env'),
  ];

  const envPath = candidatePaths.find((candidatePath) => fs.existsSync(candidatePath));
  if (envPath) {
    dotenv.config({ path: envPath });
  }
};

loadEnvFile();

const requireEnv = (name) => {
  const value = process.env[name];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

const getOptionalEnv = (name, fallback = undefined) => {
  const value = process.env[name];
  if (value === undefined || value === '') {
    return fallback;
  }

  return value;
};

const requireNumberEnv = (name) => {
  const value = requireEnv(name);
  const parsedValue = Number(value);

  if (Number.isNaN(parsedValue)) {
    throw new Error(`Environment variable ${name} must be a number`);
  }

  return parsedValue;
};

module.exports = {
  requireEnv,
  getOptionalEnv,
  requireNumberEnv,
};
