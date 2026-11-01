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


const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildEmailHtml = ({ subject, text }) => {
  const paragraphs = String(text ?? '')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #334155;">${escapeHtml(
          paragraph,
        ).replace(/\n/g, '<br />')}</p>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin: 0; padding: 24px; background: #f1f5f9; color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; border-collapse: collapse; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <tr>
              <td style="padding: 24px 28px; background: #0f172a; color: #ffffff;">
                <div style="font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.8;">Trans Edit</div>
                <h1 style="margin: 8px 0 0 0; font-size: 22px; line-height: 1.3;">${escapeHtml(subject)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding: 28px;">${paragraphs}</td>
            </tr>
            <tr>
              <td style="padding: 16px 28px 24px 28px; border-top: 1px solid #e2e8f0; font-size: 12px; line-height: 1.5; color: #64748b;">
                This message was sent by Trans Edit. If you did not expect it, you can safely ignore it.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

const createEmailService = ({ fromAddress = process.env.EMAIL_FROM || process.env.SMTP_USER || 'no-reply@transcendence.local' } = {}) => {
  const { transportMode, transporter } = buildTransport();

  const sendEmail = async ({ to, subject, text, html: _html }) => {
    const finalText = String(text ?? '');
    const info = await transporter.sendMail({
      from: fromAddress,
      to,
      subject,
      text: finalText,
      html: buildEmailHtml({ subject, text: finalText }),
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

module.exports = { createEmailService, buildEmailHtml };