const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const loadEnvFile = () => {
  const candidatePaths = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "..", ".env"),
    path.resolve(process.cwd(), "..", "..", ".env"),
    path.resolve(process.cwd(), "..", "..", "..", ".env"),
    path.resolve(__dirname, "../../.env"),
    path.resolve(__dirname, "../../../.env"),
  ];

  const envPath = candidatePaths.find((candidatePath) =>
    fs.existsSync(candidatePath),
  );
  if (envPath) {
    dotenv.config({ path: envPath });
  }
};

loadEnvFile();

const exposeDebugCode = () => {
  const enabled =
    process.env.NODE_ENV === "development" &&
    process.env.EMAIL_TRANSPORT === "console";

  process.env.DEBUG_CODES_ENABLED = enabled ? "true" : "false";
};

exposeDebugCode();

const requireEnv = (name) => {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

const getOptionalEnv = (name, fallback = undefined) => {
  const value = process.env[name];
  if (value === undefined || value === "") {
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

const getAiConfig = () => {
  const provider = (process.env.AI_PROVIDER || "mock").toLowerCase();
  const defaultModel =
    provider === "deepseek"
      ? "deepseek-chat"
      : provider === "anthropic"
        ? "claude-3-5-haiku-20241022"
        : "gpt-4o-mini";

  return {
    provider,
    model: process.env.AI_MODEL || defaultModel,
    apiKey: process.env.AI_API_KEY || "",
    baseUrl: process.env.AI_BASE_URL || "",
    timeoutMs: Number(process.env.AI_TIMEOUT_MS) || 30000,
    
  };
};

module.exports = {
  requireEnv,
  getOptionalEnv,
  requireNumberEnv,
  getAiConfig,
};
