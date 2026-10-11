import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';

function safeReturnPath(value) {
  return typeof value === 'string'
    && value.startsWith('/')
    && !value.startsWith('//')
    && !value.includes('\\')
    && !/%5c/i.test(value)
    && !value.startsWith('/admin')
    ? value
    : '/';
}

export default function CustomerAuth() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, pendingAction, clearPendingAction } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const isSignup = location.pathname === '/signup';
  const returnTo = safeReturnPath(location.state?.from);

  useEffect(() => {
    if (session && (location.pathname === '/login' || location.pathname === '/signup')) {
      navigate(returnTo, { replace: true });
    }
  }, [location.pathname, navigate, returnTo, session]);

  const close = () => {
    clearPendingAction();
    navigate(returnTo, { replace: true });
  };

  const submit = async (event) => {
    event.preventDefault();
    setWorking(true);
    setError('');
    setNotice('');

    try {
      if (isSignup) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: name.trim() } },
        });
        if (signUpError) throw signUpError;
        if (data.session) navigate(returnTo, { replace: true });
        else setNotice('Check your email for a confirmation link. Your pending booking or checkout will resume after you sign in.');
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
        if (data.session) navigate(returnTo, { replace: true });
      }
    } catch (authError) {
      setError(authError.message || (isSignup ? 'Could not create your account.' : 'Could not sign in.'));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="customer-auth-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) close();
    }}>
      <section className="customer-auth-panel" role="dialog" aria-modal="true" aria-labelledby="customer-auth-title">
        <button type="button" className="customer-auth-close" onClick={close} aria-label="Close sign in">
          <X size={19} />
        </button>
        <form className="admin-auth-card customer-auth-card" onSubmit={submit}>
          <Link className="admin-brand" to="/" onClick={clearPendingAction}>GlossedBy<em>Ridhi</em></Link>
          <span className="admin-eyebrow">YOUR STUDIO ACCOUNT</span>
          <h1 id="customer-auth-title">{isSignup ? 'Create your account' : 'Welcome back'}</h1>
          <p>{isSignup ? 'Save your bookings and orders in one place.' : 'Sign in to continue with your booking or checkout.'}</p>
          {isSignup && (
            <label>
              Full name
              <input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={120} />
            </label>
          )}
          <label>
            Email
            <input autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Password
            <input autoComplete={isSignup ? 'new-password' : 'current-password'} type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={isSignup ? 6 : undefined} />
          </label>
          {error && <p className="admin-error" role="alert">{error}</p>}
          {notice && <p className="customer-auth-notice" role="status">{notice}</p>}
          {pendingAction && <p className="customer-auth-note">Your {pendingAction === 'order' ? 'checkout' : 'appointment request'} will continue after you sign in.</p>}
          <button className="btn full" disabled={working}>{working ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'}</button>
          <p className="customer-auth-switch">
            {isSignup ? 'Already have an account?' : 'New to GlossedByRidhi?'}{' '}
            <Link to={isSignup ? '/login' : '/signup'} state={{ from: returnTo }}>
              {isSignup ? 'Sign in' : 'Create an account'}
            </Link>
          </p>
          <Link className="admin-back-link" to="/admin/login">Administrator sign in</Link>
        </form>
      </section>
    </div>
  );
}
