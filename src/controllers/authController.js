import User from '../models/user.js';
import jwt from 'jsonwebtoken';
import solanaUtils from '../utils/solana.js';
import { decryptWalletSecret, encryptWalletSecret } from '../middleware/auth.js';
import PasswordResetToken from '../models/passwordState.js';
import VerificationToken from '../models/verificationState.js';
import { sendPasswordResetEmail } from '../utils/emailService.js';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import ElectionState from '../models/electionState.js';
import dotenv from 'dotenv'
import { sendVerificationEmail } from '../utils/emailVerification.js';

dotenv.config()

// Register a new user
export const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }]
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        message: 'User with this email or username already exists' 
      });
    }
    
    // Generate a Solana wallet for the user
    const wallet = solanaUtils.generateWallet();
    
    // Create a new user
    const user = new User({
      username,
      email,
      password,
      walletPublicKey: wallet.publicKey,
      walletSecretKey: encryptWalletSecret(wallet.secretKey),
      isAdmin: false, // Regular users by default
      isVerified: false
    });
    
    await user.save();

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Create verification token document
    const verification = new VerificationToken({
      user: user._id,
      token: verificationToken
    });

    await verification.save();

    // Send verification email
    await sendVerificationEmail(user, verificationToken);

    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id }, 
      process.env.JWT_SECRET, 
      { expiresIn: '24h' }
    );
    
    res.status(201).json({
      message: 'Registration successful. Please check your email to verify your account.',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        walletPublicKey: user.walletPublicKey,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Error registering user', error: error.message });
  }
};

// Register a new admin
export const registerAdmin = async (req, res) => {
  try {
    const { username, email, password, adminSecret } = req.body;
    
    // Add additional layer of security with admin secret
    if (adminSecret !== process.env.ADMIN_SECRET) {
      return res.status(403).json({ message: 'Invalid admin secret' });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }]
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        message: 'User with this email or username already exists' 
      });
    }
    
    // Generate a Solana wallet for the admin
    const wallet = solanaUtils.generateWallet();
    
    // Create a new admin user
    const user = new User({
      username,
      email,
      password,
      walletPublicKey: wallet.publicKey,
      walletSecretKey: encryptWalletSecret(wallet.secretKey),
      isAdmin: true,
      isVerified: false
    });
    
    await user.save();

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Create verification token document
    const verification = new VerificationToken({
      user: user._id,
      token: verificationToken
    });

    await verification.save();

    // Send verification email
    await sendVerificationEmail(user, verificationToken);
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id }, 
      process.env.JWT_SECRET, 
      { expiresIn: '24h' }
    );
    
    res.status(201).json({
      message: 'Admin registered successfully, please check your email to verify your account.',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        walletPublicKey: user.walletPublicKey,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    console.error('Admin registration error:', error);
    res.status(500).json({ message: 'Error registering admin', error: error.message });
  }
};

// Login user
export const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    // Find user by username or email
    const user = await User.findOne({ $or: [{ username: identifier }, { email: identifier.toString().toLowerCase().trim() }] });

    if (!user) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    // Check if email is verified
    if (!user.isVerified) {
      return res.status(403).json({ 
        message: 'Please verify your email before logging in' 
      });
    }
    
    // Check password
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id }, 
      process.env.JWT_SECRET, 
      { expiresIn: '24h' }
    );

    // --- AIRDROP LOGIC START ---
    // Check for active election
    const activeElection = await ElectionState.findOne({ isActive: true });
    if (activeElection && user.walletPublicKey) {
      // Find the admin (assuming only one admin)
      const admin = await User.findOne({ isAdmin: true });
      if (admin && admin.walletSecretKey) {
        const adminSecretKey = decryptWalletSecret(admin.walletSecretKey);
        // Send airdrop (e.g., 0.0021 SOL)
        await solanaUtils.sendSolToWallet(adminSecretKey, user.walletPublicKey, 0.0021);
      }
    }
    // --- AIRDROP LOGIC END ---

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        walletPublicKey: user.walletPublicKey,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Error during login', error: error.message });
  }
};

// Get current user profile
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password -walletSecretKey');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.status(200).json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ message: 'Error fetching profile', error: error.message });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    // Find user by email
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Generate a unique reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Create a password reset token document
    const passwordResetToken = new PasswordResetToken({
      user: user._id,
      token: resetToken,
      expiresAt: new Date(Date.now() + 3600000) // 1 hour from now
    });
    
    await passwordResetToken.save();
    
    // Construct reset password link
    const resetLink = `${process.env.FRONTEND_URL}/create-new-password?token=${resetToken}`;
    
    // Send email with reset link
    await sendPasswordResetEmail(user.email, resetLink);
    
    res.status(200).json({ 
      message: 'Password reset link sent to your email' 
    });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error processing forgot password request',
      error: error.message 
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    
    // Find valid reset token
    const passwordResetToken = await PasswordResetToken.findOne({
      token,
      expiresAt: { $gt: new Date() }
    });
    
    if (!passwordResetToken) {
      return res.status(400).json({ 
        message: 'Invalid or expired reset token' 
      });
    }
    
    // Find the user
    const user = await User.findById(passwordResetToken.user);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = newPassword;
    
    // Save new password
    await user.save();
    
    // Delete used reset token
    await PasswordResetToken.deleteOne({ _id: passwordResetToken._id });
    
    res.status(200).json({ message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ 
      message: 'Error resetting password',
      error: error.message 
    });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;

    // Find verification token
    const verificationToken = await VerificationToken.findOne({ token });

    if (!verificationToken) {
      return res.status(400).json({ 
        message: 'Invalid or expired verification token' 
      });
    }

    // Find user
    const user = await User.findById(verificationToken.user);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Mark user as verified
    user.isVerified = true;
    await user.save();

    // Remove verification token
    await VerificationToken.deleteOne({ _id: verificationToken._id });

    res.status(200).json({ 
      message: 'Email verified successfully' 
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ 
      message: 'Error verifying email', 
      error: error.message 
    });
  }
};

export const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email input
    if (!email) {
      return res.status(400).json({ 
        message: 'Email is required' 
      });
    }

    console.log('Attempting to resend verification for email:', email);

    // Find user by email - make sure email exists before calling toLowerCase
    const user = await User.findOne({ 
      email: email.toString().toLowerCase().trim() 
    });
    
    if (!user) {
      console.log('No user found with email:', email);
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('Found user:', { id: user._id, email: user.email });

    if (user.isVerified) {
      return res.status(400).json({ message: 'Email is already verified' });
    }

    // Delete any existing verification tokens for this user
    await VerificationToken.deleteMany({ user: user._id });

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Create new verification token document
    const verification = new VerificationToken({
      user: user._id,
      token: verificationToken
    });

    await verification.save();
    console.log('Created new verification token');

    // Send new verification email
    await sendVerificationEmail(user, verificationToken);
    console.log('Sent verification email');

    res.status(200).json({
      message: 'Verification email has been resent successfully'
    });

  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ 
      message: 'Error resending verification email', 
      error: error.message 
    });
  }
};