import brevo from '@getbrevo/brevo';
import dotenv from 'dotenv';

dotenv.config();

const apiInstance = new brevo.TransactionalEmailsApi();
apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY);

export const sendPasswordResetEmail = async (email, resetLink) => {
  const sendSmtpEmail = new brevo.SendSmtpEmail();
  sendSmtpEmail.subject = 'Password Reset';
  sendSmtpEmail.htmlContent = `
    <p>You requested a password reset</p>
    <p>Click the link below to reset your password:</p>
    <a href="${resetLink}">Reset Password</a>
    <p>This link will expire in 1 hour</p>
  `;
  sendSmtpEmail.sender = { name: 'Your App', email: process.env.EMAIL_FROM };
  sendSmtpEmail.to = [{ email }];

  try {
    return await apiInstance.sendTransacEmail(sendSmtpEmail);
  } catch (error) {
    throw new Error(`Brevo failed: ${error.message}`);
  }
};