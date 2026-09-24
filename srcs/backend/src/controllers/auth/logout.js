const { clearAuthCookie, getTokenFromCookie, removeSessionByToken } = require('./helpers');
const { evictSession } = require('../../ws/documentSocket');

const createLogoutHandler = () => {
  const logout = async (req, res) => {
    console.log(`[AUTH] POST /logout from ${req.ip}`);
    const token = getTokenFromCookie(req);
    if (token) {
      await removeSessionByToken(token);
    }
    
    if (token) {
      evictSession(token);
    }
    clearAuthCookie(res);
    return res.json({ loggedIn: false, loggedOut: true });
  };

  return { logout };
};

module.exports = { createLogoutHandler };
