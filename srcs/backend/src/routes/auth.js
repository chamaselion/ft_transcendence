const express = require('express');
const { createLoginHandler } = require('../controllers/auth/login');
const { createRegisterHandler } = require('../controllers/auth/register');
const { createMeHandler } = require('../controllers/auth/me');
const { createLogoutHandler } = require('../controllers/auth/logout');
const { createListSessionsHandler } = require('../controllers/auth/listSessions');

const { login } = createLoginHandler();
const { register } = createRegisterHandler();
const { me } = createMeHandler();
const { logout } = createLogoutHandler();
const { listSessions } = createListSessionsHandler();

const router = express.Router();

router.post('/register', register);
router.post('/register/confirm', confirmRegistration);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', me);
router.get('/sessions', listSessions);

module.exports = router;
