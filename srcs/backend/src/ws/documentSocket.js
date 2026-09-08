const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const { parse: parseUrl } = require('url');
const { requireEnv } = require('../config');
const sequelize = require('../db');
const { getTokenFromCookie, isSessionActive } = require('../controllers/auth/helpers');
const { validateUuid } = require('../controllers/auth/validation');
const { sanitizePlainText } = require('../controllers/documents/sanitize');
const { resolvePermission, atLeast } = require('../controllers/documents/permissions');

// Real-time layer for collaborative documents.
//
// Clients connect to `wss://<host>/api/ws` (the connection is authenticated
// with the same login cookie as the REST API). After connecting a client
// sends { type: 'join', documentId } to enter a document "room", then
// { type: 'update', content } to push edits. Every edit is persisted and
// broadcast to the other clients in the same room, so all open tabs stay
// in sync in real time.
//
// Access mirrors the REST API and goes through the same resolver
// (controllers/documents/permissions.js): owners and admins get 'owner',
// everyone else whatever their documentShare row grants. 'viewer' may join and
// watch, 'editor' may also push updates.
//
// The permission is resolved when a client *joins a document*, not when the
// socket connects, and the user's role is re-read from the database at that
// moment. Resolving at connect time would freeze the role for the lifetime of
// the connection, so a demoted admin would keep admin reach until they
// reconnected; the REST side avoids this by reloading the user in requireAuth
// on every request, and this mirrors it.
const WS_PATH = '/api/ws';

// How often the server pings each client. Two jobs, and both matter here:
//
//  1) Keeping the connection alive. nginx closes a proxied connection after
//     proxy_read_timeout (60s by default) without data *from the backend*.
//     A lone user in a document never receives anything - their own edits are
//     deliberately not echoed back to them - so without a ping their session
//     dies after a minute even while they are typing. nginx.conf raises the
//     timeout as well; this is the half that does not depend on the proxy
//     configuration, and also covers NAT routers and firewalls dropping idle
//     connections.
//
//  2) Detecting dead clients. A closed laptop or a dropped WiFi link leaves
//     the TCP socket looking open for minutes, so 'close' never fires,
//     leaveRoom() never runs, and the socket lingers in its room while the
//     server broadcasts to nobody. A client that misses a ping is gone.
const HEARTBEAT_INTERVAL_MS = 30_000;

// Rooms live at module scope so revocations coming in over the REST API can
// reach open connections (see evictFromDocument / syncLivePermission at the
// bottom). One process attaches one document socket, so a single registry is
// enough.
const rooms = new Map(); // documentId -> Set<ws>

const send = (ws, data) => {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(data));
};
const sendError = (ws, error) => send(ws, { type: 'error', error });

const leaveRoom = (ws) => {
  const roomId = ws.documentId;
  if (!roomId || !rooms.has(roomId)) return;
  const room = rooms.get(roomId);
  room.delete(ws);
  if (room.size === 0) rooms.delete(roomId);
  ws.documentId = null;
  ws.permission = null;
};

const broadcast = (roomId, data, except) => {
  const room = rooms.get(roomId);
  if (!room) return;
  const message = JSON.stringify(data);
  for (const client of room) {
    if (client !== except && client.readyState === client.OPEN) {
      client.send(message);
    }
  }
};

// Set by attachDocumentSocket. One process attaches one document socket, so a
// single reference is enough; it lets evictUser reach connections that are open
// but not currently inside a document room.
let activeServer = null;

const connectionsForToken = (token) => {
  if (!token || !activeServer) return [];
  return [...activeServer.clients].filter((client) => client.token === token);
};

const roomMembers = (documentId, userId) => {
  const room = rooms.get(String(documentId));
  if (!room) return [];

  // Compare lowercased. `userId` arrives straight from the request URL and
  // validateUuid accepts either case, while `client.userId` comes from the
  // database and is always lower case. Postgres normalizes uuid values, so an
  // upper-case id still deletes the right share row - and a case-sensitive
  // match here would then evict nobody, leaving a revoked user typing into a
  // document they no longer have access to.
  const target = String(userId).toLowerCase();
  return [...room].filter((client) => String(client.userId).toLowerCase() === target);
};

// Called by the shares controller when a grant is removed: drop the user out
// of the live room instead of waiting for them to reload the page.
const evictFromDocument = (documentId, userId) => {
  for (const client of roomMembers(documentId, userId)) {
    send(client, { type: 'revoked', documentId: String(documentId) });
    leaveRoom(client);
  }
};

// Called on logout: closes the open connections belonging to *that session*,
// rather than waiting for the next heartbeat tick to notice it is gone.
//
// Keyed on the token, not the user: a logout ends one session, and the same
// account may be signed in on another device whose connections must survive.
const evictSession = (token) => {
  for (const client of connectionsForToken(token)) {
    send(client, { type: 'session_expired' });
    leaveRoom(client);
    client.terminate();
  }
};

// Called when a grant changes level. A downgrade to viewer keeps the user in
// the room - they may still read - but their next update is rejected.
const syncLivePermission = (documentId, userId, permission) => {
  for (const client of roomMembers(documentId, userId)) {
    client.permission = permission;
    send(client, { type: 'permission', documentId: String(documentId), permission });
  }
};

const attachDocumentSocket = (
  httpServer,
  {
    secret = requireEnv('JWT_SECRET'),
    documentModel,
    userModel,
    shareModel,
    // Overridable for testing; default resolves the cookie JWT + session.
    authenticate,
    // Overridable for testing; default asks the shared session cache.
    sessionCheck = isSessionActive,
  } = {},
) => {
  const resolveModel = () => documentModel || sequelize.models.document;
  const resolveUserModel = () => userModel || sequelize.models.user;

  const defaultAuthenticate = async (req) => {
    const token = getTokenFromCookie(req);
    if (!token) return null;
    let payload;
    try {
      payload = jwt.verify(token, secret);
    } catch (err) {
      return null;
    }
    if (!(await isSessionActive(token))) return null;

    // Establishes *who* is connecting, nothing more. What they may do is
    // decided per document in the join handler, which re-reads the role then -
    // anything cached here would go stale for the life of the connection.
    // The lookup still happens so a token for a deleted account is rejected
    // at the handshake rather than on the first join.
    const user = await resolveUserModel().findByPk(payload.id, {
      attributes: ['id'],
    });
    if (!user) return null;

    // The token travels with the identity so the connection can be re-checked
    // later: it is the only handle on the session, and a socket that is never
    // re-checked outlives a logout (see the heartbeat below).
    return { id: user.id, token };
  };

  const auth = authenticate || defaultAuthenticate;

  // An injected `authenticate` may still return a bare user id string, so
  // accept both shapes and normalize to { id, token? }. A test double without
  // a token simply skips the session re-check.
  const toIdentity = (authenticated) => {
    if (!authenticated) return null;
    if (typeof authenticated === 'string') return { id: authenticated };
    return authenticated.id ? authenticated : null;
  };

  const wss = new WebSocketServer({ noServer: true });
  activeServer = wss;

  // A socket authenticates once, at the handshake. Without re-checking, a user
  // who logs out keeps a working connection - they can still read the document
  // and still push edits. nginx used to end such connections after 60s by
  // accident; the heartbeat removed that, so the check has to be explicit.
  // isSessionActive serves from the in-memory session cache, so in steady
  // state this is a map lookup per open socket rather than a query - but it
  // is not query-free: the first call hydrates the cache from the database,
  // and an expired session is deleted there. It can therefore reject, and
  // every caller has to handle that.
  const hasLiveSession = async (ws) => {
    if (!ws.token) return true;
    return sessionCheck(ws.token);
  };

  // Re-read at join time so a role change since connect is picked up.
  const loadUser = (userId) =>
    resolveUserModel().findByPk(userId, { attributes: ['id', 'role'] });

  const resolveShareModel = () => shareModel || sequelize.models.documentShare;

  // Re-resolves the permission of a socket that is sitting in a document room.
  //
  // The level is cached on the socket at join time. Share changes are pushed in
  // from the REST side (syncLivePermission / evictFromDocument), but a *role*
  // change is not: an admin demoted to user would keep admin reach in an open
  // room until they rejoined. Running this on the heartbeat closes that window
  // to one tick, through the same resolver everything else uses.
  //
  // Costs up to three queries per in-room socket per tick (the user, the
  // document, and the share row for anyone who is neither owner nor admin).
  // That is affordable at this scale and buys a bounded staleness instead of
  // an unbounded one; if it ever stops being affordable, the answer is a
  // cached level with a timestamp, not dropping the check.
  const revalidatePermission = async (ws) => {
    const documentId = ws.documentId;
    if (!documentId) return;

    const revoke = () => {
      send(ws, { type: 'revoked', documentId: String(documentId) });
      leaveRoom(ws);
    };

    const user = await loadUser(ws.userId);
    if (!user) return revoke();

    const { permission } = await resolvePermission(user, documentId, {
      documentModel: resolveModel(),
      shareModel: resolveShareModel(),
    });

    if (!atLeast(permission, 'viewer')) return revoke();

    if (permission !== ws.permission) {
      ws.permission = permission;
      send(ws, { type: 'permission', documentId: String(documentId), permission });
    }
    return undefined;
  };

  // Only take over upgrades for our path; leave others untouched.
  httpServer.on('upgrade', async (req, socket, head) => {
    const { pathname } = parseUrl(req.url);
    if (pathname !== WS_PATH) return;

    let identity = null;
    try {
      identity = toIdentity(await auth(req));
    } catch (err) {
      identity = null;
    }
    if (!identity) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.userId = identity.id;
      ws.token = identity.token || null;
      ws.isAlive = true;
      ws.documentId = null;
      // Set per document on join, never at connect time.
      ws.permission = null;
      wss.emit('connection', ws, req);
    });
  });

  const handleMessage = async (ws, msg) => {
    if (msg.type === 'join') {
      // Validate before querying: a malformed id would make Postgres reject
      // the uuid and reach the caller as an internal error instead of a
      // client error.
      const idCheck = validateUuid(msg.documentId, 'documentId');
      if (!idCheck.ok) return sendError(ws, idCheck.error);

      // Checked here as well as in the heartbeat so a logout takes effect at
      // once instead of waiting up to one tick.
      if (!(await hasLiveSession(ws))) {
        sendError(ws, 'Session expired');
        leaveRoom(ws);
        return ws.terminate();
      }

      const user = await loadUser(ws.userId);
      // The account disappeared mid-session. Same answer as a missing document,
      // so the socket never becomes an existence oracle either.
      if (!user) return sendError(ws, 'Document not found');

      const { document: doc, permission } = await resolvePermission(user, idCheck.value, {
        documentModel: resolveModel(),
        shareModel: resolveShareModel(),
      });
      if (!atLeast(permission, 'viewer')) return sendError(ws, 'Document not found');

      leaveRoom(ws);
      ws.documentId = doc.id;
      ws.permission = permission;
      if (!rooms.has(doc.id)) rooms.set(doc.id, new Set());
      rooms.get(doc.id).add(ws);

      // The client needs the level to decide whether to render a read-only
      // editor.
      return send(ws, {
        type: 'init',
        permission,
        document: { id: doc.id, title: doc.title, content: doc.content },
      });
    }

    if (msg.type === 'update') {
      if (!ws.documentId) return sendError(ws, 'Join a document first');
      // Viewers may watch the room but not write into it.
      if (!atLeast(ws.permission, 'editor')) {
        return sendError(ws, 'Read-only access');
      }
      if (typeof msg.content !== 'string') {
        return sendError(ws, 'content must be a string');
      }

      const doc = await resolveModel().findByPk(ws.documentId);
      if (!doc) return sendError(ws, 'Document not found');

      const sanitizedContent = sanitizePlainText(msg.content);

      // KNOWN LIMITATION: last write wins, and the loss is silent.
      //
      // An update carries the whole document, not the edit that produced it,
      // so this overwrites whatever is stored. Two people typing at the same
      // moment therefore lose one of the two versions - and not as a reported
      // conflict: both messages are accepted, no error is sent, and the edit
      // that arrived first is gone with no way to recover it. Taking turns
      // works exactly as expected, because each write starts from what the
      // previous one left; genuinely simultaneous editing does not.
      //
      // Fixing it means changing what an 'update' carries - an operation
      // ("insert 'x' at position 5") instead of the full text - and merging
      // those operations: either by transforming their positions against each
      // other on the server (OT), or by giving every character a stable id so
      // the merge no longer depends on order (a CRDT, in practice yjs). Both
      // are a rewrite of this handler *and* of the client, not a patch, and
      // sanitizePlainText would have to move with them - it sanitizes a whole
      // document, which is the wrong unit once edits arrive per keystroke.
      doc.content = sanitizedContent;
      await doc.save();

      return broadcast(
        ws.documentId,
        {
          type: 'update',
          documentId: ws.documentId,
          content: sanitizedContent,
          userId: ws.userId,
        },
        ws, // don't echo back to the sender
      );
    }

    return sendError(ws, 'Unknown message type');
  };

  wss.on('connection', (ws) => {
    ws.on('message', async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch (err) {
        return sendError(ws, 'Invalid JSON');
      }

      // Everything below hits the DB. Without this catch a rejected query
      // would surface as an unhandled promise rejection and take the process
      // down instead of the single message.
      try {
        return await handleMessage(ws, msg);
      } catch (err) {
        console.error('[WS] message handling failed:', err);
        return sendError(ws, 'Internal error');
      }
    });

    // The browser answers a ping automatically - this needs no client-side
    // code and is not one of our own { type: ... } messages.
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('close', () => leaveRoom(ws));
    ws.on('error', () => leaveRoom(ws));
  });

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      // Still false from the previous tick: no pong came back, so the peer is
      // gone. terminate() rather than close(), because a clean close waits for
      // a handshake reply from someone who is no longer there.
      if (!ws.isAlive) {
        leaveRoom(ws);
        ws.terminate();
        continue;
      }

      // A live socket whose session has since ended (logout elsewhere, expiry)
      // is closed too - being reachable is not the same as being allowed.
      //
      // The catch is not optional: this promise is not awaited by anyone, and
      // an unhandled rejection ends the whole process on modern Node. A failed
      // check decides nothing - the connection stays and the next tick tries
      // again - because dropping users over a hiccup in the session store is
      // worse than checking them a heartbeat later.
      void hasLiveSession(ws)
        .then((alive) => {
          if (alive) return;
          send(ws, { type: 'session_expired' });
          leaveRoom(ws);
          ws.terminate();
        })
        .catch((err) => {
          console.error('[WS] session re-check failed:', err);
        });

      // Same contract as above: a failed re-check changes nothing and is
      // retried on the next tick, and it must never reject unhandled.
      void revalidatePermission(ws).catch((err) => {
        console.error('[WS] permission re-check failed:', err);
      });

      ws.isAlive = false;
      ws.ping();
    }
  }, HEARTBEAT_INTERVAL_MS);

  // Do not hold the event loop open on shutdown just for the heartbeat.
  heartbeat.unref?.();
  wss.on('close', () => clearInterval(heartbeat));

  return wss;
};

module.exports = {
  attachDocumentSocket,
  evictFromDocument,
  evictSession,
  syncLivePermission,
  WS_PATH,
};
