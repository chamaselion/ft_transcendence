const express = require('express');
const cors = require('cors');

const createApp = ({ router } = {}) => {
	const app = express();

	app.use(cors({
		origin: (origin, callback) => {
			console.log(`[CORS] origin request from: ${origin}`);
			callback(null, true);
		},
		credentials: true,
		allowedHeaders: ['Content-Type', 'Authorization'],
		methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
	}));
	app.use(express.json());

	app.get('/health', (req, res) => res.json({ status: 'ok' }));

	if (router) {
		app.use('/api', router);
	}

	return app;
};

module.exports = { createApp };
