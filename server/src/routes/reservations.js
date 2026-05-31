import { Router } from 'express';
import {
  createReservation,
  myReservations,
  calendarReservations,
  listReservations,
  decideReservation,
} from '../controllers/reservationController.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.post('/', requireAuth, asyncHandler(createReservation));
router.get('/mine', requireAuth, asyncHandler(myReservations));
router.get('/calendar', requireAuth, asyncHandler(calendarReservations));
router.get('/', requireAuth, requireAdmin, asyncHandler(listReservations));
router.patch('/:id/decision', requireAuth, requireAdmin, asyncHandler(decideReservation));

export default router;
