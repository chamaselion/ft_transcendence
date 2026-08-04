const express = require('express');
const auth = require('./auth');
const documents = require('./documents');

const router = express.Router();

router.use('/auth', auth);
router.use('/documents', documents);

module.exports = router;
