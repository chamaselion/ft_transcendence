const crypto = require('crypto');
const sequelize = require('../../db');

const hashTokenValue = (value) => {
  if (!value) {
    return null;
  }

  return crypto.createHash('sha256').update(String(value)).digest('hex');
};

const buildUniqueLogin = async ({ provider, profile }) => {
  const userModel = sequelize.models.user;
  const baseName = String(profile.login || profile.displayName || profile.email?.split('@')[0] || `${provider}-user`)
    .replace(/[^a-zA-Z0-9_.-]/g, '')
    .slice(0, 32) || `${provider}-user`;

  let candidate = baseName;
  let counter = 1;

  while (await userModel.findOne({ where: { login: candidate } })) {
    candidate = `${baseName}${counter}`;
    counter += 1;
  }

  return candidate;
};

const resolveOrCreateUserForOAuthProfile = async ({ provider, profile }) => {
  const userModel = sequelize.models.user;
  const userOauthAccountModel = sequelize.models.userOauthAccount;

  if (!userModel || !userOauthAccountModel) {
    throw new Error('OAuth models are not available');
  }

  const linkedAccount = await userOauthAccountModel.findOne({
    where: {
      provider,
      providerUserId: profile.providerUserId,
    },
    include: [{ model: userModel }],
  });

  if (linkedAccount?.user) {
    return { user: linkedAccount.user, oauthAccount: linkedAccount, created: false };
  }

  if (profile.email) {
    const existingUser = await userModel.findOne({ where: { email: profile.email } });
    if (existingUser) {
      const existingLink = await userOauthAccountModel.findOne({
        where: {
          userId: existingUser.id,
          provider,
        },
      });

      if (!existingLink) {
        const oauthAccount = await userOauthAccountModel.create({
          userId: existingUser.id,
          provider,
          providerUserId: profile.providerUserId,
          email: profile.email,
          emailVerified: profile.emailVerified,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
        });

        return { user: existingUser, oauthAccount, created: false };
      }

      return { user: existingUser, oauthAccount: existingLink, created: false };
    }
  }

  if (!profile.email) {
    return { user: null, oauthAccount: null, created: false, reason: 'missing_email' };
  }

  const login = await buildUniqueLogin({ provider, profile });
  const user = await userModel.create({
    login,
    email: profile.email,
    passwordHash: null,
    role: 'user',
  });

  const oauthAccount = await userOauthAccountModel.create({
    userId: user.id,
    provider,
    providerUserId: profile.providerUserId,
    email: profile.email,
    emailVerified: profile.emailVerified,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
  });

  return { user, oauthAccount, created: true };
};

module.exports = {
  hashTokenValue,
  buildUniqueLogin,
  resolveOrCreateUserForOAuthProfile,
};
