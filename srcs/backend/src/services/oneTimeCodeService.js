const bcrypt = require('bcrypt');
const { randomInt, randomUUID } = require('crypto');
const { requireNumberEnv } = require('../config');

const CODE_HASH_ROUNDS = requireNumberEnv('BCRYPT_SALT_ROUNDS');

const normalizeRecipient = (value) => String(value || '').trim().toLowerCase();
const normalizeCode = (value) => String(value || '').trim();
const buildPurposeLabel = (purpose) => String(purpose || 'confirmation').replace(/[-_]+/g, ' ');

const defaultTextBuilder = ({ code, purposeLabel, expiresInMinutes, attemptsRemaining }) => (
  [
    `Your ${purposeLabel} code is ${code}.`,
    `It expires in ${expiresInMinutes} minute(s).`,
    `You have ${attemptsRemaining} attempt(s) to enter it correctly.`,
  ].join(' ')
);

const createOneTimeCodeService = ({
  emailService,
  codeLength = Number(process.env.ONE_TIME_CODE_LENGTH) || 6,
  maxAttempts = Number(process.env.ONE_TIME_CODE_MAX_ATTEMPTS) || 3,
  ttlMs = Number(process.env.ONE_TIME_CODE_TTL_MS) || 10 * 60 * 1000,
} = {}) => {
  if (!emailService) {
    throw new Error('createOneTimeCodeService requires an emailService');
  }

  const pendingChallenges = new Map();

  const cleanupExpiredChallenges = () => {
    const now = Date.now();

    for (const [challengeId, challenge] of pendingChallenges.entries()) {
      if (challenge.expiresAt <= now) {
        pendingChallenges.delete(challengeId);
      }
    }
  };

  const buildCode = () => randomInt(0, 10 ** codeLength).toString().padStart(codeLength, '0');

  const issueChallenge = async ({
    purpose,
    recipient,
    subject,
    textBuilder,
    htmlBuilder,
    payload = {},
  }) => {
    cleanupExpiredChallenges();

    const challengeId = randomUUID();
    const code = buildCode();
    const expiresAt = Date.now() + ttlMs;
    const codeHash = await bcrypt.hash(code, CODE_HASH_ROUNDS);
    const normalizedRecipient = normalizeRecipient(recipient);

    pendingChallenges.set(challengeId, {
      challengeId,
      purpose,
      recipient: normalizedRecipient,
      codeHash,
      payload,
      attemptsRemaining: maxAttempts,
      expiresAt,
      createdAt: new Date().toISOString(),
    });

    const context = {
      code,
      purpose,
      purposeLabel: buildPurposeLabel(purpose),
      recipient: normalizedRecipient,
      expiresAt,
      expiresInMinutes: Math.max(1, Math.ceil(ttlMs / 60000)),
      attemptsRemaining: maxAttempts,
    };

    await emailService.sendEmail({
      to: recipient,
      subject: subject || `Your ${context.purposeLabel} code`,
      text: textBuilder ? textBuilder(context) : defaultTextBuilder(context),
      html: htmlBuilder ? htmlBuilder(context) : undefined,
    });

    return {
      challengeId,
      expiresAt,
      attemptsRemaining: maxAttempts,
      codeLength,
      debugCode: emailService.transportMode === 'console' ? code : undefined,
    };
  };

  const verifyChallenge = async ({ challengeId, recipient, purpose, code }) => {
    cleanupExpiredChallenges();

    const challenge = pendingChallenges.get(challengeId);

    if (!challenge) {
      return {
        ok: false,
        statusCode: 410,
        error: 'Confirmation code expired or was not found',
      };
    }

    if (challenge.purpose !== purpose) {
      return {
        ok: false,
        statusCode: 400,
        error: 'Confirmation code purpose mismatch',
      };
    }

    if (challenge.recipient !== normalizeRecipient(recipient)) {
      return {
        ok: false,
        statusCode: 400,
        error: 'Confirmation code recipient mismatch',
      };
    }

    if (challenge.expiresAt <= Date.now()) {
      pendingChallenges.delete(challengeId);
      return {
        ok: false,
        statusCode: 410,
        error: 'Confirmation code expired',
      };
    }

    const isMatch = await bcrypt.compare(normalizeCode(code), challenge.codeHash);

    if (!isMatch) {
      challenge.attemptsRemaining -= 1;

      if (challenge.attemptsRemaining <= 0) {
        pendingChallenges.delete(challengeId);
        return {
          ok: false,
          statusCode: 401,
          error: 'Invalid code. Registration cancelled after 3 failed attempts.',
          attemptsRemaining: 0,
        };
      }

      pendingChallenges.set(challengeId, challenge);
      return {
        ok: false,
        statusCode: 401,
        error: `Invalid code. ${challenge.attemptsRemaining} attempt(s) remaining.`,
        attemptsRemaining: challenge.attemptsRemaining,
      };
    }

    pendingChallenges.delete(challengeId);
    return {
      ok: true,
      payload: challenge.payload,
    };
  };

  setInterval(cleanupExpiredChallenges, 60_000).unref?.();

  return {
    issueChallenge,
    verifyChallenge,
    cleanupExpiredChallenges,
  };
};

module.exports = { createOneTimeCodeService };