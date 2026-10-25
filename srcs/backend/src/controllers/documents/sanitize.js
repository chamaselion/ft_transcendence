// Documents are plain text: there is no rich-text editor, so title/content
// have no legitimate reason to contain active HTML markup. Values are stored
// HTML-escaped, which keeps literal markup visible as text while ensuring it
// can never reassemble into a tag, even if a future frontend inserts the value
// with innerHTML.
//
// The frontend already escapes outgoing values. Canonicalizing with
// escape(unescape(value)) means correctly escaped input is left unchanged
// (no double encoding), while raw markup from other clients is escaped here.
const HTML_ESCAPE = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const HTML_UNESCAPE = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#x27;': "'",
  '&#39;': "'",
};

const escapeHtml = (value) => {
  if (typeof value !== 'string') return value;
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPE[character]);
};

const unescapeHtml = (value) => {
  if (typeof value !== 'string') return value;
  return value.replace(/&(?:amp|lt|gt|quot|#x27|#39);/g, (entity) => HTML_UNESCAPE[entity]);
};

const DOCUMENT_TITLE_MAX_LENGTH = 255;
const EDITOR_BLOCK_MAX_LENGTH = 5000;
const MAX_BLOCKS = 500;
const MAX_DECORATOR_LENGTH = 2048;
const MAX_BLOCK_ID_LENGTH = 128;

const textLength = (value) => unescapeHtml(value).length;

const validateTextLength = (value, maxLength) =>
  typeof value !== 'string' || textLength(value) <= maxLength;

const validateContentLength = (content) => {
  if (typeof content !== 'string') return true;
  try {
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed)) {
      if (parsed.length > MAX_BLOCKS) return false;
      return parsed.every(
        (block) =>
          block !== null &&
          typeof block === 'object' &&
          !Array.isArray(block) &&
          typeof block.text === 'string' &&
          validateTextLength(block.text, EDITOR_BLOCK_MAX_LENGTH) &&
          (block.id === undefined || (typeof block.id === 'string' && block.id.length <= MAX_BLOCK_ID_LENGTH)) &&
          (block.decorator === undefined || (typeof block.decorator === 'string' && block.decorator.length <= MAX_DECORATOR_LENGTH)),
      );
    }
  } catch {
    // Legacy plain-text content is checked below.
  }
  return validateTextLength(content, EDITOR_BLOCK_MAX_LENGTH);
};

// Canonicalize a single text field. Non-strings are returned untouched so
// callers can keep using their existing 'undefined'/type checks upstream.
const sanitizeText = (value) => {
  if (typeof value !== 'string') return value;
  return escapeHtml(unescapeHtml(value));
};

// Block documents are stored as a JSON array; sanitize each block's text field
// individually so HTML escaping never runs over serialized JSON syntax.
const sanitizeContent = (content) => {
  if (typeof content !== 'string') return content;
  try {
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed)) return sanitizeText(content);
    return JSON.stringify(
      parsed.map((block) =>
        block && typeof block === 'object' && typeof block.text === 'string'
          ? { ...block, text: sanitizeText(block.text) }
          : block,
      ),
    );
  } catch {
    // Legacy plain-text content.
    return sanitizeText(content);
  }
};

module.exports = {
  DOCUMENT_TITLE_MAX_LENGTH,
  EDITOR_BLOCK_MAX_LENGTH,
  MAX_BLOCKS,
  MAX_DECORATOR_LENGTH,
  MAX_BLOCK_ID_LENGTH,
  escapeHtml,
  unescapeHtml,
  sanitizeText,
  sanitizeContent,
  validateTextLength,
  validateContentLength,
};
