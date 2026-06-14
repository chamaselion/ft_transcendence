const nodemailer = require('nodemailer');

const buildTransport = () => {
  const transportMode = (process.env.EMAIL_TRANSPORT || (process.env.SMTP_HOST ? 'smtp' : 'console')).toLowerCase();

  if (transportMode === 'console') {
    return {
      transportMode,
      transporter: nodemailer.createTransport({
        streamTransport: true,
        newline: 'unix',
        buffer: true,
      }),
    };
  }

  const smtpHost = process.env.SMTP_HOST;
  if (!smtpHost) {
    throw new Error('Missing required environment variable: SMTP_HOST');
  }

  const smtpPort = Number(process.env.SMTP_PORT);
  if (Number.isNaN(smtpPort)) {
    throw new Error('Environment variable SMTP_PORT must be a number');
  }

  const smtpOptions = {
    host: smtpHost,
    port: smtpPort,
    secure: String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
  };

  if (process.env.SMTP_USER || process.env.SMTP_PASS) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      throw new Error('SMTP_USER and SMTP_PASS must both be set when SMTP authentication is enabled');
    }

    smtpOptions.auth = {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    };
  }

  return {
    transportMode,
    transporter: nodemailer.createTransport(smtpOptions),
  };
};

const createEmailService = ({ fromAddress = process.env.EMAIL_FROM || process.env.SMTP_USER || 'no-reply@transcendence.local' } = {}) => {
  const { transportMode, transporter } = buildTransport();

  const sendEmail = async ({ to, subject, text, html }) => {
    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      text,
      html,
    });

    if (transportMode === 'console' && info.message) {
      console.log('[EMAIL PREVIEW]');
      console.log(info.message.toString());
    }

    return info;
  };

  return {
    transportMode,
    sendEmail,
  };
};

module.exports = { createEmailService };