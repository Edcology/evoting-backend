import crypto from 'crypto';
import nodemailer from 'nodemailer';

export const sendVerificationEmail = async (user, verificationToken) => {
  // Create a verification link
  const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

  // Configure email transporter
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  // Email options
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: user.email,
    subject: 'Verify Your Email',
    html: `
      <h1>Email Verification</h1>
      <p>Click the link below to verify your email:</p>
      <a href="${verificationLink}">Verify Email</a>
      <p>This link will expire in 1 hour.</p>
      <p>If you did not create an account, please ignore this email.</p>
    `
  };

  // Send email
  await transporter.sendMail(mailOptions);
};