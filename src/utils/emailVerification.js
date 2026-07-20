import { TransactionalEmailsApi, TransactionalEmailsApiApiKeys, SendSmtpEmail } from '@getbrevo/brevo';
import dotenv from 'dotenv';

dotenv.config();

const apiInstance = new TransactionalEmailsApi();
apiInstance.setApiKey(TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

export const sendVerificationEmail = async (user, verificationToken) => {
  const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

  const sendSmtpEmail = new SendSmtpEmail();
  sendSmtpEmail.subject = 'Verify Your Email';
  sendSmtpEmail.htmlContent = `
    <h1>Email Verification</h1>
    <p>Click the link below to verify your email:</p>
    <a href="${verificationLink}">Verify Email</a>
    <p>This link will expire in 1 hour.</p>
    <p>If you did not create an account, please ignore this email.</p>
  `;
  sendSmtpEmail.sender = { name: 'Your App', email: process.env.EMAIL_FROM };
  sendSmtpEmail.to = [{ email: user.email }];

  try {
    return await apiInstance.sendTransacEmail(sendSmtpEmail);
  } catch (error) {
    throw new Error(`Brevo failed: ${error.message}`);
  }
};