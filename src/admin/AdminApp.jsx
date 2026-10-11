import { useState } from 'react';
import { Route, Routes } from 'react-router-dom';
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
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) setError(signInError.message);
    setWorking(false);
  };

  return (
    <main className="admin-auth">
      <form className="admin-auth-card" onSubmit={submit}>
        <a className="admin-brand" href="/">GlossedBy<em>Ridhi</em></a>
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
        <a className="admin-back-link" href="/">← Return to the website</a>
      </form>
    </main>
  );
}

function AdminGate() {
  const { session, loading, error } = useAuth();

  if (loading) return <div className="admin-state">Checking your secure session…</div>;
  if (error) return <div className="admin-state admin-error" role="alert">{error}</div>;
  if (!session) return <SignIn />;

  if (session.user.app_metadata?.role !== 'admin') {
    return (
      <main className="admin-auth">
        <div className="admin-auth-card">
          <span className="admin-eyebrow">ACCESS RESTRICTED</span>
          <h1>Administrator access required</h1>
          <p>This signed-in account is not assigned the admin role.</p>
          <button className="btn full" onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </main>
    );
  }

  return (
    <Routes>
      <Route path="*" element={<AdminLayout />} />
    </Routes>
  );
}

export default function AdminApp() {
  return (
    <AuthProvider>
      <AdminGate />
    </AuthProvider>
  );
}
