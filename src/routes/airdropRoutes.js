import express from 'express';
import { 
  airdropToAllUsers, 
  usersSendBackToAdmin, 
  airdropToUser, 
  userSendAllSolToAdmin 
} from '../controllers/airdropController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/all', verifyToken, airdropToAllUsers);
router.post('/send-back', verifyToken, usersSendBackToAdmin);
router.post('/to-user', verifyToken, airdropToUser);
router.post('/user-send-all', verifyToken, userSendAllSolToAdmin);

export default router;