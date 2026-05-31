import Resource from '../models/Resource.js';
import RoomClosure from '../models/RoomClosure.js';

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

// PATCH /api/availability  (admin)
// Body: { resourceId, day: 'YYYY-MM-DD', available: boolean }
// available=false closes the room for that whole day; true reopens it.
export async function setAvailability(req, res) {
  const { resourceId, day, available } = req.body;
  if (!resourceId || !DAY_RE.test(day || '') || typeof available !== 'boolean') {
    return res.status(400).json({
      error: 'resourceId, day (YYYY-MM-DD) and available (boolean) are required',
    });
  }

  const room = await Resource.findById(resourceId);
  if (!room || !room.active || room.kind !== 'room') {
    return res.status(404).json({ error: 'Room not found' });
  }

  if (available) {
    await RoomClosure.deleteOne({ resource: room._id, day });
  } else {
    // Idempotent close: create the closure if it isn't already there.
    await RoomClosure.updateOne(
      { resource: room._id, day },
      { $setOnInsert: { resource: room._id, day, createdBy: req.userId } },
      { upsert: true }
    );
  }

  res.json({ resourceId: room._id, day, available });
}
