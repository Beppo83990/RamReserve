import mongoose from 'mongoose';

// A single equipment line item on a reservation: which item and how many units
// the borrower needs within the reserved room.
const equipmentItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const reservationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    borrowerName: { type: String, required: true, trim: true },
    department: { type: String, enum: ['BMO', 'ITRO'], required: true },

    // Every ticket books exactly one room...
    resource: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource', required: true },
    // Snapshot of the room name so the ticket stays readable even if the catalog
    // item is later renamed or removed.
    resourceName: { type: String, required: true },

    // ...plus optional equipment to use within that room (each with a quantity).
    equipment: { type: [equipmentItemSchema], default: undefined },

    startDateTime: { type: Date, required: true },
    endDateTime: { type: Date, required: true },
    reason: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    remarks: { type: String, default: '' },
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    decidedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model('Reservation', reservationSchema);
