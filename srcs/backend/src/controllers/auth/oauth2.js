const { getOptionalEnv } = require('../../config');

const supportedProviders = ['github', '42'];

const normalizeProvider = (provider) => String(provider || '').trim().toLowerCase();

const getProviderConfig = (provider) => {
  const normalized = normalizeProvider(provider);
  const envPrefix = `OAUTH_${normalized.toUpperCase()}`;

  return {
    provider: normalized,
    enabled: Boolean(
      getOptionalEnv(`${envPrefix}_CLIENT_ID`) &&
      getOptionalEnv(`${envPrefix}_CLIENT_SECRET`) &&
      getOptionalEnv(`${envPrefix}_REDIRECT_URI`)
    ),
    clientId: getOptionalEnv(`${envPrefix}_CLIENT_ID`),
    clientSecret: getOptionalEnv(`${envPrefix}_CLIENT_SECRET`),
    redirectUri: getOptionalEnv(`${envPrefix}_REDIRECT_URI`),
    authorizeUrl: getOptionalEnv(`${envPrefix}_AUTHORIZE_URL`),
    tokenUrl: getOptionalEnv(`${envPrefix}_TOKEN_URL`),
    userInfoUrl: getOptionalEnv(`${envPrefix}_USERINFO_URL`),
  };
};

const buildOAuthState = ({ provider, redirectUri = null, next = '/', nonce = null } = {}) => ({
  provider: normalizeProvider(provider),
  redirectUri,
  next,
  nonce,
  issuedAt: new Date().toISOString(),
  status: 'placeholder',
});

const createOAuth2Handler = ({ logger = console } = {}) => {
  const startAuthorization = async (req, res) => {
    try {
      const provider = normalizeProvider(req.params?.provider);

      if (!provider) {
        return res.status(400).json({ error: 'OAuth provider is required' });
      }

      if (!supportedProviders.includes(provider)) {
        return res.status(400).json({ error: 'Unsupported OAuth provider', provider });
      }

      const providerConfig = getProviderConfig(provider);
      logger.warn(`[OAUTH2] startAuthorization placeholder invoked for ${provider}`);

      if (!providerConfig.enabled) {
        return res.status(501).json({
          error: 'OAuth2 provider is not configured yet',
          provider,
          status: 'placeholder',
        });
      }

      return res.status(501).json({
        error: 'OAuth2 authorization flow is not implemented yet',
        provider,
        status: 'placeholder',
      });
    } catch (err) {
      logger.error('[OAUTH2] startAuthorization failed:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  };

  const callback = async (req, res) => {
    try {
      const provider = normalizeProvider(req.params?.provider);
      const { code, state, error, error_description } = req.query || {};

      logger.warn(`[OAUTH2] callback placeholder invoked for ${provider}`, {
        hasCode: Boolean(code),
        hasState: Boolean(state),
        error: error || null,
      });

      if (!provider) {
        return res.status(400).json({ error: 'OAuth provider is required' });
      }

      if (!supportedProviders.includes(provider)) {
        return res.status(400).json({ error: 'Unsupported OAuth provider', provider });
      }

      if (error) {
        return res.status(400).json({
          error: 'OAuth2 provider rejected the authorization request',
          provider,
          providerError: error,
          providerErrorDescription: error_description || null,
        });
      }

      return res.status(501).json({
        error: 'OAuth2 callback handling is not implemented yet',
        provider,
        status: 'placeholder',
        context: {
          codeReceived: Boolean(code),
          stateReceived: Boolean(state),
        },
      });
    } catch (err) {
      logger.error('[OAUTH2] callback failed:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  };

  const finalizeUserAuthentication = async ({
    provider,
    providerUser,
    localUser,
    sessionToken,
  } = {}) => ({
    provider: normalizeProvider(provider),
    providerUser: providerUser || null,
    localUser: localUser || null,
    sessionToken: sessionToken || null,
    status: 'placeholder',
  });

  return {
    startAuthorization,
    callback,
    getProviderConfig,
    buildOAuthState,
    finalizeUserAuthentication,
  };
};

module.exports = {
  createOAuth2Handler,
  getProviderConfig,
  buildOAuthState,
  normalizeProvider,
  supportedProviders,
};
