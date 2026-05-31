import { useEffect, useState } from 'react';
import api from '../api.js';
import Spinner from '../components/Spinner.jsx';

function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status}</span>;
}

function formatRange(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleString()} → ${e.toLocaleString()}`;
}

// "3× Microphone, 1× Mixer" for a ticket's optional equipment (or '' if none).
function equipmentSummary(r) {
  return (r.equipment || []).map((e) => `${e.quantity}× ${e.name}`).join(', ');
}

export default function MyReservations() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/reservations/mine')
      .then((res) => setReservations(res.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner label="Loading your reservations…" />;

  return (
    <div>
      <h2>My Reservations</h2>
      {reservations.length === 0 ? (
        <div className="empty-state">
          <p>You haven't made any reservations yet.</p>
          <p className="muted">Head to <strong>Reserve</strong> to book a room (and any equipment you need).</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Room</th>
                <th>Equipment</th>
                <th>Dept</th>
                <th>When</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {reservations.map((r) => (
                <tr key={r._id}>
                  <td>{r.resourceName}</td>
                  <td>{equipmentSummary(r) || '—'}</td>
                  <td>{r.department}</td>
                  <td>{formatRange(r.startDateTime, r.endDateTime)}</td>
                  <td>{r.reason}</td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td>{r.remarks || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
