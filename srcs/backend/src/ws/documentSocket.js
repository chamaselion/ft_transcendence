const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { parse: parseUrl } = require('url');
const { requireEnv } = require('../config');
const sequelize = require('../db');
const { getTokenFromCookie, isSessionActive } = require('../controllers/auth/helpers');
const { validateUuid } = require('../controllers/auth/validation');
const { sanitizePlainText } = require('../controllers/documents/sanitize');
const { resolvePermission, atLeast } = require('../controllers/documents/permissions');

const parseDocBlocks = (content) => {
  if (!content || typeof content !== 'string') {
    return [];
  }
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Legacy plain text fallback
  }
  return [
    {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      text: content,
      decorator: JSON.stringify({ type: 'p' }),
      lockedBy: null,
    },
  ];
};


const WS_PATH = '/api/ws';


const HEARTBEAT_INTERVAL_MS = 30_000;


const rooms = new Map();

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


let activeServer = null;

const connectionsForToken = (token) => {
  if (!token || !activeServer) return [];
  return [...activeServer.clients].filter((client) => client.token === token);
};

const roomMembers = (documentId, userId) => {
  const room = rooms.get(String(documentId));
  if (!room) return [];

  const target = String(userId).toLowerCase();
  return [...room].filter((client) => String(client.userId).toLowerCase() === target);
};


const evictFromDocument = (documentId, userId) => {
  for (const client of roomMembers(documentId, userId)) {
    send(client, { type: 'revoked', documentId: String(documentId) });
    leaveRoom(client);
  }
};

const evictSession = (token) => {
  for (const client of connectionsForToken(token)) {
    send(client, { type: 'session_expired' });
    leaveRoom(client);
    client.terminate();
  }
};

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

    const user = await resolveUserModel().findByPk(payload.id, {
      attributes: ['id'],
    });
    if (!user) return null;


    return { id: user.id, token };
  };

  const auth = authenticate || defaultAuthenticate;


  const toIdentity = (authenticated) => {
    if (!authenticated) return null;
    if (typeof authenticated === 'string') return { id: authenticated };
    return authenticated.id ? authenticated : null;
  };

  const wss = new WebSocketServer({ noServer: true });
  activeServer = wss;

  const hasLiveSession = async (ws) => {
    if (!ws.token) return true;
    return sessionCheck(ws.token);
  };

  const loadUser = (userId) =>
    resolveUserModel().findByPk(userId, { attributes: ['id', 'role'] });

  const resolveShareModel = () => shareModel || sequelize.models.documentShare;

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
      ws.permission = null;
      wss.emit('connection', ws, req);
    });
  });

  const handleMessage = async (ws, msg) => {
    if (msg.type === 'join') {
      const idCheck = validateUuid(msg.documentId, 'documentId');
      if (!idCheck.ok) return sendError(ws, idCheck.error);

      if (!(await hasLiveSession(ws))) {
        sendError(ws, 'Session expired');
        leaveRoom(ws);
        return ws.terminate();
      }

      const user = await loadUser(ws.userId);

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

      return send(ws, {
        type: 'init',
        permission,
        document: { id: doc.id, title: doc.title, content: doc.content },
      });
    }

    if (msg.type === 'update') {
      if (!ws.documentId) return sendError(ws, 'Join a document first');

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
        ws,
      );
    }

    if (msg.type === 'block_edit') {
      if (!ws.documentId) return sendError(ws, 'Join a document first');
      if (!atLeast(ws.permission, 'editor')) return sendError(ws, 'Read-only access');
      if (!msg.blockId || typeof msg.blockId !== 'string') {
        return sendError(ws, 'blockId must be a string');
      }

      const doc = await resolveModel().findByPk(ws.documentId);
      if (!doc) return sendError(ws, 'Document not found');

      const blocks = parseDocBlocks(doc.content);
      const target = blocks.find((b) => b && b.id === msg.blockId);
      if (!target) return sendError(ws, 'Block not found');

      const sanitizedText = msg.text !== undefined ? sanitizePlainText(String(msg.text)) : target.text;
      target.text = sanitizedText;
      if (msg.decorator !== undefined && typeof msg.decorator === 'string') {
        target.decorator = msg.decorator;
      }

      doc.content = JSON.stringify(blocks);
      await doc.save();

      return broadcast(
        ws.documentId,
        {
          type: 'block_updated',
          documentId: ws.documentId,
          blockId: msg.blockId,
          text: sanitizedText,
          decorator: target.decorator,
          userId: ws.userId,
        },
        ws,
      );
    }

    if (msg.type === 'block_create') {
      if (!ws.documentId) return sendError(ws, 'Join a document first');
      if (!atLeast(ws.permission, 'editor')) return sendError(ws, 'Read-only access');
      if (!msg.block || typeof msg.block !== 'object') {
        return sendError(ws, 'block must be an object');
      }

      const blockId = msg.block.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
      const sanitizedText = sanitizePlainText(msg.block.text || '');
      const decorator = typeof msg.block.decorator === 'string' ? msg.block.decorator : JSON.stringify({ type: 'p' });
      const newBlock = {
        id: blockId,
        text: sanitizedText,
        decorator,
        lockedBy: null,
      };

      const doc = await resolveModel().findByPk(ws.documentId);
      if (!doc) return sendError(ws, 'Document not found');

      const blocks = parseDocBlocks(doc.content);
      if (msg.afterBlockId) {
        const index = blocks.findIndex((b) => b && b.id === msg.afterBlockId);
        if (index !== -1) {
          blocks.splice(index + 1, 0, newBlock);
        } else {
          blocks.push(newBlock);
        }
      } else {
        blocks.push(newBlock);
      }

      doc.content = JSON.stringify(blocks);
      await doc.save();

      return broadcast(
        ws.documentId,
        {
          type: 'block_created',
          documentId: ws.documentId,
          block: newBlock,
          afterBlockId: msg.afterBlockId || null,
          userId: ws.userId,
        },
        ws,
      );
    }

    if (msg.type === 'block_delete') {
      if (!ws.documentId) return sendError(ws, 'Join a document first');
      if (!atLeast(ws.permission, 'editor')) return sendError(ws, 'Read-only access');
      if (!msg.blockId || typeof msg.blockId !== 'string') {
        return sendError(ws, 'blockId must be a string');
      }

      const doc = await resolveModel().findByPk(ws.documentId);
      if (!doc) return sendError(ws, 'Document not found');

      const blocks = parseDocBlocks(doc.content);
      const index = blocks.findIndex((b) => b && b.id === msg.blockId);
      if (index !== -1) {
        blocks.splice(index, 1);
        doc.content = JSON.stringify(blocks);
        await doc.save();
      }

      return broadcast(
        ws.documentId,
        {
          type: 'block_deleted',
          documentId: ws.documentId,
          blockId: msg.blockId,
          userId: ws.userId,
        },
        ws,
      );
    }

    if (msg.type === 'block_unlock') {
      if (!ws.documentId) return sendError(ws, 'Join a document first');
      if (!msg.blockId || typeof msg.blockId !== 'string') {
        return sendError(ws, 'blockId must be a string');
      }

      return broadcast(
        ws.documentId,
        {
          type: 'block_unlocked',
          documentId: ws.documentId,
          blockId: msg.blockId,
          userId: ws.userId,
        },
        ws,
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

      try {
        return await handleMessage(ws, msg);
      } catch (err) {
        console.error('[WS] message handling failed:', err);
        return sendError(ws, 'Internal error');
      }
    });

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('close', () => leaveRoom(ws));
    ws.on('error', () => leaveRoom(ws));
  });

  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {

      if (!ws.isAlive) {
        leaveRoom(ws);
        ws.terminate();
        continue;
      }

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

      void revalidatePermission(ws).catch((err) => {
        console.error('[WS] permission re-check failed:', err);
      });

      ws.isAlive = false;
      ws.ping();
    }
  }, HEARTBEAT_INTERVAL_MS);

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
