// routes/imageRoutes.js
import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import { upload, uploadCandidateImage } from '../controllers/imageController.js';

const router = express.Router();

// Image upload route (protected)
router.post('/candidates', verifyToken, upload.single('image'), uploadCandidateImage);

export default router;