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
const { hashBlocks, fingerprintBlock, isValidContentHash } = require('./contentHash');
const {
  ensureRoomState,
  getRoomState,
  setRoomContent,
  setRoomTitle,
  addRoomMember,
  removeRoomMember,
  persistRoom,
  awaitRoomPersistence,
  registerLiveBroadcast,
} = require('./liveDocuments');

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
const MAX_SOCKET_MESSAGE_BYTES = 10 * 1024 * 1024;
const MAX_CLIENT_ID_LENGTH = 128;
const MAX_PENDING_MESSAGES = 100;
const MAX_SYNC_OPS = 2000;
const MAX_SYNC_OP_TEXT_BYTES = 8 * 1024 * 1024;
const MAX_WS_SESSIONS_PER_USER = Number(process.env.MAX_WS_SESSIONS_PER_USER) || 3;


const rooms = new Map();
const userConnections = new Map();

const trackUserConnection = (ws) => {
  if (ws.trackedConnection) return;
  let set = userConnections.get(ws.userId);
  if (!set) {
    set = new Set();
    userConnections.set(ws.userId, set);
  }
  set.add(ws);
  ws.trackedConnection = true;
};

const untrackUserConnection = (ws) => {
  if (!ws.trackedConnection) return;
  ws.trackedConnection = false;
  const set = userConnections.get(ws.userId);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) userConnections.delete(ws.userId);
};


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
  if (!roomId) return;
  if (!rooms.has(roomId)) {
    removeRoomMember(roomId);
    void persistRoom(roomId);
    ws.documentId = null;
    ws.permission = null;
    return;
  }
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
  removeRoomMember(roomId);
  if (room.size === 0) {
    rooms.delete(roomId);
    void persistRoom(roomId);
  }
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

const blockConflict = (blockId, reason, block) => ({
  blockId,
  reason,
  block: block || null,
  fingerprint: block ? fingerprintBlock(block) : null,
});

const applySyncOperations = (blocks, title, ops) => {
  const nextBlocks = blocks.map((block) =>
    block && typeof block === 'object' ? { ...block } : block,
  );
  let nextTitle = title;
  const applied = [];

  for (const op of ops) {
    if (!op || typeof op !== 'object' || Array.isArray(op)) {
      return { ok: false, type: 'invalid', error: 'Invalid sync operation' };
    }

    if (op.kind === 'title') {
      if (typeof op.title !== 'string' || !op.title.trim()) {
        return { ok: false, type: 'invalid', error: 'title must be a non-empty string' };
      }
      const nextValue = sanitizeText(op.title.trim());
      if (!nextValue || !validateTextLength(nextValue, DOCUMENT_TITLE_MAX_LENGTH)) {
        return {
          ok: false,
          type: 'invalid',
          error: `title must be at most ${DOCUMENT_TITLE_MAX_LENGTH} characters long`,
        };
      }
      if (op.expectedTitle !== undefined && op.expectedTitle !== null) {
        if (typeof op.expectedTitle !== 'string') {
          return { ok: false, type: 'invalid', error: 'expectedTitle must be a string' };
        }
        const expectedTitle = sanitizeText(op.expectedTitle.trim());
        if (expectedTitle !== nextTitle) {
          return {
            ok: false,
            type: 'conflict',
            conflict: { kind: 'title', reason: 'stale', remoteTitle: nextTitle },
          };
        }
      }
      nextTitle = nextValue;
      applied.push({ kind: 'title', title: nextTitle });
      continue;
    }

    if (op.kind === 'set') {
      if (typeof op.blockId !== 'string' || !op.blockId || op.blockId.length > MAX_BLOCK_ID_LENGTH) {
        return { ok: false, type: 'invalid', error: 'Invalid block id' };
      }
      if (!isValidContentHash(op.expected)) {
        return { ok: false, type: 'invalid', error: 'Invalid expected fingerprint' };
      }
      const target = nextBlocks.find((block) => block && block.id === op.blockId);
      if (!target) {
        return {
          ok: false,
          type: 'conflict',
          conflict: blockConflict(op.blockId, 'deleted-remote', null),
        };
      }
      if (fingerprintBlock(target) !== op.expected.toLowerCase()) {
        return {
          ok: false,
          type: 'conflict',
          conflict: blockConflict(op.blockId, 'stale', target),
        };
      }
      if (op.text === undefined && op.decorator === undefined) {
        return { ok: false, type: 'invalid', error: 'Nothing to update in block' };
      }
      if (op.text !== undefined && !validateTextLength(String(op.text), EDITOR_BLOCK_MAX_LENGTH)) {
        return {
          ok: false,
          type: 'invalid',
          error: `block text must be at most ${EDITOR_BLOCK_MAX_LENGTH} characters`,
        };
      }
      if (
        op.decorator !== undefined &&
        (typeof op.decorator !== 'string' || op.decorator.length > MAX_DECORATOR_LENGTH)
      ) {
        return {
          ok: false,
          type: 'invalid',
          error: `decorator must be a string of at most ${MAX_DECORATOR_LENGTH} characters`,
        };
      }
      if (op.text !== undefined) target.text = sanitizeText(String(op.text));
      if (op.decorator !== undefined) target.decorator = op.decorator;
      applied.push({
        kind: 'set',
        blockId: target.id,
        text: target.text,
        decorator: target.decorator,
      });
      continue;
    }

    if (op.kind === 'create') {
      const block = op.block;
      if (!block || typeof block !== 'object' || Array.isArray(block)) {
        return { ok: false, type: 'invalid', error: 'block must be an object' };
      }
      if (typeof block.id !== 'string' || !block.id || block.id.length > MAX_BLOCK_ID_LENGTH) {
        return { ok: false, type: 'invalid', error: 'Invalid block id' };
      }
      if (op.afterBlockId !== undefined && op.afterBlockId !== null) {
        if (
          typeof op.afterBlockId !== 'string' ||
          op.afterBlockId.length > MAX_BLOCK_ID_LENGTH
        ) {
          return { ok: false, type: 'invalid', error: 'Invalid afterBlockId' };
        }
      }
      if (
        block.decorator !== undefined &&
        block.decorator !== null &&
        (typeof block.decorator !== 'string' || block.decorator.length > MAX_DECORATOR_LENGTH)
      ) {
        return {
          ok: false,
          type: 'invalid',
          error: `decorator must be a string of at most ${MAX_DECORATOR_LENGTH} characters`,
        };
      }
      if (!validateTextLength(String(block.text ?? ''), EDITOR_BLOCK_MAX_LENGTH)) {
        return {
          ok: false,
          type: 'invalid',
          error: `block text must be at most ${EDITOR_BLOCK_MAX_LENGTH} characters`,
        };
      }
      const newBlock = {
        id: block.id,
        text: sanitizeText(String(block.text ?? '')),
        decorator:
          typeof block.decorator === 'string'
            ? block.decorator
            : JSON.stringify({ type: 'p' }),
        lockedBy: null,
      };
      const existing = nextBlocks.find((item) => item && item.id === newBlock.id);
      if (existing) {
        if (fingerprintBlock(existing) === fingerprintBlock(newBlock)) {
          continue;
        }
        return {
          ok: false,
          type: 'conflict',
          conflict: blockConflict(newBlock.id, 'already-exists', existing),
        };
      }
      if (nextBlocks.length >= MAX_BLOCKS) {
        return {
          ok: false,
          type: 'invalid',
          error: `Document cannot exceed ${MAX_BLOCKS} blocks`,
        };
      }
      const afterBlockId = op.afterBlockId || null;
      if (afterBlockId) {
        const index = nextBlocks.findIndex((item) => item && item.id === afterBlockId);
        if (index !== -1) nextBlocks.splice(index + 1, 0, newBlock);
        else nextBlocks.push(newBlock);
      } else {
        nextBlocks.push(newBlock);
      }
      applied.push({ kind: 'create', block: newBlock, afterBlockId });
      continue;
    }

    if (op.kind === 'move') {
      if (typeof op.blockId !== 'string' || !op.blockId || op.blockId.length > MAX_BLOCK_ID_LENGTH) {
        return { ok: false, type: 'invalid', error: 'Invalid block id' };
      }
      if (op.afterBlockId !== undefined && op.afterBlockId !== null) {
        if (
          typeof op.afterBlockId !== 'string' ||
          op.afterBlockId.length > MAX_BLOCK_ID_LENGTH
        ) {
          return { ok: false, type: 'invalid', error: 'Invalid afterBlockId' };
        }
      }
      if (op.afterBlockId === op.blockId) {
        return { ok: false, type: 'invalid', error: 'A block cannot follow itself' };
      }
      const index = nextBlocks.findIndex((block) => block && block.id === op.blockId);
      if (index === -1) {
        return {
          ok: false,
          type: 'conflict',
          conflict: blockConflict(op.blockId, 'deleted-remote', null),
        };
      }
      const [moved] = nextBlocks.splice(index, 1);
      if (op.afterBlockId) {
        const targetIndex = nextBlocks.findIndex(
          (block) => block && block.id === op.afterBlockId,
        );
        if (targetIndex === -1) {
          nextBlocks.splice(index, 0, moved);
          return {
            ok: false,
            type: 'conflict',
            conflict: blockConflict(op.afterBlockId, 'deleted-remote', null),
          };
        }
        nextBlocks.splice(targetIndex + 1, 0, moved);
      } else {
        nextBlocks.unshift(moved);
      }
      applied.push({
        kind: 'move',
        blockId: op.blockId,
        afterBlockId: op.afterBlockId || null,
      });
      continue;
    }

    if (op.kind === 'delete') {
      if (typeof op.blockId !== 'string' || !op.blockId || op.blockId.length > MAX_BLOCK_ID_LENGTH) {
        return { ok: false, type: 'invalid', error: 'Invalid block id' };
      }
      if (!isValidContentHash(op.expected)) {
        return { ok: false, type: 'invalid', error: 'Invalid expected fingerprint' };
      }
      const index = nextBlocks.findIndex((block) => block && block.id === op.blockId);
      if (index === -1) {
        continue;
      }
      const target = nextBlocks[index];
      if (fingerprintBlock(target) !== op.expected.toLowerCase()) {
        return {
          ok: false,
          type: 'conflict',
          conflict: blockConflict(op.blockId, 'stale', target),
        };
      }
      nextBlocks.splice(index, 1);
      applied.push({ kind: 'delete', blockId: op.blockId });
      continue;
    }

    return { ok: false, type: 'invalid', error: 'Unknown sync operation' };
  }

  return { ok: true, blocks: nextBlocks, title: nextTitle, applied };
};

const sendSyncConflict = (ws, requestId, conflict) =>
  send(ws, {
    type: 'sync_conflict',
    documentId: ws.documentId,
    requestId: typeof requestId === 'string' ? requestId : undefined,
    conflicts: [conflict],
  });


let activeServer = null;

const connectionsForToken = (token) => {
  if (!token || !activeServer) return [];
  return [...activeServer.clients].filter((client) => client.token === token);
};

const hasRoomLocks = (documentId) => {
  const room = rooms.get(String(documentId));
  if (!room) return false;
  return [...room].some((client) => Boolean(client.lockedBlockId));
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

const evictDocumentRoom = (documentId) => {
  const room = rooms.get(String(documentId));
  if (!room) return;
  for (const client of [...room]) {
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

  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_SOCKET_MESSAGE_BYTES });
  activeServer = wss;
  registerLiveBroadcast((state, changes = {}) => {
    if (changes.contentChanged) {
      const blocks = parseDocBlocks(state.content);
      broadcast(state.documentId, {
        type: 'update',
        documentId: state.documentId,
        content: state.content,
        contentHash: hashBlocks(blocks),
      });
    }
    if (changes.titleChanged) {
      broadcast(state.documentId, {
        type: 'title_updated',
        documentId: state.documentId,
        title: state.title,
      });
    }
  });

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

      await awaitRoomPersistence(idCheck.value);
      const { document: doc, permission } = await resolvePermission(user, idCheck.value, {
        documentModel: resolveModel(),
        shareModel: resolveShareModel(),
      });
      if (!atLeast(permission, 'viewer')) return sendError(ws, 'Document not found');

      leaveRoom(ws);
      const state = ensureRoomState(doc);
      ws.documentId = state.documentId;
      ws.permission = permission;
      if (!rooms.has(state.documentId)) rooms.set(state.documentId, new Set());
      rooms.get(state.documentId).add(ws);
      addRoomMember(state.documentId);

      // Normalize legacy/empty content in the live room state. It is persisted
      // only when the last member leaves the room.
      let blocks = null;
      let isArray = false;
      try {
        const parsed = JSON.parse(state.content);
        isArray = Array.isArray(parsed);
        blocks = isArray ? parsed : null;
      } catch {
        isArray = false;
      }
      if (!isArray) {
        const legacyText = typeof state.content === 'string' ? state.content.trim() : '';
        blocks = [
          {
            id: crypto.randomUUID(),
            text: sanitizeText(legacyText),
            decorator: JSON.stringify({ type: 'p' }),
            lockedBy: null,
          },
        ];
        setRoomContent(state, JSON.stringify(blocks));
      }

      const contentHash = hashBlocks(blocks);
      const localHash = isValidContentHash(msg.localHash)
        ? msg.localHash.toLowerCase()
        : null;
      const baseHash = isValidContentHash(msg.baseHash)
        ? msg.baseHash.toLowerCase()
        : null;
      const unchanged = contentHash === localHash || contentHash === baseHash;

      const locks = [];
      const currentRoom = rooms.get(doc.id);
      if (currentRoom) {
        for (const client of currentRoom) {
          if (client !== ws && client.lockedBlockId) {
            locks.push({
              blockId: client.lockedBlockId,
              clientId: client.clientId,
              userId: client.userId,
            });
          }
        }
      }

      send(ws, {
        type: 'init',
        permission,
        unchanged,
        contentHash,
        title: state.title,
        document: unchanged
          ? { id: state.documentId, title: state.title }
          : { id: state.documentId, title: state.title, content: state.content },
        locks,
      });
      for (const lock of locks) {
        send(ws, {
          type: 'block_locked',
          documentId: state.documentId,
          blockId: lock.blockId,
          clientId: lock.clientId,
          userId: lock.userId,
        });
      }
      return;
    }

    if (msg.type === 'sync') {
      const requestId =
        typeof msg.requestId === 'string' && msg.requestId.length <= MAX_CLIENT_ID_LENGTH
          ? msg.requestId
          : undefined;
      if (!ws.documentId) {
        return send(ws, {
          type: 'sync_error',
          documentId: ws.documentId,
          requestId,
          error: 'Join a document first',
        });
      }
      if (!atLeast(ws.permission, 'editor')) {
        return send(ws, {
          type: 'sync_error',
          documentId: ws.documentId,
          requestId,
          error: 'Read-only access',
        });
      }
      if (!Array.isArray(msg.ops) || msg.ops.length === 0) {
        return send(ws, {
          type: 'sync_error',
          documentId: ws.documentId,
          requestId,
          error: 'sync requires at least one operation',
        });
      }
      if (msg.ops.length > MAX_SYNC_OPS) {
        return send(ws, {
          type: 'sync_error',
          documentId: ws.documentId,
          requestId,
          error: `sync accepts at most ${MAX_SYNC_OPS} operations`,
        });
      }
      if (Buffer.byteLength(JSON.stringify(msg.ops)) > MAX_SYNC_OP_TEXT_BYTES) {
        return send(ws, {
          type: 'sync_error',
          documentId: ws.documentId,
          requestId,
          error: 'sync payload is too large',
        });
      }
      const targetIds = new Set();
      for (const op of msg.ops) {
        if (!op || typeof op !== 'object') continue;
        if (op.kind === 'set' || op.kind === 'delete' || op.kind === 'move') {
          if (typeof op.blockId === 'string') targetIds.add(op.blockId);
        }
        if (
          (op.kind === 'create' || op.kind === 'move') &&
          typeof op.afterBlockId === 'string'
        ) {
          targetIds.add(op.afterBlockId);
        }
      }
      const findLockedTarget = () => {
        for (const blockId of targetIds) {
          if (lockHolder(ws.documentId, blockId, ws)) {
            return { blockId, reason: 'locked' };
          }
        }
        return null;
      };

      const lockedTarget = findLockedTarget();
      if (lockedTarget) return sendSyncConflict(ws, requestId, lockedTarget);

      return withDocumentWriteLock(ws.documentId, async () => {
        if (!atLeast(ws.permission, 'editor')) {
          return send(ws, {
            type: 'sync_error',
            documentId: ws.documentId,
            requestId,
            error: 'Read-only access',
          });
        }
        const lockedNow = findLockedTarget();
        if (lockedNow) return sendSyncConflict(ws, requestId, lockedNow);

        const state = getRoomState(ws.documentId);
        if (!state) {
          return send(ws, {
            type: 'sync_error',
            documentId: ws.documentId,
            requestId,
            error: 'Document not found',
          });
        }

        const blocks = parseDocBlocks(state.content);
        const result = applySyncOperations(blocks, state.title, msg.ops);
        if (!result.ok) {
          if (result.type === 'invalid') {
            return send(ws, {
              type: 'sync_error',
              documentId: ws.documentId,
              requestId,
              error: result.error,
            });
          }
          return sendSyncConflict(ws, requestId, result.conflict);
        }

        if (result.applied.length === 0) {
          return send(ws, {
            type: 'sync_ok',
            documentId: ws.documentId,
            requestId,
            contentHash: hashBlocks(blocks),
            applied: 0,
          });
        }

        setRoomContent(state, JSON.stringify(result.blocks));
        setRoomTitle(state, result.title);

        const contentHash = hashBlocks(result.blocks);
        for (const item of result.applied) {
          if (item.kind === 'delete' && ws.lockedBlockId === item.blockId) {
            clearServerLockTimer(ws);
            ws.lockedBlockId = null;
          }
          if (item.kind === 'set') {
            broadcast(
              ws.documentId,
              {
                type: 'block_updated',
                documentId: ws.documentId,
                blockId: item.blockId,
                text: item.text,
                decorator: item.decorator,
                userId: ws.userId,
              },
              ws,
            );
          } else if (item.kind === 'create') {
            broadcast(
              ws.documentId,
              {
                type: 'block_created',
                documentId: ws.documentId,
                block: item.block,
                afterBlockId: item.afterBlockId,
                userId: ws.userId,
              },
              ws,
            );
          } else if (item.kind === 'delete') {
            broadcast(
              ws.documentId,
              {
                type: 'block_deleted',
                documentId: ws.documentId,
                blockId: item.blockId,
                userId: ws.userId,
              },
              ws,
            );
          } else if (item.kind === 'move') {
            broadcast(
              ws.documentId,
              {
                type: 'block_moved',
                documentId: ws.documentId,
                blockId: item.blockId,
                afterBlockId: item.afterBlockId,
                userId: ws.userId,
              },
              ws,
            );
          } else if (item.kind === 'title') {
            broadcast(
              ws.documentId,
              {
                type: 'title_updated',
                documentId: ws.documentId,
                title: item.title,
                userId: ws.userId,
              },
              ws,
            );
          }
        }

        return send(ws, {
          type: 'sync_ok',
          documentId: ws.documentId,
          requestId,
          contentHash,
          applied: result.applied.length,
        });
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
      if (msg.content.length > MAX_RAW_MESSAGE_BYTES) {
        return sendError(ws, 'content exceeds maximum size');
      }
      if (!validateContentLength(msg.content)) {
        return sendError(ws, `content blocks must be objects with string text of at most ${EDITOR_BLOCK_MAX_LENGTH} characters`);
      }

      const hasLockedBlock = () => {
        const room = rooms.get(ws.documentId);
        if (room) {
          for (const client of room) {
            if (client !== ws && client.lockedBlockId) return true;
          }
        }
        return false;
      };

      if (hasLockedBlock()) {
        return sendError(ws, 'Cannot overwrite document while blocks are locked');
      }

      return withDocumentWriteLock(ws.documentId, async () => {
        if (hasLockedBlock()) {
          return sendError(ws, 'Block is locked by another user');
        }

        const state = getRoomState(ws.documentId);
        if (!state) return sendError(ws, 'Document not found');

        const sanitizedContent = sanitizeContent(msg.content);

        setRoomContent(state, sanitizedContent);

        return broadcast(
          ws.documentId,
          {
            type: 'update',
            documentId: ws.documentId,
            content: sanitizedContent,
            contentHash: hashBlocks(parseDocBlocks(sanitizedContent)),
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
      if (ws.lockedBlockId !== msg.blockId) {
        return sendError(ws, 'Edit before lock recieved');
      }
      if (lockHolder(ws.documentId, msg.blockId, ws)) {
        return sendError(ws, 'Block is locked by another user');
      }

      return withDocumentWriteLock(ws.documentId, async () => {
        // The lock may have timed out
        const holder = lockHolder(ws.documentId, msg.blockId, ws);
        if (holder || ws.lockedBlockId !== msg.blockId) {
          return sendError(ws, 'Block is no longer locked by you');
        }

        const state = getRoomState(ws.documentId);
        if (!state) return sendError(ws, 'Document not found');

        const blocks = parseDocBlocks(state.content);
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

        setRoomContent(state, JSON.stringify(blocks));

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
        if (lockHolder(ws.documentId, msg.afterBlockId, ws)) {
          return sendError(ws, 'Preceding block is locked by another user');
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
        if (msg.afterBlockId && lockHolder(ws.documentId, msg.afterBlockId, ws)) {
          return sendError(ws, 'Preceding block is locked by another user');
        }

        const state = getRoomState(ws.documentId);
        if (!state) return sendError(ws, 'Document not found');

        const blocks = parseDocBlocks(state.content);
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

        setRoomContent(state, JSON.stringify(blocks));

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

      if (ws.lockedBlockId !== msg.blockId) {
        return sendError(ws, 'Delete before lock recieved');
      }
      if (lockHolder(ws.documentId, msg.blockId, ws)) {
        return sendError(ws, 'Block is locked by another user');
      }

      return withDocumentWriteLock(ws.documentId, async () => {
        // The lock may have timed out
        const holder = lockHolder(ws.documentId, msg.blockId, ws);
        if (holder || ws.lockedBlockId !== msg.blockId) {
          return sendError(ws, 'Block is no longer locked by you');
        }

        const state = getRoomState(ws.documentId);
        if (!state) return sendError(ws, 'Document not found');

        const blocks = parseDocBlocks(state.content);
        const index = blocks.findIndex((b) => b && b.id === msg.blockId);
        if (index !== -1) {
          blocks.splice(index, 1);
          setRoomContent(state, JSON.stringify(blocks));
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

    if (msg.type === 'block_move') {
      if (!ws.documentId) return sendError(ws, 'Join a document first');
      if (!atLeast(ws.permission, 'editor')) return sendError(ws, 'Read-only access');
      if (!msg.blockId || typeof msg.blockId !== 'string' || msg.blockId.length > MAX_BLOCK_ID_LENGTH) {
        return sendError(ws, 'Invalid block id');
      }
      if (msg.afterBlockId !== undefined && msg.afterBlockId !== null) {
        if (typeof msg.afterBlockId !== 'string' || msg.afterBlockId.length > MAX_BLOCK_ID_LENGTH) {
          return sendError(ws, 'Invalid afterBlockId');
        }
      }
      if (msg.afterBlockId === msg.blockId) {
        return sendError(ws, 'A block cannot follow itself');
      }
      if (lockHolder(ws.documentId, msg.blockId, ws)) {
        return sendError(ws, 'Block is locked by another user');
      }
      if (msg.afterBlockId && lockHolder(ws.documentId, msg.afterBlockId, ws)) {
        return sendError(ws, 'Target block is locked by another user');
      }

      return withDocumentWriteLock(ws.documentId, async () => {
        const state = getRoomState(ws.documentId);
        if (!state) return sendError(ws, 'Document not found');

        const blocks = parseDocBlocks(state.content);
        const index = blocks.findIndex((block) => block && block.id === msg.blockId);
        if (index === -1) return sendError(ws, 'Block not found');
        const [moved] = blocks.splice(index, 1);
        if (msg.afterBlockId) {
          const targetIndex = blocks.findIndex((block) => block && block.id === msg.afterBlockId);
          if (targetIndex === -1) {
            blocks.splice(index, 0, moved);
            return sendError(ws, 'Target block not found');
          }
          blocks.splice(targetIndex + 1, 0, moved);
        } else {
          blocks.unshift(moved);
        }
        setRoomContent(state, JSON.stringify(blocks));

        return broadcast(
          ws.documentId,
          {
            type: 'block_moved',
            documentId: ws.documentId,
            blockId: msg.blockId,
            afterBlockId: msg.afterBlockId || null,
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
        const state = getRoomState(ws.documentId);
        if (!state) return sendError(ws, 'Document not found');

        const sanitizedTitle = sanitizeText(msg.title.trim());
        setRoomTitle(state, sanitizedTitle);

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

    if (msg.type === 'ping') {
      return send(ws, { type: 'pong', timestamp: msg.timestamp });
    }

    return sendError(ws, 'Unknown message type');
  };

  wss.on('connection', (ws) => {
    trackUserConnection(ws);
    const userSet = userConnections.get(ws.userId);
    if (userSet && userSet.size > MAX_WS_SESSIONS_PER_USER) {
      untrackUserConnection(ws);
      send(ws, { type: 'error', error: 'Too many concurrent sessions' });
      ws.close(1013, 'Too many concurrent sessions');
      return;
    }
    // Process this socket's messages in order. block_edit queues a DB write and
    // re-checks the lock inside it; a following block_unlock must not overtake
    // that write, otherwise the edit is rejected as "no longer locked by you".
    let messageChain = Promise.resolve();
    let pendingMessages = 0;

    ws.on('message', (raw) => {
      const byteLength = Buffer.isBuffer(raw) ? raw.length : Buffer.byteLength(raw);
      if (byteLength > MAX_SOCKET_MESSAGE_BYTES) {
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

      if (pendingMessages >= MAX_PENDING_MESSAGES) {
        return ws.terminate();
      }

      pendingMessages += 1;
      messageChain = messageChain
        .catch(() => {})
        .then(() => handleMessage(ws, msg)) // attach message here
        .catch((err) => {
          console.error('[WS] message handling failed:', err);
          return sendError(ws, 'Internal error');
        })
        .finally(() => {
          pendingMessages -= 1;
        });
    });

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('close', () => {
      leaveRoom(ws);
      untrackUserConnection(ws);
    });
    ws.on('error', () => {
      leaveRoom(ws);
      untrackUserConnection(ws);
    });
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
  evictDocumentRoom,
  evictSession,
  syncLivePermission,
  hasRoomLocks,
  WS_PATH,
};
