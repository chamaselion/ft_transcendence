const express = require('express');
const cors = require('cors');

const createApp = ({ router } = {}) => {
	const app = express();

	// Behind WAF + reverse proxy chain; trust forwarded headers for accurate client IP.
	app.set('trust proxy', true);

	app.use((req, res, next) => {
		res.setHeader('X-Content-Type-Options', 'nosniff');
		res.setHeader('X-Frame-Options', 'DENY');
		res.setHeader('Referrer-Policy', 'no-referrer');
		next();
	});

	app.use(cors({
		origin: (origin, callback) => {
			console.log(`[CORS] origin request from: ${origin}`);
			// Backend is only reachable through WAF; all requests go through single entry point
			return callback(null, true);
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
