import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import logo from '../assets/logo.png';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <nav className="navbar">
      <Link to="/" className="brand">
        <img src={logo} alt="RamReserve" className="brand-logo" />
      </Link>
      <div className="nav-links">
        {user && (
          <>
            <Link to="/">Home</Link>
            <Link to="/calendar">Calendar</Link>
            {user.role === 'user' && (
              <>
                <Link to="/reserve">Reserve</Link>
                <Link to="/my-reservations">My Reservations</Link>
              </>
            )}
            {user.role === 'admin' && <Link to="/admin">Admin Dashboard</Link>}
            <span className="nav-user">
              {user.name} ({user.role})
            </span>
            <button className="btn-link" onClick={handleLogout}>
              Logout
            </button>
          </>
        )}
        {!user && (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}
