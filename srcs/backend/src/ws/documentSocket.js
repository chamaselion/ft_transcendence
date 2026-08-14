const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const { parse: parseUrl } = require('url');
const { requireEnv } = require('../config');
const sequelize = require('../db');
const { getTokenFromCookie, isSessionActive } = require('../controllers/auth/helpers');
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
// Access is currently owner-scoped (a user can only join their own
// documents). Sharing across users will open up here once the permissions
// module exists.
const WS_PATH = '/api/ws';

const attachDocumentSocket = (
  httpServer,
  {
    secret = requireEnv('JWT_SECRET'),
    documentModel,
    // Overridable for testing; default resolves the cookie JWT + session.
    authenticate,
  } = {},
) => {
  const resolveModel = () => documentModel || sequelize.models.document;

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
    return payload.id;
  };

  const auth = authenticate || defaultAuthenticate;

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

    let userId = null;
    try {
      userId = await auth(req);
    } catch (err) {
      userId = null;
    }
    if (!userId) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.userId = userId;
      ws.documentId = null;
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws) => {
    ws.on('message', async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch (err) {
        return sendError(ws, 'Invalid JSON');
      }

      if (msg.type === 'join') {
        const doc = await resolveModel().findOne({
          where: { id: msg.documentId, ownerId: ws.userId },
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
          where: { id: ws.documentId, ownerId: ws.userId },
        });
        if (!doc) return sendError(ws, 'Document not found');


        const sanitizedContent = sanitizePlainText(msg.content);
        doc.content = sanitizedContent;
        await doc.save();

        broadcast(
          ws.documentId,
          {
            type: 'update',
            documentId: ws.documentId,
            content: sanitizedContent,
            userId: ws.userId,
          },
          ws, // don't echo back to the sender
        );
        return;
      }

      return sendError(ws, 'Unknown message type');
    });

    ws.on('close', () => leaveRoom(ws));
    ws.on('error', () => leaveRoom(ws));
  });

  return wss;
};

module.exports = { attachDocumentSocket, WS_PATH };
