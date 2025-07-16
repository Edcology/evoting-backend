import express from 'express';
import * as voteController from '../controllers/voteController.js';
import { verifyToken } from '../middleware/auth.js';
import { checkElectionExpiry } from '../middleware/electionMiddleware.js';
const router = express.Router();

// Voter routes (all protected)
router.post('/submit', verifyToken, checkElectionExpiry, voteController.submitVote);
router.get('/my', verifyToken, voteController.getMyVotes);
router.get('/status/:electionId', verifyToken, checkElectionExpiry, voteController.checkVoteStatus);

export default router;