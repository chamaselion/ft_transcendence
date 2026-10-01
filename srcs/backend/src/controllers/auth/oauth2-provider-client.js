const { getProviderConfig, normalizeProvider } = require('./oauth2-config');

const exchangeCodeForToken = async ({ provider, code, config } = {}) => {
  const normalizedProvider = normalizeProvider(provider);
  const targetConfig = config || getProviderConfig(normalizedProvider);

  if (!targetConfig || !targetConfig.tokenUrl) {
    throw new Error(`Missing token endpoint for provider: ${normalizedProvider}`);
  }

  const response = await fetch(targetConfig.tokenUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: targetConfig.clientId,
      client_secret: targetConfig.clientSecret,
      code,
      redirect_uri: targetConfig.redirectUri,
    }).toString(),
  });

  const payload = await response.json();

  if (!response.ok || !payload?.access_token) {
    const errorMessage = payload?.error_description || payload?.error || 'OAuth token exchange failed';
    throw new Error(`OAuth token exchange failed for ${normalizedProvider}: ${errorMessage}`);
  }

  return {
    provider: normalizedProvider,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token || null,
    raw: payload,
  };
};

const fetchProviderProfile = async ({ provider, accessToken, config } = {}) => {
  const normalizedProvider = normalizeProvider(provider);
  const targetConfig = config || getProviderConfig(normalizedProvider);

  if (!targetConfig || !targetConfig.userInfoUrl) {
    throw new Error(`Missing user info endpoint for provider: ${normalizedProvider}`);
  }

  const response = await fetch(targetConfig.userInfoUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  const payload = await response.json();

  if (!response.ok) {
    const errorMessage = payload?.error_description || payload?.error || 'Unable to fetch profile from provider';
    throw new Error(`OAuth profile fetch failed for ${normalizedProvider}: ${errorMessage}`);
  }

  return payload;
};

const fetchProviderEmailAddress = async ({ provider, accessToken, config } = {}) => {
  const normalizedProvider = normalizeProvider(provider);

  if (normalizedProvider === 'github') {
    const targetConfig = config || getProviderConfig(normalizedProvider);
    const emailResponse = await fetch('https://api.github.com/user/emails', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!emailResponse.ok) {
      return null;
    }

    const emailList = await emailResponse.json();
    if (!Array.isArray(emailList)) {
      return null;
    }

    const primaryVerifiedEmail = emailList.find((entry) => entry.primary && entry.verified)?.email;
    if (primaryVerifiedEmail) {
      return primaryVerifiedEmail;
    }

    const firstVerifiedEmail = emailList.find((entry) => entry.verified)?.email;
    return firstVerifiedEmail || null;
  }

  if (normalizedProvider === '42') {
    const targetConfig = config || getProviderConfig(normalizedProvider);
    if (!targetConfig?.userInfoUrl) {
      return null;
    }

    const response = await fetch(targetConfig.userInfoUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    return payload?.email || null;
  }

  return null;
};

module.exports = {
  exchangeCodeForToken,
  fetchProviderProfile,
  fetchProviderEmailAddress,
};
