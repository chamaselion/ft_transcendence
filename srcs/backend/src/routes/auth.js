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
const { createDataRequestHandler } = require('../controllers/gdpr/dataRequest');
const { createDataExportHandler } = require('../controllers/gdpr/dataExport');
const { createDataExportCsvHandler } = require('../controllers/gdpr/dataExportCsv');
const { createDataDeletionRequestHandler } = require('../controllers/gdpr/dataDeletionRequest');
const { createDataDeletionConfirmHandler } = require('../controllers/gdpr/dataDeletionConfirm');
// const { createDevFillDataHandler } = require('../controllers/auth/devFillData');
const { createRateLimiter, getClientIp, normalizeIdentity } = require('../middleware/rateLimit');

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
const { dataRequest } = createDataRequestHandler();
const { dataExport } = createDataExportHandler();
const { dataExportCsv } = createDataExportCsvHandler();
const { dataDeletionRequest } = createDataDeletionRequestHandler();
const { dataDeletionConfirm } = createDataDeletionConfirmHandler();
// const { fillData } = createDevFillDataHandler();

const router = express.Router();

const authRequestLimiter = createRateLimiter({
	name: 'auth-request',
	windowMs: 60 * 1000,
	maxRequests: 30,
	keyGenerator: (req) => getClientIp(req),
});

const otpIssueLimiter = createRateLimiter({
	name: 'otp-issue',
	windowMs: 10 * 60 * 1000,
	maxRequests: 5,
	keyGenerator: (req) => `${getClientIp(req)}:${normalizeIdentity(req.body?.email)}`,
});

const otpVerifyLimiter = createRateLimiter({
	name: 'otp-verify',
	windowMs: 10 * 60 * 1000,
	maxRequests: 12,
	keyGenerator: (req) => {
		const challengeId = normalizeIdentity(req.body?.challengeId || req.body?.confirmationId);
		const email = normalizeIdentity(req.body?.email);
		return `${getClientIp(req)}:${challengeId}:${email}`;
	},
});

router.post('/register', authRequestLimiter, register);
router.post('/password-reset/request', authRequestLimiter, otpIssueLimiter, passwordResetRequest);
router.post('/password-reset/confirm', authRequestLimiter, otpVerifyLimiter, passwordResetConfirm);
router.post('/login', authRequestLimiter, otpIssueLimiter, login);
router.post('/login/confirm', authRequestLimiter, otpVerifyLimiter, loginConfirm);
router.post('/logout', logout);
router.get('/me', me);
router.patch('/me', authRequestLimiter, otpIssueLimiter, updateMe);
router.post('/me/update/confirm', authRequestLimiter, otpVerifyLimiter, updateMeConfirm);
// router.get('/sessions', listSessions);
router.post('/me/data-request', dataRequest);
router.get('/me/data-export', dataExport);
router.get('/me/data-export/csv', dataExportCsv);
router.post('/me/data-deletion/request', authRequestLimiter, otpIssueLimiter, dataDeletionRequest);
router.post('/me/data-deletion/confirm', authRequestLimiter, otpVerifyLimiter, dataDeletionConfirm);
// router.post('/me/dev/fill-data', fillData);

module.exports = router;
