import { useEffect, useState } from 'react';
import api from '../api.js';
import Spinner from '../components/Spinner.jsx';

const FILTERS = ['pending', 'approved', 'rejected', 'all'];

function formatRange(start, end) {
  return `${new Date(start).toLocaleString()} → ${new Date(end).toLocaleString()}`;
}

// "3× Microphone, 1× Mixer" for a ticket's optional equipment (or '' if none).
function equipmentSummary(r) {
  return (r.equipment || []).map((e) => `${e.quantity}× ${e.name}`).join(', ');
}

export default function AdminDashboard() {
  const [filter, setFilter] = useState('pending');
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [remarksById, setRemarksById] = useState({});

  function load() {
    setLoading(true);
    const params = filter === 'all' ? {} : { status: filter };
    api
      .get('/reservations', { params })
      .then((res) => setReservations(res.data))
      .finally(() => setLoading(false));
  }

  useEffect(load, [filter]);

  async function decide(id, status) {
    try {
      await api.patch(`/reservations/${id}/decision`, {
        status,
        remarks: remarksById[id] || '',
      });
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Action failed');
    }
  }

  return (
    <div>
      <h2>Admin Dashboard</h2>
      <p className="muted">Review reservation tickets, approve or reject, and add remarks.</p>

      <div className="filter-bar">
        {FILTERS.map((f) => (
          <button
            key={f}
            className={`chip ${filter === f ? 'chip-active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner label="Loading tickets…" />
      ) : reservations.length === 0 ? (
        <div className="empty-state">
          <p>No {filter === 'all' ? '' : filter} reservations.</p>
        </div>
      ) : (
        <div className="ticket-list">
          {reservations.map((r) => (
            <div className="card ticket" key={r._id}>
              <div className="ticket-head">
                <div>
                  <strong>{r.resourceName}</strong>{' '}
                  <span className="muted">
                    ({r.department}
                    {r.resource?.floor ? ` · ${r.resource.floor}` : ''})
                  </span>
                </div>
                <span className={`badge badge-${r.status}`}>{r.status}</span>
              </div>

              <div className="ticket-body">
                <p>
                  <strong>Borrower:</strong> {r.borrowerName}{' '}
                  {r.user?.email && <span className="muted">({r.user.email})</span>}
                </p>
                <p>
                  <strong>When:</strong> {formatRange(r.startDateTime, r.endDateTime)}
                </p>
                {r.equipment?.length > 0 && (
                  <p>
                    <strong>Equipment:</strong> {equipmentSummary(r)}
                  </p>
                )}
                <p>
                  <strong>Reason:</strong> {r.reason}
                </p>
                {r.remarks && (
                  <p>
                    <strong>Remarks:</strong> {r.remarks}
                  </p>
                )}
              </div>

              {r.status === 'pending' && (
                <div className="ticket-actions">
                  <input
                    placeholder="Remarks (optional)"
                    value={remarksById[r._id] || ''}
                    onChange={(e) =>
                      setRemarksById({ ...remarksById, [r._id]: e.target.value })
                    }
                  />
                  <button className="btn btn-approve" onClick={() => decide(r._id, 'approved')}>
                    Approve
                  </button>
                  <button className="btn btn-reject" onClick={() => decide(r._id, 'rejected')}>
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
