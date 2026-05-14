const express = require('express');
const { createAuthController } = require('../controllers/authController');

const { register, login, me, logout, listSessions } = createAuthController();

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', me);
router.get('/sessions', listSessions);

module.exports = router;
