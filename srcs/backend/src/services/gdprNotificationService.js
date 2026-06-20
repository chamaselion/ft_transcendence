const { createEmailService } = require('./emailService');

const defaultEmailService = createEmailService();

const operationTemplates = {
  dataRequest: {
    subject: 'Your data request has been confirmed',
    title: 'Data request confirmed',
    intro: 'We have confirmed your request for a readable copy of your personal data.',
    nextSteps: [
      'We will prepare the export in a readable format.',
      'You will receive a follow-up message when the export is ready.',
    ],
  },
  dataExport: {
    subject: 'Your data export has been confirmed',
    title: 'Data export confirmed',
    intro: 'We have confirmed your request to export your personal data.',
    nextSteps: [
      'We will prepare the export using the requested readable format.',
      'You will receive a follow-up message when the export is ready.',
    ],
  },
  dataDeletion: {
    subject: 'Your data has been deleted',
    title: 'Data deletion completed',
    intro: 'We have completed the deletion of your personal data.',
    nextSteps: [
      'The backend has removed the data that was eligible for deletion.',
      'If you need additional help, you can contact support.',
    ],
  },
};

const buildTextBody = ({ title, intro, nextSteps, reference }) => {
  const lines = [
    title,
    '',
    intro,
  ];

  if (reference) {
    lines.push('', `Reference: ${reference}`);
  }

  if (nextSteps && nextSteps.length) {
    lines.push('', 'Next steps:');
    nextSteps.forEach((step) => {
      lines.push(`- ${step}`);
    });
  }

  lines.push('', 'If you did not expect this email, you can ignore it or contact support.');

  return lines.join('\n');
};

const createGdprNotificationService = ({ emailService = defaultEmailService } = {}) => {
  const sendOperationConfirmation = async ({ to, operation, reference }) => {
    if (!to) {
      throw new Error('Missing required recipient email');
    }

    const template = operationTemplates[operation];
    if (!template) {
      throw new Error(`Unsupported GDPR notification operation: ${operation}`);
    }

    return emailService.sendEmail({
      to,
      subject: template.subject,
      text: buildTextBody({
        title: template.title,
        intro: template.intro,
        nextSteps: template.nextSteps,
        reference,
      }),
    });
  };

  return {
    sendDataRequestConfirmation: ({ to, reference } = {}) => sendOperationConfirmation({
      to,
      operation: 'dataRequest',
      reference,
    }),
    sendDataExportConfirmation: ({ to, reference } = {}) => sendOperationConfirmation({
      to,
      operation: 'dataExport',
      reference,
    }),
    sendDataDeletionConfirmation: ({ to, reference } = {}) => sendOperationConfirmation({
      to,
      operation: 'dataDeletion',
      reference,
    }),
  };
};

module.exports = { createGdprNotificationService };