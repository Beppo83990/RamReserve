import { Router } from 'express';
import { setAvailability } from '../controllers/availabilityController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.patch('/', requireAuth, requireAdmin, asyncHandler(setAvailability));

export default router;
