const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { requireEnv, requireNumberEnv } = require('../../config');
const sequelize = require('../../db');
const { ensureSession, setAuthCookie } = require('./helpers');
const {
  supportedProviders,
  normalizeProvider,
  normalizeOAuthNonce,
  normalizeOAuthRedirectTarget,
  getProviderConfig,
  buildAuthorizeUrl,
  encodeOAuthStatePayload,
  decodeOAuthStatePayload,
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
const {
  createOAuthStateIntent,
  consumeOAuthStateIntent,
} = require('./oauth2-state');
const { validatePassword } = require('./validation');

const JWT_SECRET = requireEnv('JWT_SECRET');
const JWT_EXPIRES_IN = requireEnv('JWT_EXPIRES_IN');
const BCRYPT_SALT_ROUNDS = requireNumberEnv('BCRYPT_SALT_ROUNDS');

const createOAuthAccountManager = ({
  userModel = sequelize.models.user,
  oauthAccountModel = sequelize.models.userOauthAccount,
  hashLib = bcrypt,
} = {}) => {
  const setPassword = async (req, res) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const passwordValidation = validatePassword(req.body?.password);
      if (!passwordValidation.ok) {
        return res.status(400).json({ error: passwordValidation.error });
      }

      if (user.passwordHash) {
        return res.status(409).json({ error: 'Password already set' });
      }

      const passwordHash = await hashLib.hash(passwordValidation.value, BCRYPT_SALT_ROUNDS);
      await userModel.update({ passwordHash }, { where: { id: user.id } });

      return res.json({ passwordSet: true, userId: user.id });
    } catch (err) {
      return res.status(500).json({ error: 'Server error' });
    }
  };

  const startLinkProvider = async (req, res) => {
    try {
      const user = req.user;
      const provider = normalizeProvider(req.params?.provider);

      if (!user) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!supportedProviders.includes(provider)) {
        return res.status(400).json({ error: 'Authentication failed' });
      }

      const providerConfig = getProviderConfig(provider);
      if (!providerConfig.enabled) {
        return res.status(501).json({ error: 'Authentication failed' });
      }

      const redirectTarget = normalizeOAuthRedirectTarget(req.query?.next);
      const nonce = normalizeOAuthNonce(req.query?.nonce);
      if (!nonce) {
        return res.status(400).json({ error: 'Authentication failed' });
      }

      const stateIntent = await createOAuthStateIntent({
        provider,
        mode: 'link',
        userId: user.id,
        next: redirectTarget,
        nonce,
      });

      const encodedState = encodeOAuthStatePayload({
        sid: stateIntent.stateId,
        n: stateIntent.nonce,
        p: provider,
        m: stateIntent.mode,
        iat: new Date().toISOString(),
      });

      const authorizeUrl = buildAuthorizeUrl({
        provider,
        config: providerConfig,
        state: encodedState,
        next: redirectTarget,
      });

      return res.redirect(authorizeUrl);
    } catch (err) {
      return res.status(500).json({ error: 'Server error' });
    }
  };

  return { setPassword, startLinkProvider };
};

const createOAuth2Handler = ({ logger = console } = {}) => {
  const callbackRedirect = (req, res) => {
    const provider = normalizeProvider(req.params?.provider);

    if (!supportedProviders.includes(provider)) {
      return res.status(400).json({ error: 'Unsupported OAuth provider', provider });
    }

    const originalUrl = req.originalUrl || req.url || '';
    const queryIndex = originalUrl.indexOf('?');
    const query = queryIndex >= 0 ? originalUrl.slice(queryIndex) : '';

    return res.redirect(302, `/auth/oauth/${provider}/callback${query}`);
  };

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

      const redirectTarget = normalizeOAuthRedirectTarget(req.query?.next);
      const nonce = normalizeOAuthNonce(req.query?.nonce);
      if (!nonce) {
        return res.status(400).json({ error: 'Authentication failed' });
      }

      const stateIntent = await createOAuthStateIntent({
        provider,
        mode: 'login',
        next: redirectTarget,
        nonce,
      });
      const encodedState = encodeOAuthStatePayload({
        sid: stateIntent.stateId,
        n: stateIntent.nonce,
        p: provider,
        m: stateIntent.mode,
        iat: new Date().toISOString(),
      });

      const authorizeUrl = buildAuthorizeUrl({
        provider,
        config: providerConfig,
        state: encodedState,
        next: redirectTarget,
      });

      logger.info(`[OAUTH2] Redirecting ${provider} to authorization endpoint`);
      return res.redirect(authorizeUrl);
    } catch (err) {
      logger.error('[OAUTH2] startAuthorization failed:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  };

  const exchange = async (req, res) => {
    try {
      const provider = normalizeProvider(req.params?.provider);
      const body = req.body && typeof req.body === 'object' ? req.body : null;
      const { code, state, error } = body || {};

      if (!provider || !supportedProviders.includes(provider)) {
        return res.status(400).json({ error: 'Authentication failed' });
      }

      if (typeof code !== 'string' || typeof state !== 'string') {
        return res.status(400).json({ error: 'Authentication failed' });
      }

      if (error || !code || !state) {
        return res.status(400).json({ error: 'Authentication failed' });
      }

      const decodedState = decodeOAuthStatePayload(state);
      if (!decodedState || decodedState.provider !== provider) {
        return res.status(400).json({ error: 'Authentication failed' });
      }

      const providerConfig = getProviderConfig(provider);
      if (!providerConfig.enabled) {
        return res.status(501).json({ error: 'Authentication failed' });
      }

      const stateIntent = await consumeOAuthStateIntent({
        stateId: decodedState.stateId,
        provider,
      });
      if (!stateIntent.ok) {
        return res.status(stateIntent.statusCode).json({ error: stateIntent.error });
      }
      const parsedState = stateIntent.payload;

      if (decodedState.nonce !== parsedState.nonce) {
        return res.status(400).json({ error: 'Authentication failed' });
      }

      if (decodedState.mode && decodedState.mode !== parsedState.mode) {
        return res.status(400).json({ error: 'Authentication failed' });
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
      const isLinkIntent = parsedState.mode === 'link';
      const linkUserId = isLinkIntent && parsedState.userId ? String(parsedState.userId) : null;

      let user;
      let oauthAccount;

      if (isLinkIntent) {
        const targetUser = await sequelize.models.user.findByPk(linkUserId);
        if (!targetUser) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const existingOauthAccount = await sequelize.models.userOauthAccount.findOne({
          where: {
            provider,
            providerUserId: profile.providerUserId,
          },
        });

        if (existingOauthAccount && String(existingOauthAccount.userId) !== linkUserId) {
          return res.status(409).json({ error: 'Authentication failed' });
        }

        oauthAccount = existingOauthAccount || await sequelize.models.userOauthAccount.create({
          userId: targetUser.id,
          provider,
          providerUserId: profile.providerUserId,
          email: profile.email,
          emailVerified: profile.emailVerified,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
        });

        user = targetUser;
      } else {
        const resolutionResult = await resolveOrCreateUserForOAuthProfile({ provider, profile });

        if (resolutionResult.reason === 'link_required') {
          return res.status(409).json({
            error: 'An account with that email already exists. Sign in and link this provider from account settings.',
          });
        }

        if (resolutionResult.reason === 'provider_identity_mismatch') {
          return res.status(409).json({
            error: 'Authentication failed',
          });
        }

        user = resolutionResult.user;
        oauthAccount = resolutionResult.oauthAccount;

        if (!user) {
          return res.status(401).json({ error: 'Authentication failed' });
        }
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

      logger.info(`[OAUTH2] user authenticated via ${provider}`, {
        userId: user.id,
        provider,
        redirectTarget: normalizeOAuthRedirectTarget(parsedState.next),
        linked: isLinkIntent,
      });

      if (!isLinkIntent) {
        const internalToken = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        setAuthCookie(res, internalToken);
        await ensureSession({ token: internalToken, user });
      }

      if (isLinkIntent) {
        return res.json({
          linked: true,
          provider,
          id: user.id,
          login: user.login,
          email: user.email,
          oauthAccountId: oauthAccount?.id || null,
        });
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
      logger.error('[OAUTH2] exchange failed:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  };

  return {
    callbackRedirect,
    startAuthorization,
    exchange,
    getProviderConfig,
    buildAuthorizeUrl,
    normalizeProviderProfile,
    exchangeCodeForToken,
    fetchProviderProfile,
  };
};

module.exports = {
  createOAuth2Handler,
  createOAuthAccountManager,
  getProviderConfig,
  buildAuthorizeUrl,
  normalizeProvider,
  normalizeProviderProfile,
  exchangeCodeForToken,
  fetchProviderProfile,
  supportedProviders,
};
