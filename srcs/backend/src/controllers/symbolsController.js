// Symbol endpoints:
//   - /api/symbols/search?q=        -> search the seeded assets in our DB
//   - /api/symbols/:symbol/history  -> proxy Yahoo OHLC chart data on demand
// Search is intentionally limited to the curated assets in db/seed.js (no
// arbitrary Yahoo tickers). Live prices for a selected symbol arrive separately
// over the websocket feed.

const { Op } = require('sequelize');
const sequelize = require('../db');
const { HISTORY_RANGES, fetchCandles } = require('../services/yahooHistory');

const createSymbolsController = ({
  assetModel = sequelize.models.asset,
} = {}) => {
  // GET /api/symbols/search?q=apple&type=crypto&sort=name&order=asc
  // Case-insensitive match over the seeded assets' name, key and symbol.
  // Optional ?type= filters to a specific asset type (e.g. crypto, stock).
  // Optional ?sort= (name|symbol) and ?order= (asc|desc) control ordering.
  const ALLOWED_TYPES = new Set(['crypto', 'stock']);
  const ALLOWED_SORT_FIELDS = new Set(['name', 'symbol']);
  const ALLOWED_ORDERS = new Set(['asc', 'desc']);

  const search = async (req, res) => {
    const q = (req.query.q || '').trim();
    const typeFilter = (req.query.type || '').trim().toLowerCase();
    const sortField = (req.query.sort || 'name').trim().toLowerCase();
    const sortOrder = (req.query.order || 'asc').trim().toLowerCase();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 10));
    if (q.length > 100) {
      return res.status(400).json({ error: 'Search query is too long' });
    }
    try {
      const where = {};
      if (q) {
        where[Op.or] = [
          { name: { [Op.iLike]: `%${q}%` } },
          { key: { [Op.iLike]: `%${q}%` } },
          { symbol: { [Op.iLike]: `%${q}%` } },
        ];
      }
      if (typeFilter && ALLOWED_TYPES.has(typeFilter)) {
        where.type = typeFilter;
      }
      const resolvedSort = ALLOWED_SORT_FIELDS.has(sortField) ? sortField : 'name';
      const resolvedOrder = ALLOWED_ORDERS.has(sortOrder) ? sortOrder.toUpperCase() : 'ASC';
      const { count, rows } = await assetModel.findAndCountAll({
        where,
        attributes: ['key', 'type', 'name', 'symbol'],
        order: [[resolvedSort, resolvedOrder]],
        limit,
        offset: (page - 1) * limit,
      });
      const results = rows.map((a) => ({
        key: a.key, name: a.name, type: a.type, symbol: a.symbol,
      }));
      return res.json({ results, total: count, page, totalPages: Math.ceil(count / limit) });
    } catch (err) {
      console.error('[SYMBOLS] search failed:', err.message);
      return res.status(500).json({ error: 'Server error' });
    }
  };

  // GET /api/symbols/:symbol/history?interval=5m
  const history = async (req, res) => {
    const { symbol } = req.params;
    const intervalKey = req.query.interval || '5m';
    const mapping = HISTORY_RANGES[intervalKey];
    if (!mapping) {
      return res.status(400).json({
        error: `Unsupported interval. Use one of: ${Object.keys(HISTORY_RANGES).join(', ')}`,
      });
    }
    try {
      const { symbol: resolved, currency, candles } = await fetchCandles(symbol, intervalKey);
      return res.json({
        symbol: resolved,
        currency,
        interval: intervalKey,
        count: candles.length,
        candles,
      });
    } catch (err) {
      console.error('[SYMBOLS] history failed:', err.message);
      return res.status(502).json({ error: 'History fetch failed' });
    }
  };

  return { search, history };
};

module.exports = { createSymbolsController };
