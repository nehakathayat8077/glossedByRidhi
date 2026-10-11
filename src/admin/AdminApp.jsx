import { useState } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import AdminLayout from './AdminLayout';

function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setWorking(true);
    setError('');
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) setError(signInError.message);
    } catch (signInError) {
      setError(signInError.message || 'Sign in failed. Please try again.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <main className="admin-auth">
      <form className="admin-auth-card" onSubmit={submit}>
        <Link className="admin-brand" to="/">GlossedBy<em>Ridhi</em></Link>
        <span className="admin-eyebrow">BUSINESS PORTAL</span>
        <h1>Welcome back</h1>
        <p>Sign in with your administrator account to manage your studio.</p>
        <label>
          Email
          <input autoComplete="username" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label>
          Password
          <input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </label>
        {error && <p className="admin-error" role="alert">{error}</p>}
        <button className="btn full" disabled={working}>{working ? 'Signing in…' : 'Sign in securely'}</button>
        <Link className="admin-back-link" to="/">← Return to the website</Link>
      </form>
    </main>
  );
}

function AccessDenied() {
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);

  const signOut = async () => {
    setWorking(true);
    setError('');
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) setError(signOutError.message);
    } catch (signOutError) {
      setError(signOutError.message || 'Could not sign out. Please try again.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <main className="admin-auth">
      <div className="admin-auth-card">
        <span className="admin-eyebrow">ACCESS RESTRICTED</span>
        <h1>Administrator access required</h1>
        <p>This signed-in account is not assigned the admin role.</p>
        {error && <p className="admin-error" role="alert">{error}</p>}
        <button className="btn full" onClick={signOut} disabled={working}>{working ? 'Signing out…' : 'Sign out'}</button>
        <Link className="admin-back-link" to="/">← Return to the website</Link>
      </div>
    </main>
  );
}

function AdminGate() {
  const { session, loading, error } = useAuth();
  const location = useLocation();

  if (loading) return <div className="admin-state">Checking your secure session…</div>;
  if (error) return <div className="admin-state admin-error" role="alert">{error}</div>;

  const isLoginRoute = location.pathname === '/admin/login';

  if (!session) {
    return isLoginRoute
      ? <SignIn />
      : <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }

  if (session.user.app_metadata?.role !== 'admin') return <AccessDenied />;
  if (isLoginRoute) {
    const requestedPath = location.state?.from;
    const destination = typeof requestedPath === 'string'
      && requestedPath.startsWith('/admin/')
      && requestedPath !== '/admin/login'
      ? requestedPath
      : '/admin';
    return <Navigate to={destination} replace />;
  }

  return <AdminLayout />;
}

export default function AdminApp() {
  return (
    <AuthProvider>
      <AdminGate />
    </AuthProvider>
  );
}
