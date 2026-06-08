import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const steps = [
  { n: 1, title: 'Choose a department', text: 'Pick BMO for rooms & events, or ITRO for technical equipment.' },
  { n: 2, title: 'Select what you need', text: 'Browse the catalog and choose the room, facility, or equipment.' },
  { n: 3, title: 'Fill out the form', text: 'Enter the borrower, the date & time, and your reason for reserving.' },
  { n: 4, title: 'Submit your ticket', text: 'Your request becomes a pending ticket awaiting admin approval.' },
  { n: 5, title: 'Get approval', text: 'An admin reviews it, approves or rejects, and may add remarks.' },
];

const departments = [
  {
    code: 'BMO',
    name: 'Building Management Office',
    blurb: 'Rooms, Facilities (Laboratories, Foley Studios, Multipurpose Halls), Gym, Court, Auditorium.',
  },
  {
    code: 'ITRO',
    name: 'Information Technology Resource Office',
    blurb: 'Computers, Peripherals (Camera, Microphone, Audio Output), Projectors.',
  },
];

export default function Home() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <div>
      <section className="hero">
        <h1>Welcome to RamReserve, {user?.name}</h1>
        <p className="muted">
          Reserve facilities, equipment, and rooms for your events — all in one place.
        </p>
      </section>

      <h2>How reservation works</h2>
      <div className="steps">
        {steps.map((s) => (
          <div className="step" key={s.n}>
            <div className="step-num">{s.n}</div>
            <div>
              <strong>{s.title}</strong>
              <p className="muted">{s.text}</p>
            </div>
          </div>
        ))}
      </div>

      {!isAdmin && (
        <>
          <h2>Reserve from a department</h2>
          <div className="dept-grid">
            {departments.map((d) => (
              <Link to="/reserve" key={d.code} className="card dept-card">
                <h3>
                  {d.code} <span className="muted">— {d.name}</span>
                </h3>
                <p className="muted">{d.blurb}</p>
                <span className="btn">Reserve now →</span>
              </Link>
            ))}
          </div>
        </>
      )}

      {isAdmin && (
        <p>
          You are signed in as an admin. Head to the{' '}
          <Link to="/admin">Admin Dashboard</Link> to review pending tickets.
        </p>
      )}
    </div>
  );
}
