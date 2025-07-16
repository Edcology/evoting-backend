import mongoose from 'mongoose';

const VoteRecordSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  electionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ElectionState',
    required: true
  },
  postIndex: {
    type: Number,
    required: true
  },
  candidateIndex: {
    type: Number,
    required: true
  },
  transactionId: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  voterPublicKey: {
    type: String,
    required: true
  }
});

// Compound index to ensure a user can only vote once per post
VoteRecordSchema.index({ userId: 1, electionId: 1, postIndex: 1 }, { unique: true });

export default mongoose.model('VoteRecord', VoteRecordSchema);