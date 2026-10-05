const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { requireEnv, requireNumberEnv } = require('../../config');
const sequelize = require('../../db');
const { ensureSession, setAuthCookie } = require('./helpers');
const {
  supportedProviders,
  normalizeProvider,
  normalizeOAuthRedirectTarget,
  getProviderConfig,
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

      const stateIntent = await createOAuthStateIntent({
        provider,
        mode: 'link',
        userId: user.id,
        next: redirectTarget,
      });

      const authorizeUrl = buildAuthorizeUrl({
        provider,
        config: providerConfig,
        state: stateIntent.stateId,
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

      const stateIntent = await createOAuthStateIntent({
        provider,
        mode: 'login',
        next: redirectTarget,
      });
      const authorizeUrl = buildAuthorizeUrl({
        provider,
        config: providerConfig,
        state: stateIntent.stateId,
        next: redirectTarget,
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
        return res.status(400).json({ error: 'Authentication failed' });
      }

      if (!supportedProviders.includes(provider)) {
        return res.status(400).json({ error: 'Authentication failed' });
      }

      if (error) {
        return res.status(400).json({ error: 'Authentication failed' });
      }

      if (!code) {
        return res.status(400).json({ error: 'Authentication failed' });
      }

      if (!state) {
        return res.status(400).json({ error: 'Authentication failed' });
      }

      const providerConfig = getProviderConfig(provider);
      if (!providerConfig.enabled) {
        return res.status(501).json({ error: 'Authentication failed' });
      }

      const stateIntent = await consumeOAuthStateIntent({
        stateId: String(state),
        provider,
      });
      if (!stateIntent.ok) {
        return res.status(stateIntent.statusCode).json({ error: stateIntent.error });
      }
      const parsedState = stateIntent.payload;

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

      const redirectTarget = normalizeOAuthRedirectTarget(parsedState.next);
      logger.info(`[OAUTH2] user authenticated via ${provider}`, {
        userId: user.id,
        provider,
        redirectTarget,
        linked: isLinkIntent,
      });

      if (!isLinkIntent) {
        const internalToken = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        setAuthCookie(res, internalToken);
        await ensureSession({ token: internalToken, user });
      }

      if (req.accepts('html')) {
        return res.redirect(redirectTarget);
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
      logger.error('[OAUTH2] callback failed:', err);
      return res.status(500).json({ error: 'Server error' });
    }
  };

  const finalizeAuth = async ({
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
    normalizeProviderProfile,
    exchangeCodeForToken,
    fetchProviderProfile,
    finalizeAuth,
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
