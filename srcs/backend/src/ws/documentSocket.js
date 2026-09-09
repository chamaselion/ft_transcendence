const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const { parse: parseUrl } = require('url');
const { requireEnv } = require('../config');
const sequelize = require('../db');
const { getTokenFromCookie, isSessionActive } = require('../controllers/auth/helpers');
const { validateUuid } = require('../controllers/auth/validation');
const { sanitizePlainText } = require('../controllers/documents/sanitize');

// Real-time layer for collaborative documents.
//
// Clients connect to `wss://<host>/api/ws` (the connection is authenticated
// with the same login cookie as the REST API). After connecting a client
// sends { type: 'join', documentId } to enter a document "room", then
// { type: 'update', content } to push edits. Every edit is persisted and
// broadcast to the other clients in the same room, so all open tabs stay
// in sync in real time.
//
// Access mirrors the REST API (see controllers/documents/documentsController.js):
// regular users can only join and edit their own documents, admins can join
// and edit any document. Sharing between regular users will open up here once
// that part of the permissions module exists.
const WS_PATH = '/api/ws';

const attachDocumentSocket = (
  httpServer,
  {
    secret = requireEnv('JWT_SECRET'),
    documentModel,
    userModel,
    // Overridable for testing; default resolves the cookie JWT + session.
    authenticate,
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

    // The role decides which documents this connection may touch, so read it
    // from the DB instead of trusting whatever the token happens to carry.
    const user = await resolveUserModel().findByPk(payload.id, {
      attributes: ['id', 'role'],
    });
    if (!user) return null;

    return { id: user.id, role: user.role };
  };

  const auth = authenticate || defaultAuthenticate;

  // An injected `authenticate` may still return a bare user id string, so
  // accept both shapes and normalize to { id, role }.
  const toIdentity = (authenticated) => {
    if (!authenticated) return null;
    if (typeof authenticated === 'string') return { id: authenticated, role: 'user' };
    return authenticated.id ? authenticated : null;
  };

  // Which documents a connection may reach: admins any, everyone else only
  // their own.
  const documentScope = (ws, documentId) =>
    ws.isAdmin ? { id: documentId } : { id: documentId, ownerId: ws.userId };

  const wss = new WebSocketServer({ noServer: true });
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
      ws.isAdmin = identity.role === 'admin';
      ws.documentId = null;
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

      const doc = await resolveModel().findOne({
        where: documentScope(ws, idCheck.value),
      });
      if (!doc) return sendError(ws, 'Document not found');

      leaveRoom(ws);
      ws.documentId = doc.id;
      if (!rooms.has(doc.id)) rooms.set(doc.id, new Set());
      rooms.get(doc.id).add(ws);

      return send(ws, {
        type: 'init',
        document: { id: doc.id, title: doc.title, content: doc.content },
      });
    }

    if (msg.type === 'update') {
      if (!ws.documentId) return sendError(ws, 'Join a document first');
      if (typeof msg.content !== 'string') {
        return sendError(ws, 'content must be a string');
      }

      const doc = await resolveModel().findOne({
        where: documentScope(ws, ws.documentId),
      });
      if (!doc) return sendError(ws, 'Document not found');

      const sanitizedContent = sanitizePlainText(msg.content);
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

    ws.on('close', () => leaveRoom(ws));
    ws.on('error', () => leaveRoom(ws));
  });

  return wss;
};

module.exports = { attachDocumentSocket, WS_PATH };
