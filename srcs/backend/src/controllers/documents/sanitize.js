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

module.exports = { escapeHtml, unescapeHtml, sanitizeText, sanitizeContent };
