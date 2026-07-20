import { BrevoClient } from '@getbrevo/brevo';
import dotenv from 'dotenv';

dotenv.config();

const brevo = new BrevoClient({
  apiKey: process.env.BREVO_API_KEY,
});

export const sendPasswordResetEmail = async (email, resetLink) => {
  try {
    return await brevo.transactionalEmails.sendTransacEmail({
      subject: 'Password Reset',
      htmlContent: `
        <p>You requested a password reset</p>
        <p>Click the link below to reset your password:</p>
        <a href="${resetLink}">Reset Password</a>
        <p>This link will expire in 1 hour</p>
      `,
      sender: { name: 'Your App', email: process.env.EMAIL_FROM },
      to: [{ email }],
    });
  } catch (error) {
    throw new Error(`Brevo failed: ${error.message}`);
  }
};