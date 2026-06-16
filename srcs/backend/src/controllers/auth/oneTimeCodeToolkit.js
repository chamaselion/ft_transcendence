const { createEmailService } = require('../../services/emailService');
const { createOneTimeCodeService } = require('../../services/oneTimeCodeService');

const emailService = createEmailService();
const oneTimeCodeService = createOneTimeCodeService({ emailService });

module.exports = {
  emailService,
  oneTimeCodeService,
};
