const sanitizeHtml = require('sanitize-html');

// Documents are plain text: there is no rich-text editor, so title/content
// have no legitimate reason to contain HTML markup. Stripping all tags and
// attributes here protects against stored XSS no matter how a future frontend
// ends up rendering this data - even a raw 'innerHTML' insertion stays inert,
// because no tag/attribute survives this step.
//
// Two variants exist: 'sanitizePlainText' entity-encodes stray '<'/'>' (so the
// original text stays readable and can never reassemble into a tag), while
// 'stripTags' decodes those entities back to literals for values that are
// rendered with 'textContent'/'innerText'
const PLAIN_TEXT_OPTIONS = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: 'discard',
};

// Sanitize a single string field. Non-strings are returned untouched so
// callers can keep using their existing 'undefined'/type checks upstream;
// this only cleans values that are already known to be strings.
const sanitizePlainText = (value) => {
  if (typeof value !== 'string') return value;
  return sanitizeHtml(value, PLAIN_TEXT_OPTIONS);
};

// Strip HTML tags from a plain-text field without HTML-entity-encoding the
// result.
const stripTags = (value) => {
  if (typeof value !== 'string') return value;
  const stripped = sanitizeHtml(value, PLAIN_TEXT_OPTIONS);
  return stripped.replace(/&(?:amp|lt|gt|quot|#x27|#39);/g, (entity) => {
    switch (entity) {
      case '&amp;': return '&';
      case '&lt;': return '<';
      case '&gt;': return '>';
      case '&quot;': return '"';
      case '&#x27;':
      case '&#39;': return "'";
      default: return entity;
    }
  });
};

module.exports = { sanitizePlainText, stripTags };
