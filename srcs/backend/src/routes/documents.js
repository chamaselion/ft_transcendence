const express = require('express');
const { createCreateDocumentHandler } = require('../controllers/documents/create');
const { createListDocumentsHandler } = require('../controllers/documents/list');
const { createGetDocumentHandler } = require('../controllers/documents/get');
const { createUpdateDocumentHandler } = require('../controllers/documents/update');
const { createDeleteDocumentHandler } = require('../controllers/documents/remove');
const { createListSharesHandler } = require('../controllers/shares/list');
const { createCreateShareHandler } = require('../controllers/shares/create');
const { createUpdateShareHandler } = require('../controllers/shares/update');
const { createDeleteShareHandler } = require('../controllers/shares/remove');
const { createRequireAuth } = require('../middleware/requireAuth');
const { createRateLimiter, getClientIp } = require('../middleware/rateLimit');

const { requireAuth } = createRequireAuth();
const { createDocument } = createCreateDocumentHandler();
const { listDocuments } = createListDocumentsHandler();
const { getDocument } = createGetDocumentHandler();
const { updateDocument } = createUpdateDocumentHandler();
const { deleteDocument } = createDeleteDocumentHandler();
const { listShares } = createListSharesHandler();
const { createShare } = createCreateShareHandler();
const { updateShare } = createUpdateShareHandler();
const { deleteShare } = createDeleteShareHandler();

const router = express.Router();

// Every document route requires an authenticated user.
router.use(requireAuth);

router.post('/', createDocument);
router.get('/', listDocuments);
router.get('/:id', getDocument);
router.patch('/:id', updateDocument);
router.delete('/:id', deleteDocument);


const shareLimiter = createRateLimiter({
  name: 'document-shares',
  windowMs: 60 * 1000,
  maxRequests: 60,
  keyGenerator: (req) => req.user?.id || getClientIp(req),
});

router.get('/:id/shares', shareLimiter, listShares);
router.post('/:id/shares', shareLimiter, createShare);
router.patch('/:id/shares/:userId', shareLimiter, updateShare);
router.delete('/:id/shares/:userId', shareLimiter, deleteShare);

module.exports = router;
