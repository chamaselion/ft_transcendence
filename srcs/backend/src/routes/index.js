const express = require('express');
const auth = require('./auth');
const documents = require('./documents');
const users = require('./users');
const ai = require('./ai');

const router = express.Router();

router.use('/auth', auth);
router.use('/documents', documents);
router.use('/users', users);
router.use('/ai', ai);

module.exports = router;

