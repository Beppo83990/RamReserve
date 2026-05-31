import mongoose from 'mongoose';

// A room marked unavailable for an entire calendar day by an admin.
// `day` is a plain "YYYY-MM-DD" label so it lines up exactly with the calendar
// grid (no timezone math). Presence of a doc = that room is closed that day.
const roomClosureSchema = new mongoose.Schema(
  {
    resource: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource', required: true },
    day: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// One closure per room per day.
roomClosureSchema.index({ resource: 1, day: 1 }, { unique: true });

export default mongoose.model('RoomClosure', roomClosureSchema);
