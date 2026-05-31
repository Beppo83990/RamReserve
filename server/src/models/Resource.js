import mongoose from 'mongoose';

/**
 * A reservable item. Belongs to a department (BMO or ITRO) and is one of two
 * kinds:
 *   - 'room'      : a physical room, located on a `floor`, booked one at a time.
 *   - 'equipment' : a piece of gear requested by quantity (no floor).
 */
const resourceSchema = new mongoose.Schema(
  {
    department: { type: String, enum: ['BMO', 'ITRO'], required: true },
    kind: { type: String, enum: ['room', 'equipment'], required: true },
    floor: { type: String, default: '' },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    quantity: { type: Number, default: 1, min: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Resource', resourceSchema);
