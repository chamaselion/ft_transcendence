const express = require('express');
const auth = require('./auth');
const documents = require('./documents');
const users = require('./users');

const router = express.Router();

router.use('/auth', auth);
router.use('/documents', documents);
router.use('/users', users);

module.exports = router;
