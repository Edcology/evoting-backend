import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const oAuth2Client = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  'https://developers.google.com/oauthplayground'
);

oAuth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });

export const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

// Builds a raw base64url-encoded MIME email — Gmail API requires this format
const buildMessage = ({ to, subject, html }) => {
  const messageParts = [
    `From: ${process.env.GMAIL_USER}`,
    `To: ${to}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${subject}`,
    '',
    html,
  ];
  const message = messageParts.join('\n');

  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

export const sendEmail = async ({ to, subject, html }) => {
  const raw = buildMessage({ to, subject, html });

  try {
    return await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });
  } catch (error) {
    throw new Error(`Gmail API failed: ${error.message}`);
  }
};