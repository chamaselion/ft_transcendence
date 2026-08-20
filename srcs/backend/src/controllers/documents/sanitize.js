const sanitizeHtml = require('sanitize-html');

// Documents are plain text: there is no rich-text editor, so title/content
// have no legitimate reason to contain HTML markup. Stripping all tags and
// attributes here protects against stored XSS
// no matter how a future frontend ends up rendering this data - even a raw
// `innerHTML` insertion stays inert, because no tag/attribute survives this
// step (stray `<`/`>` left over from things like "<script>" get entity-
// encoded rather than dropped, so the original text stays readable without
// ever reassembling into a real tag).
const PLAIN_TEXT_OPTIONS = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: 'discard',
};

// Sanitize a single string field. Non-strings are returned untouched so
// callers can keep using their existing `undefined`/type checks upstream;
// this only cleans values that are already known to be strings.
const sanitizePlainText = (value) => {
  if (typeof value !== 'string') return value;
  return sanitizeHtml(value, PLAIN_TEXT_OPTIONS);
};

module.exports = { sanitizePlainText };
