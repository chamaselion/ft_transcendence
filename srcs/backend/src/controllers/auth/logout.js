const { clearAuthCookie, getTokenFromCookie, removeSessionByToken } = require('./helpers');
const { evictSession } = require('../../ws/documentSocket');

const createLogoutHandler = () => {
  const logout = async (req, res) => {
    console.log(`[AUTH] POST /logout from ${req.ip}`);
    const token = getTokenFromCookie(req);
    if (token) {
      await removeSessionByToken(token);
    }
    
    // Dropping the session does not by itself close an open WebSocket - that
    // connection was authenticated once, at its handshake. Without this the
    // logged-out user keeps reading and editing live documents until the
    // heartbeat notices the dead session on its next tick.
    //
    // Keyed on the token so only this session's connections go: the same
    // account may be signed in elsewhere, and logging out here must not knock
    // that device off its documents.
    if (token) {
      evictSession(token);
    }
    clearAuthCookie(res);
    return res.json({ loggedIn: false, loggedOut: true });
  };

  return { logout };
};

module.exports = { createLogoutHandler };
