import { Router } from 'express';
import { register, login, me } from '../controllers/authController.js';
import { requireAuth, loadUser } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.post('/register', asyncHandler(register));
router.post('/login', asyncHandler(login));
router.get('/me', requireAuth, asyncHandler(loadUser), me);

export default router;
