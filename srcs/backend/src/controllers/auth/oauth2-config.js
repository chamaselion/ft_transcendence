const { getOptionalEnv } = require('../../config');

const supportedProviders = ['github', '42'];

const normalizeProvider = (provider) => String(provider || '').trim().toLowerCase();

const normalizeOAuthRedirectTarget = (value) => {
  if (typeof value !== 'string') {
    return '/';
  }

  const normalizedValue = value.trim();
  if (!normalizedValue.startsWith('/')) {
    return '/';
  }

  if (normalizedValue.startsWith('//')) {
    return '/';
  }

  return normalizedValue;
};

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

const buildOAuthState = ({
  provider,
  redirectUri = null,
  next = '/',
  nonce = null,
  mode = 'login',
  linkUserId = null,
} = {}) => ({
  provider: normalizeProvider(provider),
  redirectUri,
  next,
  nonce,
  mode,
  linkUserId,
  issuedAt: new Date().toISOString(),
  status: 'ready',
});

const decodeOAuthState = (rawState) => {
  if (!rawState) {
    return {};
  }

  if (typeof rawState !== 'string') {
    return rawState;
  }

  try {
    const parsed = JSON.parse(rawState);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch (error) {
    // ignore and fall through to base64url decoding below
  }

  try {
    const decoded = Buffer.from(rawState, 'base64url').toString('utf8');
    const parsed = JSON.parse(decoded);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    return {};
  }
};

const buildAuthorizeUrl = ({ provider, config, state, next = '/' } = {}) => {
  const normalizedProvider = normalizeProvider(provider);
  const targetConfig = config || getProviderConfig(normalizedProvider);
  const normalizedNext = normalizeOAuthRedirectTarget(next);

  if (!targetConfig || !targetConfig.clientId || !targetConfig.redirectUri || !targetConfig.authorizeUrl) {
    throw new Error(`Missing OAuth configuration for provider: ${normalizedProvider}`);
  }

  const params = new URLSearchParams({
    client_id: targetConfig.clientId,
    redirect_uri: targetConfig.redirectUri,
    state: state || `${normalizedProvider}:${Date.now()}`,
    next: normalizedNext,
  });

  if (normalizedProvider === 'github') {
    params.set('scope', 'read:user user:email');
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

module.exports = {
  supportedProviders,
  normalizeProvider,
  normalizeOAuthRedirectTarget,
  getProviderConfig,
  buildOAuthState,
  decodeOAuthState,
  buildAuthorizeUrl,
  normalizeProviderProfile,
};
