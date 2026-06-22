const { clearAuthCookie, getTokenFromCookie, removeSessionByToken } = require('./helpers');

const createLogoutHandler = () => {
  const logout = async (req, res) => {
    console.log(`[AUTH] POST /logout from ${req.ip}`);
    const token = getTokenFromCookie(req);
    if (token) {
      await removeSessionByToken(token);
    }
    clearAuthCookie(res);
    return res.json({ loggedIn: false, loggedOut: true });
  };

  return { logout };
};

module.exports = { createLogoutHandler };