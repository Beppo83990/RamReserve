import { useEffect, useMemo, useState } from 'react';
import api from '../api.js';
import Spinner from '../components/Spinner.jsx';

const FILTERS = ['pending', 'approved', 'rejected', 'all'];

const DEPARTMENTS = [
  { code: '', label: 'All departments' },
  { code: 'BMO', label: 'BMO — Rooms / Facilities' },
  { code: 'ITRO', label: 'ITRO — Technical Equipment' },
];
const DEPT_ORDER = ['BMO', 'ITRO'];

function formatRange(start, end) {
  return `${new Date(start).toLocaleString()} → ${new Date(end).toLocaleString()}`;
}

// Order floors by their leading number ("2nd Floor" before "10th Floor").
const floorRank = (f) => parseInt(f, 10) || 0;

// "3× Microphone, 1× Mixer" for a ticket's optional equipment (or '' if none).
function equipmentSummary(r) {
  return (r.equipment || []).map((e) => `${e.quantity}× ${e.name}`).join(', ');
}

export default function AdminDashboard() {
  const [filter, setFilter] = useState('pending');
  const [department, setDepartment] = useState('');
  const [floor, setFloor] = useState('');
  const [room, setRoom] = useState('');
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [remarksById, setRemarksById] = useState({});
  const [collapsed, setCollapsed] = useState(() => new Set());

  // Status + department are server-side filters; floor + room are applied on
  // the client over the loaded set, so changing them doesn't refetch.
  function load() {
    setLoading(true);
    const params = {};
    if (filter !== 'all') params.status = filter;
    if (department) params.department = department;
    api
      .get('/reservations', { params })
      .then((res) => setReservations(res.data))
      .finally(() => setLoading(false));
  }

  useEffect(load, [filter, department]);

  function changeDepartment(value) {
    setDepartment(value);
    setFloor('');
    setRoom('');
  }
  function changeFloor(value) {
    setFloor(value);
    setRoom('');
  }

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

  function toggleDept(dept) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(dept) ? next.delete(dept) : next.add(dept);
      return next;
    });
  }

  // Floor / room dropdown options, derived from the loaded tickets (so you only
  // ever filter to categories that actually have tickets in view).
  const floorOptions = useMemo(() => {
    const set = new Set();
    for (const r of reservations) if (r.resource?.floor) set.add(r.resource.floor);
    return [...set].sort((a, b) => floorRank(a) - floorRank(b));
  }, [reservations]);

  const roomOptions = useMemo(() => {
    const set = new Set();
    for (const r of reservations) {
      if (floor && r.resource?.floor !== floor) continue;
      if (r.resourceName) set.add(r.resourceName);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [reservations, floor]);

  const visible = useMemo(
    () =>
      reservations.filter(
        (r) =>
          (!floor || r.resource?.floor === floor) && (!room || r.resourceName === room)
      ),
    [reservations, floor, room]
  );

  // Group the visible tickets by department; within a department, order by
  // floor then room name.
  const groups = useMemo(() => {
    const byDept = {};
    for (const r of visible) (byDept[r.department] ??= []).push(r);
    for (const list of Object.values(byDept)) {
      list.sort(
        (a, b) =>
          floorRank(a.resource?.floor) - floorRank(b.resource?.floor) ||
          (a.resourceName || '').localeCompare(b.resourceName || '')
      );
    }
    const order = [
      ...DEPT_ORDER.filter((d) => byDept[d]),
      ...Object.keys(byDept).filter((d) => !DEPT_ORDER.includes(d)),
    ];
    return order.map((dept) => ({ dept, items: byDept[dept] }));
  }, [visible]);

  return (
    <div>
      <h2>Admin Dashboard</h2>
      <p className="muted">Review reservation tickets, approve or reject, and add remarks.</p>

      <div className="admin-controls">
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

        <div className="admin-filters">
          <label>
            Department
            <select value={department} onChange={(e) => changeDepartment(e.target.value)}>
              {DEPARTMENTS.map((d) => (
                <option key={d.code} value={d.code}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Floor
            <select
              value={floor}
              onChange={(e) => changeFloor(e.target.value)}
              disabled={floorOptions.length === 0}
            >
              <option value="">All floors</option>
              {floorOptions.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>
          <label>
            Room
            <select
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              disabled={roomOptions.length === 0}
            >
              <option value="">All rooms</option>
              {roomOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {loading ? (
        <Spinner label="Loading tickets…" />
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <p>
            No {filter === 'all' ? '' : filter} reservations
            {department ? ` in ${department}` : ''}
            {room ? ` for ${room}` : floor ? ` on ${floor}` : ''}.
          </p>
        </div>
      ) : (
        groups.map(({ dept, items }) => {
          const isCollapsed = collapsed.has(dept);
          return (
            <section key={dept} className="ticket-group">
              <button
                type="button"
                className="ticket-group-head"
                aria-expanded={!isCollapsed}
                onClick={() => toggleDept(dept)}
              >
                <span className={`ticket-group-toggle ${isCollapsed ? 'is-collapsed' : ''}`}>▾</span>
                <h3>{dept}</h3>
                <span className="ticket-group-count">
                  {items.length} ticket{items.length !== 1 ? 's' : ''}
                </span>
              </button>

              {!isCollapsed && (
                <div className="ticket-list">
                  {items.map((r) => (
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
                        {r.createdAt && (
                          <p className="ticket-submitted muted">
                            Submitted {new Date(r.createdAt).toLocaleString()}
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
            </section>
          );
        })
      )}
    </div>
  );
}
