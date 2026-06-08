import Reservation from '../models/Reservation.js';
import Resource from '../models/Resource.js';
import RoomClosure from '../models/RoomClosure.js';

// The set of "YYYY-MM-DD" day labels a reservation covers, derived directly from
// the (local wall-clock) datetime strings so it matches the calendar grid and
// the closures admins set. Parsed in UTC purely to sequence the date labels.
function coveredDays(startStr, endStr) {
  const s = String(startStr).slice(0, 10);
  const e = String(endStr).slice(0, 10);
  let d = new Date(`${s}T00:00:00Z`);
  const last = new Date(`${e}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || Number.isNaN(last.getTime())) return [s];
  const days = [];
  while (d <= last) {
    days.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return days;
}

// Parses + validates the shared booking window. Returns { start, end } on
// success or an { error } the caller turns into a 400.
function parseWindow(startDateTime, endDateTime) {
  const start = new Date(startDateTime);
  const end = new Date(endDateTime);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { error: 'Invalid date/time' };
  }
  if (end <= start) {
    return { error: 'End time must be after start time' };
  }
  return { start, end };
}

// POST /api/reservations
// A ticket books one room and, optionally, equipment to use within that room.
export async function createReservation(req, res) {
  const { borrowerName, resourceId, equipment, startDateTime, endDateTime, reason } = req.body;

  if (!borrowerName || !resourceId || !startDateTime || !endDateTime || !reason) {
    return res.status(400).json({
      error: 'borrowerName, resourceId, startDateTime, endDateTime and reason are required',
    });
  }

  const room = await Resource.findById(resourceId);
  if (!room || !room.active || room.kind !== 'room') {
    return res.status(404).json({ error: 'Room not found' });
  }

  const window = parseWindow(startDateTime, endDateTime);
  if (window.error) return res.status(400).json({ error: window.error });
  const { start, end } = window;

  // Reject if an admin has closed the room on any day this reservation covers.
  const days = coveredDays(startDateTime, endDateTime);
  const closed = await RoomClosure.findOne({ resource: room._id, day: { $in: days } }).select('day');
  if (closed) {
    return res.status(409).json({
      error: `"${room.name}" is closed on ${closed.day} and can't be reserved that day.`,
    });
  }

  // Optional equipment used within the room. Each item must be active equipment
  // in the room's department. Quantity is a request, not an inventory hold.
  let items;
  if (equipment != null) {
    if (!Array.isArray(equipment)) {
      return res.status(400).json({ error: 'equipment must be a list' });
    }
    const parsed = [];
    for (const item of equipment) {
      const name = (item?.name || '').trim();
      const quantity = Number(item?.quantity);
      if (!name || !Number.isInteger(quantity) || quantity < 1) {
        return res.status(400).json({ error: 'Each equipment item needs a name and quantity ≥ 1' });
      }
      parsed.push({ name, quantity });
    }
    if (parsed.length > 0) {
      const valid = await Resource.find({
        department: room.department,
        kind: 'equipment',
        active: true,
        name: { $in: parsed.map((i) => i.name) },
      }).select('name');
      const validNames = new Set(valid.map((r) => r.name));
      const unknown = parsed.filter((i) => !validNames.has(i.name));
      if (unknown.length > 0) {
        return res.status(404).json({
          error: `Unknown equipment for ${room.department}: ${unknown.map((i) => i.name).join(', ')}`,
        });
      }
      items = parsed;
    }
  }

  // Conflict check: count existing pending/approved reservations for this
  // room whose time range overlaps the requested one. Two ranges overlap
  // when each starts before the other ends. Rejected tickets never block.
  // A room with quantity N can be booked by up to N overlapping holds.
  const overlapping = await Reservation.countDocuments({
    resource: room._id,
    status: { $in: ['pending', 'approved'] },
    startDateTime: { $lt: end },
    endDateTime: { $gt: start },
  });

  if (overlapping >= room.quantity) {
    return res.status(409).json({
      error:
        `"${room.name}" is fully booked for the selected time. ` +
        `All ${room.quantity} unit(s) are already reserved during that window — ` +
        `please pick a different time or room.`,
    });
  }

  const reservation = await Reservation.create({
    user: req.userId,
    borrowerName,
    department: room.department,
    resource: room._id,
    resourceName: room.name,
    equipment: items,
    startDateTime: start,
    endDateTime: end,
    reason,
  });

  res.status(201).json(reservation);
}

// GET /api/reservations/mine
export async function myReservations(req, res) {
  const reservations = await Reservation.find({ user: req.userId }).sort({ createdAt: -1 });
  res.json(reservations);
}

// DELETE /api/reservations/:id
// A user cancels (deletes) their own reservation. Deleting the document frees the
// time slot immediately, since the conflict check in createReservation only counts
// pending/approved tickets that still exist.
export async function cancelReservation(req, res) {
  const reservation = await Reservation.findById(req.params.id);
  if (!reservation) return res.status(404).json({ error: 'Reservation not found' });
  if (String(reservation.user) !== String(req.userId)) {
    return res.status(403).json({ error: 'You can only cancel your own reservations' });
  }
  await reservation.deleteOne();
  res.json({ ok: true });
}

// GET /api/reservations/calendar?department=BMO&resourceId=...&weeks=4
// Visible to any authenticated user (both `user` and `admin`). Returns the
// active resources matching the filter plus every pending/approved reservation
// that overlaps the window — start of today through `weeks` weeks out — so the
// client can render an availability calendar. Rejected tickets are excluded:
// they never hold a slot (mirrors the conflict check in createReservation).
export async function calendarReservations(req, res) {
  const weeks = Math.min(Math.max(parseInt(req.query.weeks, 10) || 4, 1), 12);

  const rangeStart = new Date();
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(rangeStart);
  rangeEnd.setDate(rangeEnd.getDate() + weeks * 7);

  // The calendar is rooms-only — rooms have real time-slot availability;
  // equipment requests are just quantities and never appear here.
  const resourceFilter = { active: true, kind: 'room' };
  if (req.query.department) resourceFilter.department = req.query.department;
  if (req.query.resourceId) resourceFilter._id = req.query.resourceId;

  const reservationFilter = {
    status: { $in: ['pending', 'approved'] },
    startDateTime: { $lt: rangeEnd },
    endDateTime: { $gt: rangeStart },
  };
  if (req.query.department) reservationFilter.department = req.query.department;
  if (req.query.resourceId) reservationFilter.resource = req.query.resourceId;

  const [resources, reservations] = await Promise.all([
    Resource.find(resourceFilter)
      .sort({ department: 1, floor: 1, name: 1 })
      .select('name department floor quantity'),
    Reservation.find(reservationFilter)
      .sort({ startDateTime: 1 })
      .select('resource resourceName department borrowerName startDateTime endDateTime status'),
  ]);

  // Admin day-closures for the rooms in scope (sparse — return them all).
  const closures = await RoomClosure.find({
    resource: { $in: resources.map((r) => r._id) },
  }).select('resource day');

  res.json({ rangeStart, rangeEnd, weeks, resources, reservations, closures });
}

// GET /api/reservations?status=pending&department=ITRO  (admin)
export async function listReservations(req, res) {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.department) filter.department = req.query.department;
  const reservations = await Reservation.find(filter)
    .sort({ createdAt: -1 })
    .populate('user', 'name email')
    .populate('resource', 'name floor kind');
  res.json(reservations);
}

// PATCH /api/reservations/:id/decision  (admin)
export async function decideReservation(req, res) {
  const { status, remarks } = req.body;
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'status must be "approved" or "rejected"' });
  }
  const reservation = await Reservation.findById(req.params.id);
  if (!reservation) return res.status(404).json({ error: 'Reservation not found' });

  reservation.status = status;
  reservation.remarks = remarks || '';
  reservation.decidedBy = req.userId;
  reservation.decidedAt = new Date();
  await reservation.save();

  res.json(reservation);
}
