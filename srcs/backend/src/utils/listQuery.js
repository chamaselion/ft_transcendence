const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_QUERY_LENGTH = 100;

const fail = (error) => ({ ok: false, error });
const succeed = (value) => ({ ok: true, value });


const readInteger = (raw, { name, min, max, fallback }) => {
  if (raw === undefined || raw === '') return succeed(fallback);

  if (!/^\d+$/.test(String(raw).trim())) {
    return fail(`${name} must be a whole number`);
  }

  const value = Number(raw);
  if (value < min || value > max) {
    return fail(`${name} must be between ${min} and ${max}`);
  }
  return succeed(value);
};


const escapeLikeWildcards = (value) =>
  value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');


const likePattern = (value) => `%${escapeLikeWildcards(value)}%`;

const parseListQuery = (query = {}, { sortable, defaultSort, defaultOrder = 'DESC' }) => {
  const parsed = {};

  const rawQ = query.q === undefined ? '' : String(query.q).trim();
  if (rawQ.length > MAX_QUERY_LENGTH) {
    return fail(`q must be at most ${MAX_QUERY_LENGTH} characters`);
  }

  parsed.q = rawQ || null;

  const rawSort = query.sort === undefined ? defaultSort : String(query.sort).trim();
  if (!sortable.includes(rawSort)) {
    return fail(`sort must be one of: ${sortable.join(', ')}`);
  }
  parsed.sort = rawSort;

  const rawOrder = (query.order === undefined ? defaultOrder : String(query.order))
    .trim()
    .toUpperCase();
  if (!['ASC', 'DESC'].includes(rawOrder)) {
    return fail('order must be one of: asc, desc');
  }
  parsed.order = rawOrder;

  const limit = readInteger(query.limit, {
    name: 'limit', min: 1, max: MAX_LIMIT, fallback: DEFAULT_LIMIT,
  });
  if (!limit.ok) return limit;
  parsed.limit = limit.value;


  const offset = readInteger(query.offset, {
    name: 'offset', min: 0, max: Number.MAX_SAFE_INTEGER, fallback: 0,
  });
  if (!offset.ok) return offset;
  parsed.offset = offset.value;

  return succeed(parsed);
};


const paginationOf = ({ total, limit, offset }) => ({ total, limit, offset });

module.exports = {
  parseListQuery,
  likePattern,
  paginationOf,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MAX_QUERY_LENGTH,
};
