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

	const configuredOrigins = (process.env.CORS_ORIGINS || '')
		.split(',')
		.map((origin) => origin.trim())
		.filter(Boolean);

	app.use(cors({
		origin: (origin, callback) => {
			if (!origin || configuredOrigins.includes(origin)) {
				return callback(null, true);
			}
			return callback(null, false);
		},
		credentials: true,
		allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
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
