import User from '../models/user.js';
import solanaUtils from '../utils/solana.js';
import { decryptWalletSecret } from '../middleware/auth.js';

// POST /api/airdrop/all
export const airdropToAllUsers = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    // Get all users with a wallet address
    const users = await User.find({ walletPublicKey: { $exists: true, $ne: null }, walletSecretKey: { $exists: true, $ne: null } });

    // Exclude admin's own wallet address
    const adminWallet = String(admin.walletPublicKey).trim();
    const userWallets = users.filter(u => String(u.walletPublicKey).trim() && String(u.walletPublicKey).trim() !== adminWallet);

    if (userWallets.length === 0) {
      return res.status(400).json({ message: 'No user wallets found.' });
    }

    // Decrypt admin's wallet secret key
    const adminSecretKey = decryptWalletSecret(admin.walletSecretKey);

    // 1. Send SOL to all user wallets (e.g., 0.0021 SOL each)
    const walletAddresses = userWallets.map(u => String(u.walletPublicKey).trim());
    const airdropResults = await solanaUtils.sendSolToWallets(adminSecretKey, walletAddresses, 0.0021);

    res.status(200).json({
      message: 'Airdrop complete',
      airdropResults
    });
  } catch (error) {
    console.error('Airdrop error:', error);
    res.status(500).json({ message: 'Airdrop failed', error: error.message });
  }
};

// POST /api/airdrop/send-back
export const usersSendBackToAdmin = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    // Get all users with a wallet address
    const users = await User.find({ walletPublicKey: { $exists: true, $ne: null }, walletSecretKey: { $exists: true, $ne: null } });

    // Exclude admin's own wallet address
    const adminWallet = String(admin.walletPublicKey).trim();
    const userWallets = users.filter(u => String(u.walletPublicKey).trim() && String(u.walletPublicKey).trim() !== adminWallet);

    if (userWallets.length === 0) {
      return res.status(400).json({ message: 'No user wallets found.' });
    }

    // 2. Each user sends back 90% to admin
    const sendBackResults = [];
    for (const user of userWallets) {
      try {
        const userSecretKey = decryptWalletSecret(user.walletSecretKey);
        const result = await solanaUtils.sendBackToAdmin(userSecretKey, adminWallet, 0.9);
        sendBackResults.push({
          address: user.walletPublicKey,
          ...result
        });
      } catch (err) {
        sendBackResults.push({
          address: user.walletPublicKey,
          success: false,
          error: err.message
        });
      }
    }

    res.status(200).json({
      message: 'Send-back complete',
      sendBackResults
    });
  } catch (error) {
    console.error('Send-back error:', error);
    res.status(500).json({ message: 'Send-back failed', error: error.message });
  }
};

// POST /api/airdrop/to-user
export const airdropToUser = async (req, res) => {
  try {
    const admin = req.user;
    const { walletAddress } = req.body; // walletAddress: target user, amount in SOL

    if (!admin.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    if (!walletAddress) {
      return res.status(400).json({ message: 'walletAddress is required' });
    }

    const adminSecretKey = decryptWalletSecret(admin.walletSecretKey);
    const result = await solanaUtils.sendSolToWallet(adminSecretKey, walletAddress);

    res.status(200).json({ message: 'Airdrop complete', result });
  } catch (error) {
    res.status(500).json({ message: 'Airdrop failed', error: error.message });
  }
};

// POST /api/airdrop/send-all-sol
export const userSendAllSolToAdmin = async (req, res) => {
  try {
    const { userWalletAddress, userWalletSecretKey, adminWalletAddress } = req.body;

    if (!userWalletAddress || !userWalletSecretKey || !adminWalletAddress) {
      return res.status(400).json({ message: 'userWalletAddress, userWalletSecretKey, and adminWalletAddress are required' });
    }

    const decryptedUserSecretKey = decryptWalletSecret(userWalletSecretKey);
    const result = await solanaUtils.sendAllSolFromUserToAdmin(decryptedUserSecretKey, adminWalletAddress);

    res.status(200).json({ message: 'Send-back complete', result });
  } catch (error) {
    res.status(500).json({ message: 'Send-back failed', error: error.message });
  }
};