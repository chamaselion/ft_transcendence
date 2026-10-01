const jwt = require('jsonwebtoken');
const { requireEnv } = require('../../config');
const { ensureSession, setAuthCookie } = require('./helpers');
const {
  supportedProviders,
  normalizeProvider,
  getProviderConfig,
  buildOAuthState,
  decodeOAuthState,
  buildAuthorizeUrl,
  normalizeProviderProfile,
} = require('./oauth2-config');
const {
  exchangeCodeForToken,
  fetchProviderProfile,
  fetchProviderEmailAddress,
} = require('./oauth2-provider-client');
const {
  hashTokenValue,
  resolveOrCreateUserForOAuthProfile,
} = require('./oauth2-user-resolution');

const JWT_SECRET = requireEnv('JWT_SECRET');
const JWT_EXPIRES_IN = requireEnv('JWT_EXPIRES_IN');

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

      const parsedState = decodeOAuthState(state);
      if (parsedState.provider && normalizeProvider(parsedState.provider) !== provider) {
        return res.status(400).json({ error: 'OAuth2 state mismatch' });
      }

      const tokenResponse = await exchangeCodeForToken({
        provider,
        code,
        config: providerConfig,
      });

      const providerProfilePayload = await fetchProviderProfile({
        provider,
        accessToken: tokenResponse.accessToken,
        config: providerConfig,
      });

      let profilePayload = providerProfilePayload;
      if (!profilePayload?.email) {
        const fallbackEmail = await fetchProviderEmailAddress({
          provider,
          accessToken: tokenResponse.accessToken,
          config: providerConfig,
        });

        if (fallbackEmail) {
          profilePayload = {
            ...profilePayload,
            email: fallbackEmail,
            email_verified: profilePayload?.email_verified ?? true,
          };
        }
      }

      const profile = normalizeProviderProfile(provider, profilePayload);
      const { user, oauthAccount, reason } = await resolveOrCreateUserForOAuthProfile({ provider, profile });

      if (!user) {
        if (reason === 'missing_email') {
          return res.status(401).json({
            error: 'This OAuth provider did not return an email address',
            provider,
          });
        }

        return res.status(401).json({
          error: 'Unable to resolve the user for this OAuth account',
          provider,
        });
      }

      if (oauthAccount) {
        await oauthAccount.update({
          email: profile.email || oauthAccount.email,
          emailVerified: profile.emailVerified,
          displayName: profile.displayName || oauthAccount.displayName,
          avatarUrl: profile.avatarUrl || oauthAccount.avatarUrl,
          accessTokenHash: hashTokenValue(tokenResponse.accessToken),
          refreshTokenHash: hashTokenValue(tokenResponse.refreshToken),
        });
      }

      const internalToken = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
      setAuthCookie(res, internalToken);
      await ensureSession({ token: internalToken, user });

      const redirectTarget = parsedState.next || parsedState.redirectUri || '/';
      logger.info(`[OAUTH2] user authenticated via ${provider}`, {
        userId: user.id,
        provider,
        redirectTarget,
      });

      if (req.accepts('html')) {
        return res.redirect(redirectTarget);
      }

      return res.json({
        id: user.id,
        login: user.login,
        email: user.email,
        loggedIn: true,
        provider,
        oauthAccountId: oauthAccount?.id || null,
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
    status: 'complete',
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
