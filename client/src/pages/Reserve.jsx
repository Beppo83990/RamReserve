import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api.js';

const DEPARTMENTS = [
  { code: 'BMO', label: 'BMO — Building Management Office' },
  { code: 'ITRO', label: 'ITRO — Information Technology Resource Office' },
];

// Floors are labels like "10th Floor" — order them by their leading number so
// "2nd Floor" comes before "10th Floor" (not string-sorted as 10, 11, 1, 2…).
const floorRank = (f) => parseInt(f, 10) || 0;

export default function Reserve() {
  const { user } = useAuth();
  const [department, setDepartment] = useState('');
  const [resources, setResources] = useState([]); // active resources for the dept

  // Room selection
  const [roomId, setRoomId] = useState('');

  // Equipment selection: { [name]: quantity } for checked items
  const [picked, setPicked] = useState({});

  const [common, setCommon] = useState({
    borrowerName: user?.name || '',
    startDateTime: '',
    endDateTime: '',
    reason: '',
  });
  const [message, setMessage] = useState(null); // { kind, text }
  const [submitting, setSubmitting] = useState(false);

  // Load this department's resources whenever it changes.
  useEffect(() => {
    if (!department) {
      setResources([]);
      return;
    }
    api
      .get('/resources', { params: { department } })
      .then((res) => setResources(res.data))
      .catch(() => setResources([]));
    resetSelections();
  }, [department]);

  function resetSelections() {
    setRoomId('');
    setPicked({});
  }

  const rooms = useMemo(() => resources.filter((r) => r.kind === 'room'), [resources]);
  const equipment = useMemo(() => resources.filter((r) => r.kind === 'equipment'), [resources]);

  // Rooms grouped by floor (floors ordered numerically) so a single dropdown can
  // show every room under an <optgroup> per floor — no separate floor step.
  const roomsByFloor = useMemo(() => {
    const map = {};
    for (const r of rooms) (map[r.floor] ??= []).push(r);
    return Object.keys(map)
      .sort((a, b) => floorRank(a) - floorRank(b))
      .map((f) => ({ floor: f, items: map[f] }));
  }, [rooms]);

  function updateCommon(field) {
    return (e) => setCommon({ ...common, [field]: e.target.value });
  }

  function toggleEquipment(name) {
    setPicked((p) => {
      const next = { ...p };
      if (name in next) delete next[name];
      else next[name] = 1;
      return next;
    });
  }

  function setEquipmentQty(name, value) {
    const qty = Math.max(1, parseInt(value, 10) || 1);
    setPicked((p) => ({ ...p, [name]: qty }));
  }

  function resetForm() {
    setCommon({ borrowerName: user?.name || '', startDateTime: '', endDateTime: '', reason: '' });
    setDepartment('');
    resetSelections();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage(null);

    if (!roomId) {
      setMessage({ kind: 'error', text: 'Please choose a room.' });
      return;
    }

    // Equipment is optional — only include it if the user picked any.
    const pickedItems = Object.entries(picked).map(([name, quantity]) => ({ name, quantity }));
    const payload = {
      resourceId: roomId,
      ...(pickedItems.length > 0 ? { equipment: pickedItems } : {}),
      ...common,
    };

    setSubmitting(true);
    try {
      await api.post('/reservations', payload);
      setMessage({ kind: 'success', text: 'Reservation ticket created! Awaiting admin approval.' });
      resetForm();
    } catch (err) {
      // A 409 means the room is already booked for the chosen window.
      const failKind = err.response?.status === 409 ? 'conflict' : 'error';
      setMessage({ kind: failKind, text: err.response?.data?.error || 'Failed to create reservation' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card">
      <h2>New Reservation</h2>
      <p className="muted">Fill out the form to create a reservation ticket.</p>

      <form onSubmit={handleSubmit}>
        <label>
          Borrower's Name
          <input value={common.borrowerName} onChange={updateCommon('borrowerName')} required />
        </label>

        <label>
          Department
          <select value={department} onChange={(e) => setDepartment(e.target.value)} required>
            <option value="">Select a department…</option>
            {DEPARTMENTS.map((d) => (
              <option key={d.code} value={d.code}>
                {d.label}
              </option>
            ))}
          </select>
        </label>

        {department && (
          <>
            <label>
              Room
              <select value={roomId} onChange={(e) => setRoomId(e.target.value)} required>
                <option value="">Select a room…</option>
                {roomsByFloor.map(({ floor, items }) => (
                  <optgroup key={floor} label={floor}>
                    {items.map((r) => (
                      <option key={r._id} value={r._id}>
                        {r.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>

            <fieldset className="equip-fieldset">
              <legend>Equipment (optional)</legend>
              <p className="muted hint">Add any equipment you need in the room, with quantities.</p>
              <div className="equip-list">
                {equipment.map((eq) => {
                  const checked = eq.name in picked;
                  return (
                    <div key={eq._id} className={`equip-row ${checked ? 'equip-row-on' : ''}`}>
                      <label className="equip-check">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleEquipment(eq.name)}
                        />
                        {eq.name}
                      </label>
                      {checked && (
                        <label className="equip-qty">
                          Qty
                          <input
                            type="number"
                            min="1"
                            value={picked[eq.name]}
                            onChange={(e) => setEquipmentQty(eq.name, e.target.value)}
                          />
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </fieldset>
          </>
        )}

        <div className="row">
          <label>
            Start date & time
            <input
              type="datetime-local"
              value={common.startDateTime}
              onChange={updateCommon('startDateTime')}
              required
            />
          </label>
          <label>
            End date & time
            <input
              type="datetime-local"
              value={common.endDateTime}
              onChange={updateCommon('endDateTime')}
              required
            />
          </label>
        </div>

        <label>
          Reason for reservation
          <textarea value={common.reason} onChange={updateCommon('reason')} rows={3} required />
        </label>

        {message &&
          (message.kind === 'conflict' ? (
            <div className="callout callout-conflict" role="alert">
              <strong>Scheduling conflict.</strong> {message.text}
            </div>
          ) : (
            <p className={message.kind === 'success' ? 'success' : 'error'}>{message.text}</p>
          ))}

        <button type="submit" className="btn" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit & Create Ticket'}
        </button>
      </form>
    </div>
  );
}
