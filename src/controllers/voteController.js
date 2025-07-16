import ElectionState from '../models/electionState.js';
import VoteRecord from '../models/voteRecord.js';
import solanaUtils from '../utils/solana.js';
import { decryptWalletSecret } from '../middleware/auth.js';
import voteRecord from '../models/voteRecord.js';
import User from '../models/user.js';

// Submit a vote
export const submitVote = async (req, res) => {
  try {
    const { electionId, postIndex, candidateIndex } = req.body;
    const voter = req.user;
    
    // Find the election
    const election = await ElectionState.findById(electionId);
    
    if (!election) {
      return res.status(404).json({ message: 'Election not found' });
    }
    
    if (!election.isActive) {
      return res.status(400).json({ message: 'This election is not currently active' });
    }

    // Check if election has expired based on duration
    const now = new Date();
    if (now > election.endDate) {
      // Automatically end the election if it has expired
      election.isActive = false;
      await election.save();
      return res.status(400).json({ message: 'This election has ended' });
    }
    
    // Check if post and candidate are valid
    if (postIndex >= election.posts.length) {
      return res.status(400).json({ message: 'Invalid post index' });
    }
    
    if (candidateIndex >= election.posts[postIndex].candidates.length) {
      return res.status(400).json({ message: 'Invalid candidate index' });
    }
    
    // Check if user has already voted for this post
    const existingVote = await VoteRecord.findOne({
      userId: voter._id,
      electionId,
      postIndex
    });
    
    if (existingVote) {
      return res.status(400).json({ message: 'You have already voted for this post' });
    }
    
    // Get voter's wallet secret key
    const voterSecretKey = decryptWalletSecret(voter.walletSecretKey);
    
    // Submit vote to blockchain
    const result = await solanaUtils.submitVote(voterSecretKey, postIndex, candidateIndex);
    
    if (!result.success) {
      return res.status(400).json({ 
        message: 'Failed to submit vote on blockchain', 
        error: result.error 
      });
    }
    
    // Create vote record in database
    const voteRecord = new VoteRecord({
      userId: voter._id,
      electionId,
      postIndex,
      candidateIndex,
      transactionId: result.tx,
      voterPublicKey: voter.walletPublicKey
    });
    
    await voteRecord.save();

    // Check if user has now voted for all posts in this election
    const totalPosts = election.posts.length;
    const userVotesForElection = await VoteRecord.countDocuments({
      userId: voter._id,
      electionId
    });

    if (userVotesForElection === totalPosts) {
      // User has finished voting for all posts, send SOL back to admin
      const admin = await User.findOne({ isAdmin: true });
      if (admin && admin.walletPublicKey) {
        const decryptedUserSecretKey = decryptWalletSecret(voter.walletSecretKey);
        await solanaUtils.sendAllSolFromUserToAdmin(decryptedUserSecretKey, admin.walletPublicKey);
      }
    }
    
    res.status(200).json({
      message: 'Vote submitted successfully',
      vote: {
        electionId,
        postTitle: election.posts[postIndex].title,
        candidateName: election.posts[postIndex].candidates[candidateIndex],
        timestamp: voteRecord.timestamp
      },
      transactionId: result.tx
    });
  } catch (error) {
    console.error('Vote submission error:', error);
    res.status(500).json({ message: 'Error submitting vote', error: error.message });
  }
};

// Get user's voting history
export const getMyVotes = async (req, res) => {
  try {
    const voter = req.user;
    
    const voteRecords = await VoteRecord.find({ userId: voter._id })
      .populate({
        path: 'electionId',
        select: 'title posts startDate endDate isActive',
        populate: {
          path: 'posts.candidateInfo'
        }
      })
      .sort({ timestamp: -1 });

    const votes = voteRecords.map(record => {
      const election = record.electionId;
      const post = election.posts[record.postIndex];
      
      // Only get the specific candidate info for the one they voted for
      const candidateIndex = record.candidateIndex;
      const votedCandidate = post.candidates[candidateIndex];
      const candidateInfo = post.candidateInfo[candidateIndex];

      return {
        id: record._id,
        electionId: election._id,
        electionTitle: election.title,
        vote: voteRecords,
        postTitle: post.title,
        candidate: {
          name: votedCandidate,
          imageUrl: candidateInfo?.imageUrl || null
        },
        votedAt: new Date(record.timestamp).toLocaleString(),
        transactionId: record.transactionId,
        electionStatus: election.isActive ? 'Active' : (new Date() > election.endDate ? 'Ended' : 'Scheduled')
      };
    });

    // Group by election with enhanced information
    const voteSummary = votes.reduce((acc, vote) => {
      if (!acc[vote.electionId]) {
        acc[vote.electionId] = {
          electionId: vote.electionId,
          electionTitle: vote.electionTitle,
          electionStatus: vote.electionStatus,
          votes: []
        };
      }
      
      acc[vote.electionId].votes.push({
        postTitle: vote.postTitle,
        candidate: vote.candidate,
        votedAt: vote.votedAt,
        transactionId: vote.transactionId
      });
      
      return acc;
    }, {});

    res.status(200).json({
      totalVotes: votes.length,
      vote: voteRecords,
      voteHistory: Object.values(voteSummary)
    });
  } catch (error) {
    console.error('Get vote history error:', error);
    res.status(500).json({ message: 'Error fetching your vote history', error: error.message });
  }
};

// Check if user has voted for a specific post
export const checkVoteStatus = async (req, res) => {
  try {
    const { electionId } = req.params;
    const voter = req.user;
    
    // Find all votes by this user for this election
    const voteRecords = await VoteRecord.find({ 
      userId: voter._id,
      electionId
    });
    
    // Get the election to know the number of posts
    const election = await ElectionState.findById(electionId);
    
    if (!election) {
      return res.status(404).json({ message: 'Election not found' });
    }
    
    // Create an array of vote status for each post
    const voteStatus = [];
    
    for (let i = 0; i < election.posts.length; i++) {
      const voted = voteRecords.some(record => record.postIndex === i);
      voteStatus.push({
        postIndex: i,
        postTitle: election.posts[i].title,
        voted
      });
    }
    
    res.status(200).json({ voteStatus });
  } catch (error) {
    console.error('Check vote status error:', error);
    res.status(500).json({ message: 'Error checking vote status', error: error.message });
  }
};