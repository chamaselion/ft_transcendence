const express = require('express');
const { createAuthController } = require('../controllers/authController');

const { register, login } = createAuthController();

const router = express.Router();

router.post('/register', register);
router.post('/login', login);

module.exports = router;
