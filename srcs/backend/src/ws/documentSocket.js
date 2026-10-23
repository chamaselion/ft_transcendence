const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { parse: parseUrl } = require('url');
const { requireEnv } = require('../config');
const sequelize = require('../db');
const { getTokenFromCookie, isSessionActive } = require('../controllers/auth/helpers');
const { validateUuid } = require('../controllers/auth/validation');
const {
  DOCUMENT_TITLE_MAX_LENGTH,
  EDITOR_BLOCK_MAX_LENGTH,
  MAX_BLOCKS,
  MAX_DECORATOR_LENGTH,
  MAX_BLOCK_ID_LENGTH,
  sanitizeText,
  sanitizeContent,
  validateTextLength,
  validateContentLength,
} = require('../controllers/documents/sanitize');
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
      // Deterministic id so repeated parses of the same legacy text agree.
      id: crypto.createHash('sha1').update(content).digest('hex'),
      text: content,
      decorator: JSON.stringify({ type: 'p' }),
      lockedBy: null,
    },
  ];
};


const WS_PATH = '/api/ws';


const HEARTBEAT_INTERVAL_MS = 30_000;
const SERVER_LOCK_TIMEOUT_MS = 5500;
const MAX_RAW_MESSAGE_BYTES = 256 * 1024;
const MAX_CLIENT_ID_LENGTH = 128;


const rooms = new Map();

// Serializes read-modify-write cycles on a document's content column. The
// block handlers read the whole JSON blob, mutate one block and write it back;
// without this, two concurrent handlers interleave and one edit is lost.
// NOTE: this is an in-process lock and is correct for the current single
// backend instance. If the backend is ever scaled to multiple processes,
// replace this with `transaction.LOCK.UPDATE` on the document row.
const writeQueues = new Map();
const withDocumentWriteLock = (documentId, task) => {
  const previous = writeQueues.get(documentId) ?? Promise.resolve();
  const run = previous.catch(() => {}).then(task);
  writeQueues.set(documentId, run);
  run.then(
    () => {
      if (writeQueues.get(documentId) === run) writeQueues.delete(documentId);
    },
    () => {
      if (writeQueues.get(documentId) === run) writeQueues.delete(documentId);
    },
  );
  return run;
};

const send = (ws, data) => {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(data));
};
const sendError = (ws, error) => send(ws, { type: 'error', error });

const clearServerLockTimer = (ws) => {
  if (ws.lockTimeoutTimer) {
    clearTimeout(ws.lockTimeoutTimer);
    ws.lockTimeoutTimer = null;
  }
};

const startServerLockTimer = (ws) => {
  clearServerLockTimer(ws);
  ws.lockTimeoutTimer = setTimeout(() => {
    if (ws.lockedBlockId && ws.documentId) {
      const blockId = ws.lockedBlockId;
      ws.lockedBlockId = null;
      broadcast(ws.documentId, {
        type: 'block_unlocked',
        documentId: ws.documentId,
        blockId,
        clientId: ws.clientId,
        userId: ws.userId,
      });
    }
    ws.lockTimeoutTimer = null;
  }, SERVER_LOCK_TIMEOUT_MS);
};

const leaveRoom = (ws) => {
  clearServerLockTimer(ws);
  const roomId = ws.documentId;
  if (!roomId || !rooms.has(roomId)) return;
  if (ws.lockedBlockId) {
    broadcast(roomId, {
      type: 'block_unlocked',
      documentId: roomId,
      blockId: ws.lockedBlockId,
      clientId: ws.clientId,
      userId: ws.userId,
    });
    ws.lockedBlockId = null;
  }
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

const lockHolder = (documentId, blockId, except) =>
  [...(rooms.get(documentId) || [])].find(
    (client) => client !== except && client.lockedBlockId === blockId,
  );


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

  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_RAW_MESSAGE_BYTES });
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

      // Normalize legacy/empty content once so the client and server agree on
      // block ids. Persist the migration so every later message sees the same
      // JSON shape.
      let blocks = null;
      let isArray = false;
      try {
        const parsed = JSON.parse(doc.content);
        isArray = Array.isArray(parsed);
        blocks = isArray ? parsed : null;
      } catch {
        isArray = false;
      }
      // Only migrate legacy non-JSON content to JSON format
      if (!isArray) {
        const legacyText = typeof doc.content === 'string' ? doc.content.trim() : '';
        blocks = [
          {
            id: crypto.randomUUID(),
            text: sanitizeText(legacyText),
            decorator: JSON.stringify({ type: 'p' }),
            lockedBy: null,
          },
        ];
        doc.content = JSON.stringify(blocks);
        await doc.save();
      }

      send(ws, {
        type: 'init',
        permission,
        document: { id: doc.id, title: doc.title, content: doc.content },
      });

      const currentRoom = rooms.get(doc.id);
      if (currentRoom) {
        for (const client of currentRoom) {
          if (client !== ws && client.lockedBlockId) {
            send(ws, {
              type: 'block_locked',
              documentId: doc.id,
              blockId: client.lockedBlockId,
              clientId: client.clientId,
              userId: client.userId,
            });
          }
        }
      }
      return;
    }

    if (msg.type === 'update') {
      if (!ws.documentId) return sendError(ws, 'Join a document first');

      if (!atLeast(ws.permission, 'editor')) {
        return sendError(ws, 'Read-only access');
      }
      if (typeof msg.content !== 'string') {
        return sendError(ws, 'content must be a string');
      }
      if (msg.content.length > MAX_RAW_MESSAGE_BYTES) {
        return sendError(ws, 'content exceeds maximum size');
      }
      if (!validateContentLength(msg.content)) {
        return sendError(ws, `content blocks must be objects with string text of at most ${EDITOR_BLOCK_MAX_LENGTH} characters`);
      }

      return withDocumentWriteLock(ws.documentId, async () => {
        const doc = await resolveModel().findByPk(ws.documentId);
        if (!doc) return sendError(ws, 'Document not found');

        const sanitizedContent = sanitizeContent(msg.content);

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
      });
    }

    if (msg.type === 'block_edit') {
      if (!ws.documentId) return sendError(ws, 'Join a document first');
      if (!atLeast(ws.permission, 'editor')) return sendError(ws, 'Read-only access');
      if (!msg.blockId || typeof msg.blockId !== 'string' || msg.blockId.length > MAX_BLOCK_ID_LENGTH) {
        return sendError(ws, 'Invalid block id');
      }
      if (msg.decorator !== undefined && (typeof msg.decorator !== 'string' || msg.decorator.length > MAX_DECORATOR_LENGTH)) {
        return sendError(ws, `decorator must be a string of at most ${MAX_DECORATOR_LENGTH} characters`);
      }
      if (lockHolder(ws.documentId, msg.blockId, ws)) {
        return sendError(ws, 'Block is locked by another user');
      }

      return withDocumentWriteLock(ws.documentId, async () => {
        const doc = await resolveModel().findByPk(ws.documentId);
        if (!doc) return sendError(ws, 'Document not found');

        const blocks = parseDocBlocks(doc.content);
        const target = blocks.find((b) => b && b.id === msg.blockId);
        if (!target) return sendError(ws, 'Block not found');

        if (msg.text !== undefined && !validateTextLength(String(msg.text), EDITOR_BLOCK_MAX_LENGTH)) {
          return sendError(ws, `block text must be at most ${EDITOR_BLOCK_MAX_LENGTH} characters`);
        }
        const sanitizedText = msg.text !== undefined ? sanitizeText(String(msg.text)) : target.text;
        target.text = sanitizedText;
        if (msg.decorator !== undefined && typeof msg.decorator === 'string') {
          target.decorator = msg.decorator;
        }

        if (ws.lockedBlockId === msg.blockId) {
          startServerLockTimer(ws);
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
      });
    }

    if (msg.type === 'block_create') {
      if (!ws.documentId) return sendError(ws, 'Join a document first');
      if (!atLeast(ws.permission, 'editor')) return sendError(ws, 'Read-only access');
      if (!msg.block || typeof msg.block !== 'object') {
        return sendError(ws, 'block must be an object');
      }

      const blockId =
        typeof msg.block.id === 'string' && msg.block.id
          ? msg.block.id
          : (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
      if (typeof blockId !== 'string' || blockId.length > MAX_BLOCK_ID_LENGTH) {
        return sendError(ws, 'Invalid block id');
      }
      if (msg.afterBlockId !== undefined && msg.afterBlockId !== null) {
        if (typeof msg.afterBlockId !== 'string' || msg.afterBlockId.length > MAX_BLOCK_ID_LENGTH) {
          return sendError(ws, 'Invalid afterBlockId');
        }
      }
      if (msg.block.decorator !== undefined && msg.block.decorator !== null) {
        if (typeof msg.block.decorator !== 'string' || msg.block.decorator.length > MAX_DECORATOR_LENGTH) {
          return sendError(ws, `decorator must be a string of at most ${MAX_DECORATOR_LENGTH} characters`);
        }
      }
      if (!validateTextLength(String(msg.block.text ?? ''), EDITOR_BLOCK_MAX_LENGTH)) {
        return sendError(ws, `block text must be at most ${EDITOR_BLOCK_MAX_LENGTH} characters`);
      }
      const sanitizedText = sanitizeText(String(msg.block.text ?? ''));
      const decorator = typeof msg.block.decorator === 'string' ? msg.block.decorator : JSON.stringify({ type: 'p' });
      const newBlock = {
        id: blockId,
        text: sanitizedText,
        decorator,
        lockedBy: null,
      };

      return withDocumentWriteLock(ws.documentId, async () => {
        const doc = await resolveModel().findByPk(ws.documentId);
        if (!doc) return sendError(ws, 'Document not found');

        const blocks = parseDocBlocks(doc.content);
        if (blocks.length >= MAX_BLOCKS) {
          return sendError(ws, `Document cannot exceed ${MAX_BLOCKS} blocks`);
        }
        if (blocks.some((b) => b && b.id === blockId)) {
          return sendError(ws, 'Block id already exists');
        }
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
      });
    }

    if (msg.type === 'block_delete') {
      if (!ws.documentId) return sendError(ws, 'Join a document first');
      if (!atLeast(ws.permission, 'editor')) return sendError(ws, 'Read-only access');
      if (!msg.blockId || typeof msg.blockId !== 'string' || msg.blockId.length > MAX_BLOCK_ID_LENGTH) {
        return sendError(ws, 'Invalid block id');
      }

      if (lockHolder(ws.documentId, msg.blockId, ws)) {
        return sendError(ws, 'Block is locked by another user');
      }

      return withDocumentWriteLock(ws.documentId, async () => {
        const doc = await resolveModel().findByPk(ws.documentId);
        if (!doc) return sendError(ws, 'Document not found');

        const blocks = parseDocBlocks(doc.content);
        const index = blocks.findIndex((b) => b && b.id === msg.blockId);
        if (index !== -1) {
          blocks.splice(index, 1);
          doc.content = JSON.stringify(blocks);
          await doc.save();
        }
        if (ws.lockedBlockId === msg.blockId) {
          clearServerLockTimer(ws);
          ws.lockedBlockId = null;
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
      });
    }

    if (msg.type === 'block_lock') {
      if (!ws.documentId) return sendError(ws, 'Join a document first');
      if (!atLeast(ws.permission, 'editor')) return sendError(ws, 'Read-only access');
      if (!msg.blockId || typeof msg.blockId !== 'string' || msg.blockId.length > MAX_BLOCK_ID_LENGTH) {
        return sendError(ws, 'Invalid block id');
      }
      if (msg.clientId !== undefined && msg.clientId !== null) {
        if (typeof msg.clientId !== 'string' || msg.clientId.length > MAX_CLIENT_ID_LENGTH) {
          return sendError(ws, 'Invalid client id');
        }
      }

      // Race condition check: first wins
      const room = rooms.get(ws.documentId);
      if (room) {
        for (const client of room) {
          if (client !== ws && client.lockedBlockId === msg.blockId) {
            send(ws, {
              type: 'block_locked',
              documentId: ws.documentId,
              blockId: msg.blockId,
              clientId: client.clientId,
              userId: client.userId,
            });
            return sendError(ws, 'Block is locked by another user');
          }
        }
      }

      if (ws.lockedBlockId && ws.lockedBlockId !== msg.blockId) {
        clearServerLockTimer(ws);
        broadcast(ws.documentId, {
          type: 'block_unlocked',
          documentId: ws.documentId,
          blockId: ws.lockedBlockId,
          clientId: ws.clientId,
          userId: ws.userId,
        });
      }
      ws.lockedBlockId = msg.blockId;
      if (msg.clientId) ws.clientId = msg.clientId;

      startServerLockTimer(ws);

      return broadcast(
        ws.documentId,
        {
          type: 'block_locked',
          documentId: ws.documentId,
          blockId: msg.blockId,
          clientId: msg.clientId,
          userId: ws.userId,
        },
        ws,
      );
    }

    if (msg.type === 'block_unlock') {
      if (!ws.documentId) return sendError(ws, 'Join a document first');
      if (!atLeast(ws.permission, 'editor')) return sendError(ws, 'Read-only access');
      if (!msg.blockId || typeof msg.blockId !== 'string' || msg.blockId.length > MAX_BLOCK_ID_LENGTH) {
        return sendError(ws, 'Invalid block id');
      }
      if (msg.clientId !== undefined && msg.clientId !== null) {
        if (typeof msg.clientId !== 'string' || msg.clientId.length > MAX_CLIENT_ID_LENGTH) {
          return sendError(ws, 'Invalid client id');
        }
      }
      if (ws.lockedBlockId !== msg.blockId) {
        return;
      }
      clearServerLockTimer(ws);
      ws.lockedBlockId = null;

      return broadcast(
        ws.documentId,
        {
          type: 'block_unlocked',
          documentId: ws.documentId,
          blockId: msg.blockId,
          clientId: msg.clientId,
          userId: ws.userId,
        },
        ws,
      );
    }

    if (msg.type === 'title_update') {
      if (!ws.documentId) return sendError(ws, 'Join a document first');
      if (!atLeast(ws.permission, 'editor')) return sendError(ws, 'Read-only access');
      if (typeof msg.title !== 'string' || !msg.title.trim()) {
        return sendError(ws, 'title must be a non-empty string');
      }
      if (!validateTextLength(msg.title.trim(), DOCUMENT_TITLE_MAX_LENGTH)) {
        return sendError(ws, `title must be at most ${DOCUMENT_TITLE_MAX_LENGTH} characters long`);
      }

      return withDocumentWriteLock(ws.documentId, async () => {
        const doc = await resolveModel().findByPk(ws.documentId);
        if (!doc) return sendError(ws, 'Document not found');

        const sanitizedTitle = sanitizeText(msg.title.trim());
        doc.title = sanitizedTitle;
        await doc.save();

        return broadcast(
          ws.documentId,
          {
            type: 'title_updated',
            documentId: ws.documentId,
            title: sanitizedTitle,
            userId: ws.userId,
          },
          ws,
        );
      });
    }

    return sendError(ws, 'Unknown message type');
  };

  wss.on('connection', (ws) => {
    ws.on('message', async (raw) => {
      const byteLength = Buffer.isBuffer(raw) ? raw.length : Buffer.byteLength(raw);
      if (byteLength > MAX_RAW_MESSAGE_BYTES) {
        return sendError(ws, 'Payload too large');
      }

      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch (err) {
        return sendError(ws, 'Invalid JSON');
      }

      if (!msg || typeof msg !== 'object' || Array.isArray(msg)) {
        return sendError(ws, 'Message must be an object');
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
