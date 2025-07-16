import ElectionState from '../models/electionState.js';
import VoteRecord from '../models/voteRecord.js';
import solanaUtils from '../utils/solana.js';
import { decryptWalletSecret } from '../middleware/auth.js';
import mongoose from 'mongoose';

// Initialize a new election
export const initializeElection = async (req, res) => {
  try {
    const { title, description, posts, duration } = req.body;
    const admin = req.user;
    
    if (!admin.isAdmin) {
      return res.status(403).json({ message: 'Only admins can initialize elections' });
    }

    if (!duration || duration < 1) {
      return res.status(400).json({ message: 'Duration must be at least 1 hour' });
    }

    const processedPosts = posts.map(post => {
      // Ensure each post has the required fields
      if (!post.title || !post.candidates || !Array.isArray(post.candidates)) {
        throw new Error('Each post must have a title and candidates array');
      }
      
      // Process candidates - they can be either:
      // 1. Array of strings (names only)
      // 2. Array of objects with name and imageUrl
      let candidateNames = [];
      let candidateInfo = [];
      
      if (post.candidates.length > 0) {
        if (typeof post.candidates[0] === 'string') {
          // Case 1: Array of strings
          candidateNames = post.candidates;
          candidateInfo = post.candidates.map(name => ({ name, imageUrl: null }));
        } else {
          // Case 2: Array of objects
          candidateNames = post.candidates.map(c => c.name);
          candidateInfo = post.candidates.map(c => ({
            name: c.name,
            imageUrl: c.imageUrl || null
          }));
        }
      }
      
      return {
        title: post.title,
        description: post.description || '',
        candidates: candidateNames,        // For blockchain
        candidateInfo: candidateInfo       // For database with images
      };
    });
    
    // Get admin's wallet secret key
    const adminSecretKey = decryptWalletSecret(admin.walletSecretKey);

    const blockchainPosts = processedPosts.map(post => ({
      title: post.title,
      candidates: post.candidates  // Array of strings
    }));
    
    // 1. First check if there's an active election
    const activeElection = await ElectionState.findOne({ isActive: true });
    if (activeElection) {
      return res.status(400).json({ 
        message: 'Cannot initialize new election while another is active. Please end the active election first.'
      });
    }

    // 2. Then proceed with initialization
    // Try to close any existing election accounts (even if not active)
    await solanaUtils.endElection(adminSecretKey);
    
    await solanaUtils.closeElection(adminSecretKey);
    
    // Initialize election on blockchain
    const result = await solanaUtils.initializeElection(adminSecretKey, blockchainPosts);
    
    if (!result.success) {
      return res.status(400).json({ message: 'Failed to initialize election on blockchain', error: result.error });
    }
    
    // Create election record in database
    const electionState = new ElectionState({
      electionPDA: result.electionPDA,
      title,
      description,
      posts: processedPosts,
      adminId: admin._id,
      isActive: false,
      duration
    });
    
    await electionState.save();
    
    res.status(201).json({
      message: 'Election initialized successfully',
      election: {
        id: electionState._id,
        title: electionState.title,
        electionPDA: electionState.electionPDA,
        posts: electionState.posts,
        isActive: electionState.isActive,
        duration: electionState.duration
      },
      transactionId: result.tx
    });
  } catch (error) {
    console.error('Election initialization error:', error);
    res.status(500).json({ message: 'Error initializing election', error: error.message });
  }
};

// Start an election
export const startElection = async (req, res) => {
  try {
    const { electionId } = req.params;
    const admin = req.user;

    if (!mongoose.Types.ObjectId.isValid(electionId)) {
        return res.status(400).json({ 
          message: 'Invalid election ID format',
          receivedId: electionId
        });
      }
    
    if (!admin.isAdmin) {
      return res.status(403).json({ message: 'Only admins can start elections' });
    }
    
    // Find the election
    const election = await ElectionState.findById(electionId);
    
    if (!election) {
      return res.status(404).json({ message: 'Election not found' });
    }
    
    if (election.adminId.toString() !== admin._id.toString()) {
      return res.status(403).json({ message: 'You are not the admin of this election' });
    }
    
    if (election.isActive) {
      return res.status(400).json({ message: 'Election is already active' });
    }
    
    // Get admin's wallet secret key
    const adminSecretKey = decryptWalletSecret(admin.walletSecretKey);
    
    // Start election on blockchain
    const result = await solanaUtils.startElection(adminSecretKey);
    
    if (!result.success) {
      return res.status(400).json({ message: 'Failed to start election on blockchain', error: result.error });
    }
    
    // Update election state in database
    election.isActive = true;
    election.startDate = new Date();
    // Calculate end date based on duration
    election.endDate = new Date(election.startDate.getTime() + (election.duration * 60 * 60 * 1000)); // Convert hours to milliseconds
    await election.save();
    
    res.status(200).json({
      message: 'Election started successfully',
      election: {
        id: election._id,
        title: election.title,
        isActive: election.isActive,
        startDate: election.startDate,
        endDate: election.endDate,
        duration: election.duration
      },
      transactionId: result.tx
    });
  } catch (error) {
    console.error('Election start error:', error);
    res.status(500).json({ message: 'Error starting election', error: error.message });
  }
};

// End an election
export const endElection = async (req, res) => {
  try {
    const { electionId } = req.params;
    const admin = req.user;
    
    if (!admin.isAdmin) {
      return res.status(403).json({ message: 'Only admins can end elections' });
    }
    
    // Find the election
    const election = await ElectionState.findById(electionId);
    
    if (!election) {
      return res.status(404).json({ message: 'Election not found' });
    }
    
    if (election.adminId.toString() !== admin._id.toString()) {
      return res.status(403).json({ message: 'You are not the admin of this election' });
    }
    
    if (!election.isActive) {
      return res.status(400).json({ message: 'Election is not active' });
    }
    
    // Get admin's wallet secret key
    const adminSecretKey = decryptWalletSecret(admin.walletSecretKey);
    
    // End election on blockchain
    const result = await solanaUtils.endElection(adminSecretKey);
    
    if (!result.success) {
      return res.status(400).json({ message: 'Failed to end election on blockchain', error: result.error });
    }
    
    // Update election state in database
    election.isActive = false;
    election.endDate = new Date();
    await election.save();
    
    res.status(200).json({
      message: 'Election ended successfully',
      election: {
        id: election._id,
        title: election.title,
        isActive: election.isActive,
        endDate: election.endDate
      },
      transactionId: result.tx
    });
  } catch (error) {
    console.error('Election end error:', error);
    res.status(500).json({ message: 'Error ending election', error: error.message });
  }
};

// Close an election
export const closeElection = async (req, res) => {
  try {
    const { electionId } = req.params;
    const admin = req.user;
    
    if (!admin.isAdmin) {
      return res.status(403).json({ message: 'Only admins can close elections' });
    }
    
    // Find the election
    const election = await ElectionState.findById(electionId);
    
    if (!election) {
      return res.status(404).json({ message: 'Election not found' });
    }
    
    if (election.adminId.toString() !== admin._id.toString()) {
      return res.status(403).json({ message: 'You are not the admin of this election' });
    }
    
    if (election.isActive) {
      return res.status(400).json({ message: 'Cannot close an active election. End it first.' });
    }
    
    // Get admin's wallet secret key
    const adminSecretKey = decryptWalletSecret(admin.walletSecretKey);
    
    // Close election on blockchain
    const result = await solanaUtils.closeElection(adminSecretKey);
    
    if (!result.success) {
      return res.status(400).json({ message: 'Failed to close election on blockchain', error: result.error });
    }

    let results = [];
    try {
      const blockchainState = await solanaUtils.getElectionState(election.electionPDA);
      if (blockchainState.success && blockchainState.data?.posts) {
        results = blockchainState.data.posts.map(post => ({
          title: post.title,
          candidates: post.candidates,
          results: post.results
        }));
      }
    } catch (err) {
      console.error('Could not fetch results before closing:', err);
    }
    
    // For archival purposes, let's keep it but add a "closed" flag
    election.closed = true;
    election.results = results
    await election.save();
    
    res.status(200).json({
      message: 'Election closed successfully',
      election: {
        id: election._id,
        title: election.title,
        closed: election.closed,
        results: election.results || []
      },
      transactionId: result.tx
    });
  } catch (error) {
    console.error('Election close error:', error);
    res.status(500).json({ message: 'Error closing election', error: error.message });
  }
};

// Get all elections (for admin)
export const getAllElections = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const elections = await ElectionState.find()
      .select('title description isActive startDate endDate duration createdAt closed results electionPDA, posts')
      .sort({ createdAt: -1 });

    const formattedElections = await Promise.all(elections.map(async (election) => {
      const status = typeof election.getStatus === 'function'
        ? await election.getStatus()
        : election.status || 'UNKNOWN';

    let results = election.results

    const postsWithResults = (election.posts || []).map((post, idx) => ({
        ...post.toObject?.() || post,
        results: results[idx]?.results || []
      }));

      return {
        id: election._id,
        title: election.title,
        description: election.description,
        status,
        remainingHours: election.getRemainingTime?.() ?? null,
        startDate: election.startDate,
        endDate: election.endDate,
        posts: election.posts,
        duration: election.duration,
        createdAt: election.createdAt,
        posts: postsWithResults
      };
    }));

    res.status(200).json({ elections: formattedElections });
  } catch (error) {
    console.error('Get elections error:', error);
    res.status(500).json({ message: 'Error fetching elections', error: error.message });
  }
};

export const getUnstartedElections = async (req, res) => {
  try {
    const admin = req.user;
    if (!admin.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const elections = await ElectionState.find({
      adminId: admin._id,
      $or: [
        { isActive: true }, // started/active
        { isActive: false, $or: [{ startDate: null }, { startDate: { $exists: false } }] } // initialized, not started
      ]
    }).select('title description posts isActive startDate endDate duration');

    const formattedElections = elections.map(election => ({
      id: election._id,
      title: election.title,
      description: election.description,
      status: 'NOT_STARTED',
      isActive: election.isActive,
      remainingHours: election.getRemainingTime?.() ?? null,
      startDate: election.startDate,
      endDate: election.endDate,
      duration: election.duration,
      posts: (election.posts || []).map(post => ({
        title: post.title,
        description: post.description,
        candidateCount: post.candidates.length
      }))
    }));

    res.status(200).json({
      elections: formattedElections,
      totalUnstarted: formattedElections.length
    });
  } catch (error) {
    console.error('Get unstarted elections error:', error);
    res.status(500).json({ message: 'Error fetching unstarted elections', error: error.message });
  }
};

// Get elections administered by current admin
export const getMyElections = async (req, res) => {
  try {
    const admin = req.user;
    
    if (!admin.isAdmin) {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const elections = await ElectionState.find({ adminId: admin._id })
      .select('title description isActive startDate endDate duration createdAt')
      .sort({ createdAt: -1 });
    
    const formattedElections = elections.map(election => ({
      id: election._id,
      title: election.title,
      description: election.description,
      status: election.getStatus(),
      remainingHours: election.getRemainingTime(),
      startDate: election.startDate,
      endDate: election.endDate,
      duration: election.duration,
      createdAt: election.createdAt
    }));
    
    res.status(200).json({ elections: formattedElections });
  } catch (error) {
    console.error('Get my elections error:', error);
    res.status(500).json({ message: 'Error fetching your elections', error: error.message });
  }
};

// Get active elections (for voters)
export const getActiveElections = async (req, res) => {
  try {
    const now = new Date();
    const elections = await ElectionState.find({ 
      isActive: true,
      endDate: { $gt: now }
    }).select('title description posts isActive startDate endDate duration');
    
    const formattedElections = elections.map(election => ({
      id: election._id,
      title: election.title,
      description: election.description,
      status: election,
      remainingHours: election.getRemainingTime(),
      startDate: election.startDate,
      endDate: election.endDate,
      duration: election.duration,
      posts: election.posts.map(post => ({
        title: post.title,
        description: post.description,
        candidateCount: post.candidates.length
      }))
    }));
    
    res.status(200).json({ 
      elections: formattedElections,
      totalActive: formattedElections.length 
    });
  } catch (error) {
    console.error('Get active elections error:', error);
    res.status(500).json({ message: 'Error fetching active elections', error: error.message });
  }
};

// Get election details
export const getElectionDetails = async (req, res) => {
  try {
    const { electionId } = req.params;
    const { includeResults = 'true' } = req.query;
    const shouldIncludeResults = includeResults.toLowerCase() === 'true';
    
    const election = await ElectionState.findById(electionId);
    
    if (!election) {
      return res.status(404).json({ message: 'Election not found' });
    }

    const status = await election.getStatus();
    
    let results = [];
    // Only fetch results if explicitly requested
    if (shouldIncludeResults) {
      const blockchainState = await solanaUtils.getElectionState();
      
      if (!blockchainState.success) {
        return res.status(500).json({ 
          message: 'Error fetching blockchain state', 
          error: blockchainState.error 
        });
      }
      
      results = blockchainState.data.posts.map(post => ({
        title: post.title,
        candidates: post.candidates,
        results: post.results
      }));
    }
    
    // Enhanced response with status information
    const response = {
      id: election._id,
      title: election.title,
      description: election.description,
      isActive: election.isActive,
      status: status,
      startDate: election.startDate,
      endDate: election.endDate,
      remainingHours: election.getRemainingTime(),
      duration: election.duration,
      posts: election.posts.map((post, index) => ({
        ...post.toObject(),
        ...(shouldIncludeResults ? { results: results[index]?.results || [] } : {})
      }))
    };
    
    res.status(200).json({ election: response });
  } catch (error) {
    console.error('Get election details error:', error);
    res.status(500).json({ message: 'Error fetching election details', error: error.message });
  }
};

// Get voters for an election (transparency)
export const getElectionVoters = async (req, res) => {
  try {
    const { electionId } = req.params;
    const admin = req.user;
    
    // Admins can see voter details
    const election = await ElectionState.findById(electionId);
    
    if (!election) {
      return res.status(404).json({ message: 'Election not found' });
    }
    
    // For transparency, we allow anyone to see who voted (but not what they voted for)
    const voteRecords = await VoteRecord.find({ electionId })
      .populate('userId', 'username walletPublicKey')
      .select('userId voterPublicKey timestamp postIndex');
    
    res.status(200).json({ 
      electionId,
      voterCount: voteRecords.length,
      voters: voteRecords.map(record => ({
        username: record.userId.username,
        walletPublicKey: record.voterPublicKey,
        timestamp: record.timestamp,
        postIndex: record.postIndex
      }))
    });
  } catch (error) {
    console.error('Get election voters error:', error);
    res.status(500).json({ message: 'Error fetching election voters', error: error.message });
  }
};