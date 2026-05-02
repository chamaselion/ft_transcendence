const express = require('express');
const cors = require('cors');

const createApp = ({ router } = {}) => {
	const app = express();

	app.use(cors());
	app.use(express.json());

	app.get('/health', (req, res) => res.json({ status: 'ok' }));

	if (router) {
		app.use('/api', router);
	}

	return app;
};

module.exports = { createApp };
