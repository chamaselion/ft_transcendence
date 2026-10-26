const crypto = require('crypto');
const { unescapeHtml } = require('../controllers/documents/sanitize');

const canonicalBlock = (block) => {
  const id = block && typeof block.id === 'string' ? block.id : '';
  const text =
    block && typeof block.text === 'string' ? unescapeHtml(block.text) : '';
  const decorator =
    block && typeof block.decorator === 'string' ? block.decorator : '';
  return [id, text, decorator];
};

const hashBlocks = (blocks) => {
  const canonical = Array.isArray(blocks) ? blocks.map(canonicalBlock) : [];
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonical))
    .digest('hex');
};

const fingerprintBlock = (block) =>
  crypto.createHash('sha256').update(JSON.stringify(canonicalBlock(block))).digest('hex');

const isValidContentHash = (value) =>
  typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);

module.exports = {
  hashBlocks,
  fingerprintBlock,
  isValidContentHash,
};
