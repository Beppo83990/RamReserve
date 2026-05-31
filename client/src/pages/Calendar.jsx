import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api.js';
import Spinner from '../components/Spinner.jsx';

const DEPARTMENTS = [
  { code: '', label: 'All departments' },
  { code: 'BMO', label: 'BMO — Rooms / Facilities' },
  { code: 'ITRO', label: 'ITRO — Technical Equipment' },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKS = 4;
const POLL_MS = 30000; // refresh every 30s so both clients stay "live"
const MAX_CHIPS = 3; // events shown per day before collapsing into "+N more"

function startOfWeek(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - x.getDay());
  return x;
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function fmtTime(d) {
  return new Date(d).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
// Local "YYYY-MM-DD" for a Date — matches the closures admins set on the grid.
const toYMD = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function Calendar() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [department, setDepartment] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [resourceOptions, setResourceOptions] = useState([]); // for the resource dropdown
  const [reservations, setReservations] = useState([]);
  const [closures, setClosures] = useState([]); // [{ resource, day }]
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [error, setError] = useState(null);

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);
  const gridStart = useMemo(() => startOfWeek(today), [today]);
  const days = useMemo(
    () => Array.from({ length: WEEKS * 7 }, (_, i) => addDays(gridStart, i)),
    [gridStart]
  );

  const selectedResource = useMemo(
    () => resourceOptions.find((r) => r._id === resourceId) || null,
    [resourceOptions, resourceId]
  );

  // Order rooms by floor number (so "2nd Floor" precedes "10th Floor"), then name.
  const sortedRooms = useMemo(
    () =>
      [...resourceOptions].sort(
        (a, b) => (parseInt(a.floor, 10) || 0) - (parseInt(b.floor, 10) || 0) || a.name.localeCompare(b.name)
      ),
    [resourceOptions]
  );

  // Populate the resource dropdown from the chosen department (mirrors Reserve).
  // Picking a department first keeps the list manageable.
  useEffect(() => {
    if (!department) {
      setResourceOptions([]);
      setResourceId('');
      return;
    }
    api
      .get('/resources', { params: { department, kind: 'room' } })
      .then((res) => setResourceOptions(res.data))
      .catch(() => setResourceOptions([]));
    setResourceId('');
  }, [department]);

  // Load reservations for the current filters. `silent` skips the spinner so
  // background polling doesn't flicker the grid.
  function load(silent) {
    if (!silent) setLoading(true);
    api
      .get('/reservations/calendar', {
        params: {
          department: department || undefined,
          resourceId: resourceId || undefined,
          weeks: WEEKS,
        },
      })
      .then((res) => {
        setReservations(res.data.reservations);
        setClosures(res.data.closures || []);
        setUpdatedAt(new Date());
        setError(null);
      })
      .catch(() => setError('Could not load the calendar. Is the server running?'))
      .finally(() => setLoading(false));
  }

  // Reload immediately on filter change, then poll on an interval.
  useEffect(() => {
    load(false);
    const id = setInterval(() => load(true), POLL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [department, resourceId]);

  function eventsForDay(day) {
    const dayStart = day;
    const dayEnd = addDays(day, 1);
    return reservations.filter(
      (r) => new Date(r.startDateTime) < dayEnd && new Date(r.endDateTime) > dayStart
    );
  }

  // Closed day-labels for the currently selected room.
  const closedDays = useMemo(
    () => new Set(closures.filter((c) => c.resource === resourceId).map((c) => c.day)),
    [closures, resourceId]
  );

  // Admin: flip a day's availability for the selected room, then refresh.
  async function toggleClosed(day) {
    if (!isAdmin || !selectedResource) return;
    const ymd = toYMD(day);
    try {
      await api.patch('/availability', { resourceId, day: ymd, available: closedDays.has(ymd) });
      load(true);
    } catch {
      setError('Could not update availability.');
    }
  }

  return (
    <div>
      <div className="cal-header">
        <div>
          <h2>Availability Calendar</h2>
          <p className="muted">
            Reserved vs. available across the next {WEEKS} weeks. Updates automatically.
          </p>
        </div>
        <div className="cal-live">
          <span className="live-dot" />
          Live{updatedAt && ` · updated ${updatedAt.toLocaleTimeString()}`}
        </div>
      </div>

      <div className="card cal-controls">
        <label>
          Department
          <select value={department} onChange={(e) => setDepartment(e.target.value)}>
            {DEPARTMENTS.map((d) => (
              <option key={d.code} value={d.code}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
        {department && (
          <label>
            Specific room
            <select value={resourceId} onChange={(e) => setResourceId(e.target.value)}>
              <option value="">All rooms in this department</option>
              {sortedRooms.map((r) => (
                <option key={r._id} value={r._id}>
                  {r.name}
                  {r.floor ? ` — ${r.floor}` : ''}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="cal-legend">
        {selectedResource ? (
          <>
            <span><span className="dot dot-available" /> Available</span>
            <span><span className="dot dot-partial" /> Partly reserved</span>
            <span><span className="dot dot-full" /> Fully reserved</span>
            <span><span className="dot dot-closed" /> Closed</span>
            {isAdmin && <span className="cal-admin-hint">Click a day to open/close it for bookings</span>}
          </>
        ) : (
          <>
            <span><span className="dot dot-approved" /> Approved</span>
            <span><span className="dot dot-pending" /> Pending</span>
          </>
        )}
      </div>

      {error && <p className="error">{error}</p>}
      {loading ? (
        <Spinner label="Loading calendar…" />
      ) : (
        <div className="calendar-grid">
          {WEEKDAYS.map((w) => (
            <div key={w} className="cal-weekday">
              {w}
            </div>
          ))}
          {days.map((day) => {
            const evts = eventsForDay(day);
            const isToday = sameDay(day, today);
            const isPast = day < today;

            // When a single resource is selected, summarize the day as
            // available / partly / fully reserved against its quantity.
            let availability = null;
            if (selectedResource) {
              const qty = selectedResource.quantity || 1;
              if (closedDays.has(toYMD(day))) availability = { cls: 'closed', label: 'Closed' };
              else if (evts.length === 0) availability = { cls: 'available', label: 'Available' };
              else if (evts.length >= qty)
                availability = { cls: 'full', label: qty > 1 ? `Full (${evts.length}/${qty})` : 'Reserved' };
              else availability = { cls: 'partial', label: `${evts.length}/${qty} reserved` };
            }
            const canToggle = isAdmin && !!selectedResource;

            return (
              <div
                key={day.toISOString()}
                className={[
                  'cal-day',
                  isToday ? 'cal-today' : '',
                  isPast ? 'cal-past' : '',
                  availability ? `cal-day-${availability.cls}` : '',
                  canToggle ? 'cal-day-clickable' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={canToggle ? () => toggleClosed(day) : undefined}
                title={
                  canToggle
                    ? closedDays.has(toYMD(day))
                      ? 'Click to reopen this day'
                      : 'Click to close this day'
                    : undefined
                }
              >
                <div className="cal-day-top">
                  <span className="cal-date">{day.getDate()}</span>
                  {day.getDate() === 1 && (
                    <span className="cal-month">
                      {day.toLocaleDateString([], { month: 'short' })}
                    </span>
                  )}
                </div>

                {availability ? (
                  <div className="cal-day-body">
                    <span className={`avail-badge avail-${availability.cls}`}>
                      {availability.label}
                    </span>
                    {evts.map((r) => (
                      <div key={r._id} className="cal-time" title={`${r.borrowerName} · ${r.status}`}>
                        {fmtTime(r.startDateTime)}–{fmtTime(r.endDateTime)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="cal-day-body">
                    {evts.slice(0, MAX_CHIPS).map((r) => (
                      <div
                        key={r._id}
                        className={`cal-event cal-event-${r.status}`}
                        title={`${r.resourceName} · ${fmtTime(r.startDateTime)}–${fmtTime(
                          r.endDateTime
                        )} · ${r.borrowerName} · ${r.status}`}
                      >
                        <span className="cal-event-name">{r.resourceName}</span>
                        <span className="cal-event-time">{fmtTime(r.startDateTime)}</span>
                      </div>
                    ))}
                    {evts.length > MAX_CHIPS && (
                      <div className="cal-more">+{evts.length - MAX_CHIPS} more</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
