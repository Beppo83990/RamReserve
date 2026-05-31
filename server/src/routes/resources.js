import { Router } from 'express';
import { listResources, getCatalog } from '../controllers/resourceController.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/', requireAuth, asyncHandler(listResources));
router.get('/catalog', requireAuth, asyncHandler(getCatalog));

export default router;
