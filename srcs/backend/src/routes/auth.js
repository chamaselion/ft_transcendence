const express = require('express');
const { createLoginHandler } = require('../controllers/auth/login');
const { createRegisterHandler } = require('../controllers/auth/register');
const { createPasswordResetRequestHandler } = require('../controllers/auth/passwordResetRequest');
const { createPasswordResetConfirmHandler } = require('../controllers/auth/passwordResetConfirm');
const { createLoginHandler } = require('../controllers/auth/login');
const { createLoginConfirmHandler } = require('../controllers/auth/loginConfirm');
const { createMeHandler } = require('../controllers/auth/me');
const { createUpdateMeHandler } = require('../controllers/auth/updateMe');
const { createUpdateMeConfirmHandler } = require('../controllers/auth/updateMeConfirm');
const { createLogoutHandler } = require('../controllers/auth/logout');
const { createListSessionsHandler } = require('../controllers/auth/listSessions');

const { login } = createLoginHandler();
const { register } = createRegisterHandler();
const { passwordResetRequest } = createPasswordResetRequestHandler();
const { passwordResetConfirm } = createPasswordResetConfirmHandler();
const { login } = createLoginHandler();
const { loginConfirm } = createLoginConfirmHandler();
const { me } = createMeHandler();
const { updateMe } = createUpdateMeHandler();
const { updateMeConfirm } = createUpdateMeConfirmHandler();
const { logout } = createLogoutHandler();
const { listSessions } = createListSessionsHandler();

const router = express.Router();

router.post('/register', register);
router.post('/password-reset/request', passwordResetRequest);
router.post('/password-reset/confirm', passwordResetConfirm);
router.post('/login', login);
router.post('/login/confirm', loginConfirm);
router.post('/logout', logout);
router.get('/me', me);
router.patch('/me', updateMe);
router.post('/me/update/confirm', updateMeConfirm);
router.get('/sessions', listSessions);

module.exports = router;
