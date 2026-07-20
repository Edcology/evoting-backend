import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendVerificationEmail = async (user, verificationToken) => {
  const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: 'Verify Your Email',
    html: `
      <h1>Email Verification</h1>
      <p>Click the link below to verify your email:</p>
      <a href="${verificationLink}">Verify Email</a>
      <p>This link will expire in 1 hour.</p>
      <p>If you did not create an account, please ignore this email.</p>
    `,
  });

  if (error) {
    // Throw so the caller's try/catch in registerAdmin can handle it
    throw new Error(`Resend failed: ${error.message}`);
  }

  return data;
};