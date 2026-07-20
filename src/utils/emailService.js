import { sendEmail } from './gmailClient.js';

export const sendPasswordResetEmail = async (email, resetLink) => {
  await sendEmail({
    to: email,
    subject: 'Password Reset',
    html: `
      <p>You requested a password reset</p>
      <p>Click the link below to reset your password:</p>
      <a href="${resetLink}">Reset Password</a>
      <p>This link will expire in 1 hour</p>
    `,
  });
};