const express = require('express');
const { createAuthController } = require('../controllers/authController');

const { register, login, me } = createAuthController();

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', me);

module.exports = router;
