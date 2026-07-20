import { BrevoClient } from '@getbrevo/brevo';
import dotenv from 'dotenv';

dotenv.config();

const brevo = new BrevoClient({
  apiKey: process.env.BREVO_API_KEY,
});

export const sendVerificationEmail = async (user, verificationToken) => {
  const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

  try {
    return await brevo.transactionalEmails.sendTransacEmail({
      subject: 'Verify Your Email',
      htmlContent: `
        <h1>Email Verification</h1>
        <p>Click the link below to verify your email:</p>
        <a href="${verificationLink}">Verify Email</a>
        <p>This link will expire in 1 hour.</p>
        <p>If you did not create an account, please ignore this email.</p>
      `,
      sender: { name: 'Your App', email: process.env.EMAIL_FROM },
      to: [{ email: user.email }],
    });
  } catch (error) {
    throw new Error(`Brevo failed: ${error.message}`);
  }
};