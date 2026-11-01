const sequelize = require('../db');

const states = new Map();
let externalBroadcast = null;

const registerLiveBroadcast = (handler) => {
  externalBroadcast = typeof handler === 'function' ? handler : null;
};

const ensureRoomState = (document) => {
  const id = String(document.id);
  const existing = states.get(id);
  if (existing) return existing;

  const state = {
    documentId: id,
    title: document.title,
    content: document.content,
    dirty: false,
    saving: null,
    members: 0,
    version: 0,
  };
  states.set(id, state);
  return state;
};

const getRoomState = (documentId) => states.get(String(documentId)) || null;
const hasLiveRoom = (documentId) => states.has(String(documentId));

const dropRoomState = (documentId) => {
  states.delete(String(documentId));
};

const awaitRoomPersistence = async (documentId) => {
  let state = getRoomState(documentId);
  while (state?.saving) {
    await state.saving;
    state = getRoomState(documentId);
  }
};

const getLiveSnapshot = (documentId) => {
  const state = getRoomState(documentId);
  if (!state) return null;
  return { title: state.title, content: state.content };
};

const touchRoom = (state) => {
  state.version += 1;
  state.dirty = true;
};

const setRoomContent = (state, content) => {
  state.content = content;
  touchRoom(state);
};

const setRoomTitle = (state, title) => {
  state.title = title;
  touchRoom(state);
};

const updateLiveDocument = (documentId, updates, { external = false } = {}) => {
  const state = getRoomState(documentId);
  if (!state) return null;
  const titleChanged = updates.title !== undefined && updates.title !== state.title;
  const contentChanged = updates.content !== undefined && updates.content !== state.content;
  if (!titleChanged && !contentChanged) return state;
  if (titleChanged) state.title = updates.title;
  if (contentChanged) state.content = updates.content;
  touchRoom(state);
  if (external && externalBroadcast) {
    externalBroadcast(state, { titleChanged, contentChanged });
  }
  return state;
};

const addRoomMember = (documentId) => {
  const state = getRoomState(documentId);
  if (state) state.members += 1;
};

const removeRoomMember = (documentId) => {
  const state = getRoomState(documentId);
  if (state) state.members = Math.max(0, state.members - 1);
};

const filterEmptyBlocks = (content) => {
  if (typeof content !== 'string') return content;
  try {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) return content;
    const next = parsed.filter(
      (block) => block && typeof block === 'object' && typeof block.text === 'string'
        ? block.text.trim().length > 0
        : Boolean(block),
    );
    return JSON.stringify(next);
  } catch {
    return content;
  }
};

const persistRoom = async (documentId) => {
  const state = getRoomState(documentId);
  if (!state) return;
  if (state.members > 0) return;
  if (!state.dirty) {
    states.delete(state.documentId);
    return;
  }
  if (state.saving) return state.saving;

  const version = state.version;
  const title = state.title;
  const content = filterEmptyBlocks(state.content);

  state.saving = (async () => {
    try {
      const document = await sequelize.models.document.findByPk(state.documentId);
      if (!document) {
        states.delete(state.documentId);
        return;
      }
      document.title = title;
      document.content = content;
      await document.save();
      if (state.version === version) {
        state.dirty = false;
      }
      if (state.members === 0 && !state.dirty) {
        states.delete(state.documentId);
      }
    } catch (error) {
      console.error('[LIVE DOCUMENT] Failed to persist room:', error.message);
    } finally {
      state.saving = null;
      if (state.members === 0 && state.dirty) {
        void persistRoom(state.documentId);
      }
    }
  })();

  return state.saving;
};

const flushAllLiveDocuments = async () => {
  const ids = [...states.keys()];
  await Promise.all(ids.map((id) => persistRoomForShutdown(id)));
};

const persistRoomForShutdown = async (documentId) => {
  const state = getRoomState(documentId);
  if (!state) return;
  if (state.saving) await state.saving;
  if (!state.dirty) return;
  const title = state.title;
  const content = filterEmptyBlocks(state.content);
  try {
    const document = await sequelize.models.document.findByPk(state.documentId);
    if (!document) return;
    document.title = title;
    document.content = content;
    await document.save();
    state.dirty = false;
  } catch (error) {
    console.error('[LIVE DOCUMENT] Failed to flush room on shutdown:', error.message);
  }
};

module.exports = {
  registerLiveBroadcast,
  ensureRoomState,
  getRoomState,
  hasLiveRoom,
  dropRoomState,
  awaitRoomPersistence,
  getLiveSnapshot,
  updateLiveDocument,
  setRoomContent,
  setRoomTitle,
  addRoomMember,
  removeRoomMember,
  persistRoom,
  flushAllLiveDocuments,
  filterEmptyBlocks,
};
