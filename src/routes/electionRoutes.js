import express from 'express';
import * as electionController from '../controllers/electionController.js';
import { verifyToken, adminOnly } from '../middleware/auth.js';
import { checkElectionExpiry } from '../middleware/electionMiddleware.js';
const router = express.Router();

// Admin routes
router.post('/initialize', verifyToken, adminOnly, electionController.initializeElection);
router.post('/:electionId/start', verifyToken, adminOnly, checkElectionExpiry, electionController.startElection);
router.post('/:electionId/end', verifyToken, adminOnly, checkElectionExpiry, electionController.endElection);
router.post('/:electionId/close', verifyToken, adminOnly, checkElectionExpiry, electionController.closeElection);
router.get('/admin/all', verifyToken, adminOnly, electionController.getAllElections);
router.get('/admin/my', verifyToken, adminOnly, electionController.getMyElections);
router.get('/admin/unstarted', verifyToken, adminOnly, electionController.getUnstartedElections);

// Public and voter routes
router.get('/active', electionController.getActiveElections);
router.get('/:electionId', checkElectionExpiry, electionController.getElectionDetails);
router.get('/:electionId/voters', checkElectionExpiry, electionController.getElectionVoters);

export default router;