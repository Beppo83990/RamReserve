import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import PrivacyNotice from '../components/PrivacyNotice.jsx';
import logo from '../assets/logo.png';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!consent) {
      setError('You must consent to the Data Privacy Notice to register.');
      return;
    }
    try {
      await register(form.name, form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    }
  }

  return (
    <div className="card auth-card">
      <img src={logo} alt="RamReserve" className="auth-logo" />
      <h2>Create account</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Full name
          <input value={form.name} onChange={update('name')} required />
        </label>
        <label>
          Email
          <input type="email" value={form.email} onChange={update('email')} required />
        </label>
        <label>
          Password
          <input type="password" value={form.password} onChange={update('password')} required />
        </label>
        <PrivacyNotice />
        <label className="consent-row">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>
            I have read and consent to the collection and processing of my personal data in
            accordance with the Data Privacy Act of 2012 (RA 10173).
          </span>
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" className="btn" disabled={!consent}>
          Register
        </button>
      </form>
      <p className="muted">
        Already have an account? <Link to="/login">Login</Link>
      </p>
    </div>
  );
}
