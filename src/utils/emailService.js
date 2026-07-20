import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendPasswordResetEmail = async (email, resetLink) => {
  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Password Reset',
    html: `
      <p>You requested a password reset</p>
      <p>Click the link below to reset your password:</p>
      <a href="${resetLink}">Reset Password</a>
      <p>This link will expire in 1 hour</p>
    `,
  });

  if (error) {
    throw new Error(`Resend failed: ${error.message}`);
  }

  return data;
};