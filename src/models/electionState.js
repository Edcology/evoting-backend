import mongoose from 'mongoose';
import { decryptWalletSecret } from '../middleware/auth.js';
import solanaUtils from '../utils/solana.js';

const CandidateInfoSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String,
    default: null
  }
}, { _id: false }); 

const ElectionStateSchema = new mongoose.Schema({
  // The on-chain election PDA
  electionPDA: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  posts: [{
    title: {
      type: String,
      required: true
    },
    candidates: [String],
    candidateInfo: [CandidateInfoSchema],
    description: {
      type: String,
      default: ''
    }
  }],
  isActive: {
    type: Boolean,
    default: false
  },
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  startDate: {
    type: Date
  },
  endDate: {
    type: Date
  },
  duration: {
    type: Number, // Duration in hours
    required: true,
    min: 1, // Minimum duration of 1 hour
    max: 168, // Maximum 1 week (168 hours)
    validate: {
      validator: Number.isInteger,
      message: 'Duration must be a whole number of hours'
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  results: {
    type: Array,
    default: []
  }
});

// Helper methods
ElectionStateSchema.methods.isExpired = function() {
  return this.endDate && new Date() > this.endDate;
};

ElectionStateSchema.methods.hasStarted = function() {
  return this.startDate && new Date() >= this.startDate;
};

ElectionStateSchema.methods.getRemainingTime = function() {
  if (!this.endDate) return null;
  const now = new Date();
  if (now > this.endDate) return 0;
  return Math.floor((this.endDate - now) / (1000 * 60 * 60)); // Returns remaining hours
};

ElectionStateSchema.methods.getStatus = async function() {
  const now = new Date();
  
  // Check if election has expired
  if (this.endDate && now > this.endDate) {
    if (this.isActive) {
      // Auto-end the election both in database and blockchain
      this.isActive = false;
      await this.save();
      
      // End election on blockchain
      try {
        const adminUser = await mongoose.model('User').findById(this.adminId);
        if (adminUser) {
          const adminSecretKey = decryptWalletSecret(adminUser.walletSecretKey);
          await solanaUtils.endElection(adminSecretKey);
        }
      } catch (error) {
        console.error('Auto-end election error:', error);
      }
    }
    return 'ENDED';
  }
  
  if (this.isActive) {
    return 'ACTIVE';
  }
  
  if (!this.startDate) {
    return 'NOT_STARTED';
  }
  
  return 'INACTIVE';
};

// Add compound index for active elections query
ElectionStateSchema.index({ isActive: 1, endDate: 1 });

export default mongoose.model('ElectionState', ElectionStateSchema);