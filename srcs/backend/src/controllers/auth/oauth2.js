const { getOptionalEnv } = require('../../config');

const supportedProviders = ['github', '42'];

const normalizeProvider = (provider) => String(provider || '').trim().toLowerCase();

const getProviderConfig = (provider) => {
  const normalized = normalizeProvider(provider);
  const envPrefix = `OAUTH_${normalized.toUpperCase()}`;

  const config = {
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

  return config;
};

const buildOAuthState = ({ provider, redirectUri = null, next = '/', nonce = null } = {}) => ({
  provider: normalizeProvider(provider),
  redirectUri,
  next,
  nonce,
  issuedAt: new Date().toISOString(),
  status: 'placeholder',
});

const buildAuthorizeUrl = ({ provider, config, state, next = '/' } = {}) => {
  const normalizedProvider = normalizeProvider(provider);
  const targetConfig = config || getProviderConfig(normalizedProvider);

  if (!targetConfig || !targetConfig.clientId || !targetConfig.redirectUri || !targetConfig.authorizeUrl) {
    throw new Error(`Missing OAuth configuration for provider: ${normalizedProvider}`);
  }

  const params = new URLSearchParams({
    client_id: targetConfig.clientId,
    redirect_uri: targetConfig.redirectUri,
    state: state || `${normalizedProvider}:${Date.now()}`,
    next,
  });

  if (normalizedProvider === 'github') {
    params.set('scope', 'read:user');
  }

  if (normalizedProvider === '42') {
    params.set('response_type', 'code');
    params.set('scope', 'public');
  }

  return `${targetConfig.authorizeUrl}?${params.toString()}`;
};

const normalizeProviderProfile = (provider, profile) => {
  const normalizedProvider = normalizeProvider(provider);

  if (normalizedProvider === 'github') {
    return {
      providerUserId: String(profile.id),
      email: profile.email || null,
      emailVerified: true,
      displayName: profile.name || profile.login || profile.email || 'GitHub user',
      avatarUrl: profile.avatar_url || null,
      login: profile.login || profile.email || `github-${profile.id}`,
    };
  }

  if (normalizedProvider === '42') {
    return {
      providerUserId: String(profile.id),
      email: profile.email || null,
      emailVerified: Boolean(profile.email_verified),
      displayName: profile.displayname || profile.login || profile.email || '42 user',
      avatarUrl: profile.image?.link || profile.image_url || null,
      login: profile.login || profile.email || `42-${profile.id}`,
    };
  }

  throw new Error(`Unsupported provider: ${normalizedProvider}`);
};

const exchangeCodeForToken = async ({ provider, code, config } = {}) => {
  const normalizedProvider = normalizeProvider(provider);
  const targetConfig = config || getProviderConfig(normalizedProvider);

  if (!targetConfig || !targetConfig.tokenUrl) {
    throw new Error(`Missing token endpoint for provider: ${normalizedProvider}`);
  }

  return {
    provider: normalizedProvider,
    code,
    tokenUrl: targetConfig.tokenUrl,
    status: 'not_implemented',
    note: 'token exchange is implemented in next oauth patch',
  };
};

const fetchProviderProfile = async ({ provider, accessToken, config } = {}) => {
  const normalizedProvider = normalizeProvider(provider);
  const targetConfig = config || getProviderConfig(normalizedProvider);

  if (!targetConfig || !targetConfig.userInfoUrl) {
    throw new Error(`Missing user info endpoint for provider: ${normalizedProvider}`);
  }

  return {
    provider: normalizedProvider,
    accessToken,
    userInfoUrl: targetConfig.userInfoUrl,
    status: 'not_implemented',
    note: 'provider profile fetch is implemented in next oauth patch',
  };
};

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
      if (!providerConfig.enabled) {
        return res.status(501).json({
          error: 'OAuth2 provider is not configured yet',
          provider,
          status: 'placeholder',
        });
      }

      const state = JSON.stringify(buildOAuthState({ provider, redirectUri: providerConfig.redirectUri, next: req.query?.next || '/' }));
      const authorizeUrl = buildAuthorizeUrl({
        provider,
        config: providerConfig,
        state: Buffer.from(state).toString('base64url'),
        next: req.query?.next || '/',
      });

      logger.info(`[OAUTH2] Redirecting ${provider} to authorization endpoint`);
      return res.redirect(authorizeUrl);
    } catch (err) {
      logger.error('[OAUTH2] startAuthorization failed:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  };

  const callback = async (req, res) => {
    try {
      const provider = normalizeProvider(req.params?.provider);
      const { code, state, error, error_description } = req.query || {};

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

      if (!code) {
        return res.status(400).json({ error: 'OAuth2 authorization code is missing' });
      }

      if (!state) {
        return res.status(400).json({ error: 'OAuth2 state is missing' });
      }

      const providerConfig = getProviderConfig(provider);
      if (!providerConfig.enabled) {
        return res.status(501).json({
          error: 'OAuth2 provider is not configured yet',
          provider,
          status: 'placeholder',
        });
      }

      logger.info(`[OAUTH2] callback received for ${provider}`, { hasCode: Boolean(code), hasState: Boolean(state) });

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
    buildAuthorizeUrl,
    buildOAuthState,
    normalizeProviderProfile,
    exchangeCodeForToken,
    fetchProviderProfile,
    finalizeUserAuthentication,
  };
};

module.exports = {
  createOAuth2Handler,
  getProviderConfig,
  buildAuthorizeUrl,
  buildOAuthState,
  normalizeProvider,
  normalizeProviderProfile,
  exchangeCodeForToken,
  fetchProviderProfile,
  supportedProviders,
};
