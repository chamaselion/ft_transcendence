const express = require('express');
const { createDocumentsController } = require('../controllers/documents/documentsController');
const { createRequireAuth } = require('../middleware/requireAuth');

const { requireAuth } = createRequireAuth();
const { create, list, get, update, remove } = createDocumentsController();

const router = express.Router();

// Every document route requires an authenticated user.
router.use(requireAuth);

router.post('/', create);
router.get('/', list);
router.get('/:id', get);
router.patch('/:id', update);
router.delete('/:id', remove);

module.exports = router;
