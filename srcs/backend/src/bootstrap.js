'use strict';

/**
 * bootstrap.js — runs before server.js.
 *
 * 1. Authenticates to HashiCorp Vault using the AppRole credentials mounted
 *    into the container as Docker secrets.
 * 2. Reads sensitive keys from Vault and injects them into process.env so the
 *    rest of the application can consume them transparently.
 * 3. Requires ./server to start the application.
 *
 * Secrets loaded from Vault:
 *   secret/transcendence/backend  → JWT_SECRET, SMTP_PASS
 *   secret/transcendence/database → DATABASE_URL
 *
 * Vault is required for the application to start in every environment.
 * If Vault is unavailable or misconfigured, startup fails immediately.
 */

const fs = require('fs');
const https = require('https');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Make a single HTTPS request to Vault and return the parsed JSON response.
 * NODE_EXTRA_CA_CERTS (set in docker-compose) makes Node trust the project CA
 * automatically, so no extra TLS options are needed here.
 */
const vaultRequest = ({ method, url, token, body }) =>
  new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return reject(new Error(`Invalid Vault URL: ${url}`));
    }

    const payload = body ? JSON.stringify(body) : undefined;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + (parsed.search || ''),
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'X-Vault-Token': token } : {}),
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(
            new Error(`Vault ${method} ${url} responded ${res.statusCode}: ${raw}`)
          );
        }
        try {
          resolve(JSON.parse(raw));
        } catch {
          reject(new Error(`Failed to parse Vault response from ${url}: ${raw}`));
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });

const readSecretFile = (filePath) => fs.readFileSync(filePath, 'utf8').trim();

// ---------------------------------------------------------------------------
// Vault secret loader
// ---------------------------------------------------------------------------

const loadVaultSecrets = async () => {
  const vaultAddr = process.env.VAULT_ADDR;

  if (!vaultAddr) {
    throw new Error('VAULT_ADDR must be set. Vault is required for this application.');
  }

  const roleIdFile = process.env.VAULT_ROLE_ID_FILE;
  const secretIdFile = process.env.VAULT_SECRET_ID_FILE;

  if (!roleIdFile || !secretIdFile) {
    throw new Error(
      'VAULT_ROLE_ID_FILE and VAULT_SECRET_ID_FILE must be set when VAULT_ADDR is configured.'
    );
  }

  const roleId = readSecretFile(roleIdFile);
  const secretId = readSecretFile(secretIdFile);

  // 1. AppRole login → get a short-lived client token.
  console.log('[bootstrap] Authenticating to Vault via AppRole...');
  const loginResponse = await vaultRequest({
    method: 'POST',
    url: `${vaultAddr}/v1/auth/approle/login`,
    body: { role_id: roleId, secret_id: secretId },
  });

  const token = loginResponse.auth && loginResponse.auth.client_token;
  if (!token) {
    throw new Error('Vault AppRole login did not return a client token.');
  }

  console.log('[bootstrap] Vault authentication successful.');

  // 2. Backend secrets: JWT_SECRET, SMTP_PASS.
  const backendResponse = await vaultRequest({
    method: 'GET',
    url: `${vaultAddr}/v1/secret/data/transcendence/backend`,
    token,
  });

  const backendData = backendResponse.data && backendResponse.data.data;
  if (!backendData) {
    throw new Error(
      'Unexpected response structure from Vault path secret/data/transcendence/backend.'
    );
  }

  if (backendData.JWT_SECRET) {
    process.env.JWT_SECRET = backendData.JWT_SECRET;
  }
  if (backendData.SMTP_PASS) {
    process.env.SMTP_PASS = backendData.SMTP_PASS;
  }

  // 3. Database secrets: DATABASE_URL.
  const dbResponse = await vaultRequest({
    method: 'GET',
    url: `${vaultAddr}/v1/secret/data/transcendence/database`,
    token,
  });

  const dbData = dbResponse.data && dbResponse.data.data;
  if (!dbData) {
    throw new Error(
      'Unexpected response structure from Vault path secret/data/transcendence/database.'
    );
  }

  if (dbData.DATABASE_URL) {
    process.env.DATABASE_URL = dbData.DATABASE_URL;
  }

  console.log('[bootstrap] Vault secrets injected into process.env.');
};

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

loadVaultSecrets()
  .then(() => {
    require('./server');
  })
  .catch((err) => {
    console.error('[bootstrap] Fatal: failed to load Vault secrets —', err.message);
    process.exit(1);
  });
