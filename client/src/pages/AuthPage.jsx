import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../api/AuthContext.jsx';
import { DEMO } from '../api/client.js';

export default function AuthPage({ mode }) {
  const isLogin = mode === 'login';
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (isLogin) await login(form.email, form.password);
      else await register(form.name, form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="row justify-content-center">
      <div className="col-md-5">
        <div className="card p-4">
          <h1 className="h4 mb-1">{isLogin ? 'Welcome back' : 'Create your account'}</h1>
          <p className="text-muted small mb-4">
            {isLogin ? 'Log in to see your shopping lists.' : 'Generate smart shopping lists in seconds.'}
          </p>
          {error && <div className="alert alert-danger py-2">{error}</div>}
          {DEMO && isLogin && (
            <div className="alert alert-info py-2 small">Demo account: <strong>guest@smartcart.demo</strong> / <strong>demo</strong></div>
          )}
          <form onSubmit={submit}>
            {!isLogin && (
              <div className="mb-3">
                <label className="form-label" htmlFor="name">Name</label>
                <input id="name" className="form-control" value={form.name} onChange={update('name')} required />
              </div>
            )}
            <div className="mb-3">
              <label className="form-label" htmlFor="email">Email</label>
              <input id="email" type="email" className="form-control" value={form.email} onChange={update('email')} required />
            </div>
            <div className="mb-3">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="form-control"
                minLength={8}
                value={form.password}
                onChange={update('password')}
                required
              />
              {!isLogin && <div className="form-text">At least 8 characters.</div>}
            </div>
            <button className="btn btn-primary w-100" disabled={busy}>
              {busy ? 'Please wait…' : isLogin ? 'Log in' : 'Sign up'}
            </button>
          </form>
          <p className="small text-center mt-3 mb-0">
            {isLogin ? (
              <>No account? <Link to="/register">Sign up</Link></>
            ) : (
              <>Already registered? <Link to="/login">Log in</Link></>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
