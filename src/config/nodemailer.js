const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const ses = new SESClient({
  region: process.env.SES_REGION,
  credentials: {
    accessKeyId: process.env.SES_KEY_ID,
    secretAccessKey: process.env.SES_ACCESS_KEY
  }
});

exports.sendEmail = async (to, subject, html) => {
  const command = new SendEmailCommand({
    Destination: {
      ToAddresses: [to]
    },
    Message: {
      Body: {
        Html: {
          Data: html
        }
      },

      Subject: {
        Data: subject
      }
    },
    Source: 'no-reply@foxydls.com.au'
  });

  await ses.send(command);
};