import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Circle,
  Clock3,
  CreditCard,
  KeyRound,
  LogOut,
  Package,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRound,
  XCircle,
} from 'lucide-react';
import Navbar from './Navbar';
import Footer from './Footer';
import CartDrawer from './CartDrawer';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { ORDER_HISTORY_CHANGED_EVENT } from '../lib/orders';

const tabs = [
  { id: 'overview', label: 'Overview', icon: Sparkles },
  { id: 'orders', label: 'My Orders', icon: Package },
  { id: 'appointments', label: 'My Appointments', icon: CalendarDays },
  { id: 'profile', label: 'Profile', icon: UserRound },
];

const orderTimeline = ['new', 'paid', 'shipped', 'delivered'];
const activeAppointmentStatuses = ['pending', 'confirmed'];

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(value, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return value ? new Date(value).toLocaleDateString('en-IN', options) : '—';
}

function formatDateTime(value) {
  return value
    ? new Date(value).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
    : '—';
}

function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

function paymentMethodLabel(value) {
  if (value === 'cod') return 'Cash on Delivery';
  if (value === 'qr_whatsapp') return 'QR / WhatsApp';
  return 'Not recorded';
}

function paymentStatusLabel(value) {
  if (value === 'paid') return 'Paid';
  if (value === 'pending') return 'Payment pending';
  if (value === 'failed') return 'Payment failed';
  if (value === 'refunded') return 'Refunded';
  return 'Status unavailable';
}

function AccountPanel({ title, action, children, className = '' }) {
  return (
    <section className={`customer-dashboard-panel ${className}`}>
      <div className="customer-dashboard-panel-heading">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="customer-dashboard-empty">
      <span><Icon size={22} /></span>
      <strong>{title}</strong>
      <p>{children}</p>
    </div>
  );
}

function OrderTimeline({ status }) {
  const current = String(status || '').toLowerCase();
  const currentStep = orderTimeline.indexOf(current);

  if (current === 'cancelled') {
    return (
      <div className="customer-order-timeline cancelled" aria-label="Order cancelled">
        <XCircle size={17} />
        <span>This order was cancelled.</span>
      </div>
    );
  }

  return (
    <ol className="customer-order-timeline" aria-label={`Order status: ${current || 'unavailable'}`}>
      {orderTimeline.map((step, index) => {
        const complete = currentStep >= 0 && index <= currentStep;
        const Icon = complete ? CheckCircle2 : Circle;
        return (
          <li className={complete ? 'complete' : ''} key={step}>
            <Icon size={16} />
            <span>{step[0].toUpperCase() + step.slice(1)}</span>
          </li>
        );
      })}
    </ol>
  );
}

function OrderCard({ order }) {
  const items = Array.isArray(order.items) ? order.items : [];

  return (
    <article className="customer-dashboard-record">
      <div className="customer-dashboard-record-heading">
        <div>
          <span className="admin-eyebrow">ORDER · {formatDate(order.created_at)}</span>
          <h3>#{order.id}</h3>
        </div>
        <span className={`admin-badge status-${order.status}`}>{order.status || 'new'}</span>
      </div>
      <div className="customer-dashboard-items">
        {items.map((item, index) => (
          <p key={`${item.id || item.name}-${index}`}>
            <span>{item.name || 'Product'} × {item.qty ?? item.quantity ?? 1}</span>
            <span>{formatCurrency(item.line_total ?? (item.unit_price ?? item.price ?? 0) * (item.qty ?? item.quantity ?? 1))}</span>
          </p>
        ))}
        {!items.length && <p className="customer-account-muted">Product details are not available for this order.</p>}
      </div>
      <div className="customer-dashboard-order-meta">
        <p><CreditCard size={15} /><span>{paymentMethodLabel(order.payment_method)}</span></p>
        <p><ShieldCheck size={15} /><span>{paymentStatusLabel(order.payment_status)}</span></p>
        <p className="customer-dashboard-total"><strong>Total</strong><strong>{formatCurrency(order.total)}</strong></p>
      </div>
      <OrderTimeline status={order.status} />
      <p className="customer-account-muted customer-payment-note">
        Payment is never confirmed automatically. Contact the studio if your payment status needs an update.
      </p>
    </article>
  );
}

function AppointmentCard({ appointment }) {
  return (
    <article className="customer-dashboard-record">
      <div className="customer-dashboard-record-heading">
        <div>
          <span className="admin-eyebrow">APPOINTMENT · BOOKED {formatDate(appointment.created_at)}</span>
          <h3>{appointment.service_name || 'Studio appointment'}</h3>
        </div>
        <span className={`admin-badge status-${appointment.status}`}>{appointment.status}</span>
      </div>
      <div className="customer-dashboard-appointment-meta">
        <p><strong>Design</strong><span>{appointment.design_title || 'No design selected'}</span></p>
        <p><strong>Date</strong><span>{formatDate(appointment.appointment_date)}</span></p>
        <p><strong>Time</strong><span>{appointment.time_slot?.slice(0, 5) || '—'}</span></p>
      </div>
      {appointment.notes && <p className="customer-dashboard-notes"><strong>Your notes</strong>{appointment.notes}</p>}
    </article>
  );
}

function CustomerAccount() {
  const { session, loading: authLoading, error: authError } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [orders, setOrders] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profileUserId, setProfileUserId] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const user = session?.user;
  const today = localDateString();

  useEffect(() => {
    if (!user?.id) {
      setProfileUserId(null);
      setProfileName('');
      setProfilePhone('');
      return undefined;
    }

    let active = true;
    setProfileUserId(null);
    setProfileName('');
    setProfilePhone('');
    setProfileError('');
    setProfileLoading(true);

    supabase.auth.getUser().then(({ data, error: profileLoadError }) => {
      if (!active) return;
      if (profileLoadError) throw profileLoadError;
      if (data.user?.id !== user.id) {
        throw new Error('The current profile does not match the signed-in account.');
      }

      const currentMetadata = data.user.user_metadata || {};
      setProfileName(currentMetadata.full_name || currentMetadata.name || '');
      setProfilePhone(currentMetadata.phone || currentMetadata.phone_number || '');
      setProfileUserId(user.id);
    }).catch((profileLoadError) => {
      if (!active) return;
      setProfileError(profileLoadError.message || 'Could not load your profile details.');
    }).finally(() => {
      if (active) setProfileLoading(false);
    });

    return () => {
      active = false;
    };
  }, [user?.id]);

  const loadHistory = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError('');
    try {
      const [ordersResult, appointmentsResult] = await Promise.all([
        supabase
          .from('orders')
          .select('id, items, total, status, payment_method, payment_status, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('appointments')
          .select('id, service_id, design_id, appointment_date, time_slot, notes, status, created_at')
          .eq('user_id', user.id)
          .order('appointment_date', { ascending: false })
          .order('time_slot', { ascending: false }),
      ]);
      if (ordersResult.error) throw ordersResult.error;
      if (appointmentsResult.error) throw appointmentsResult.error;

      const appointmentRows = appointmentsResult.data || [];
      const serviceIds = [...new Set(appointmentRows.map((row) => row.service_id).filter(Boolean))];
      const designIds = [...new Set(appointmentRows.map((row) => row.design_id).filter(Boolean))];
      const [servicesResult, designsResult] = await Promise.all([
        serviceIds.length
          ? supabase.from('services').select('id, name').in('id', serviceIds)
          : Promise.resolve({ data: [], error: null }),
        designIds.length
          ? supabase.from('designs').select('id, title').in('id', designIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (servicesResult.error) throw servicesResult.error;
      if (designsResult.error) throw designsResult.error;

      const serviceNames = new Map((servicesResult.data || []).map((row) => [row.id, row.name]));
      const designNames = new Map((designsResult.data || []).map((row) => [row.id, row.title]));
      setOrders(ordersResult.data || []);
      setAppointments(appointmentRows.map((row) => ({
        ...row,
        service_name: serviceNames.get(row.service_id) || '',
        design_title: designNames.get(row.design_id) || '',
      })));
    } catch (loadError) {
      setError(loadError.message || 'Could not load your account history.');
      setOrders([]);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) void loadHistory();
  }, [loadHistory, user?.id]);

  useEffect(() => {
    if (!user?.id) return undefined;

    let refreshTimer;
    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void loadHistory(), 50);
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') scheduleRefresh();
    };

    window.addEventListener(ORDER_HISTORY_CHANGED_EVENT, scheduleRefresh);
    window.addEventListener('focus', scheduleRefresh);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      window.clearTimeout(refreshTimer);
      window.removeEventListener(ORDER_HISTORY_CHANGED_EVENT, scheduleRefresh);
      window.removeEventListener('focus', scheduleRefresh);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [loadHistory, user?.id]);

  const upcomingAppointments = useMemo(() => appointments
    .filter((appointment) => appointment.appointment_date >= today
      && activeAppointmentStatuses.includes(appointment.status))
    .sort((left, right) => `${left.appointment_date}T${left.time_slot}`.localeCompare(`${right.appointment_date}T${right.time_slot}`)),
  [appointments, today]);
  const pastAppointments = useMemo(() => appointments.filter((appointment) =>
    appointment.appointment_date < today || !activeAppointmentStatuses.includes(appointment.status),
  ), [appointments, today]);
  const completedAppointments = appointments.filter((appointment) => appointment.status === 'completed').length;
  const nextAppointment = upcomingAppointments[0];

  const saveProfile = async (event) => {
    event.preventDefault();
    if (profileName.trim().length < 2) {
      setProfileError('Enter a name with at least 2 characters.');
      return;
    }
    setSavingProfile(true);
    setProfileMessage('');
    setProfileError('');
    try {
      const { data, error: updateError } = await supabase.auth.updateUser({
        data: { full_name: profileName.trim(), phone: profilePhone.trim() },
      });
      if (updateError) throw updateError;
      if (data.user?.id !== user?.id) {
        throw new Error('The saved profile does not match the signed-in account.');
      }
      setProfileName(data.user.user_metadata?.full_name || '');
      setProfilePhone(data.user.user_metadata?.phone || '');
      setProfileUserId(user.id);
      setProfileMessage('Your profile details have been saved.');
    } catch (updateError) {
      setProfileError(updateError.message || 'Could not update your profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    setPasswordMessage('');
    setPasswordError('');
    if (newPassword.length < 8) {
      setPasswordError('Choose a password with at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('The password confirmation does not match.');
      return;
    }
    setSavingPassword(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMessage('Your password has been changed.');
    } catch (updateError) {
      setPasswordError(updateError.message || 'Could not change your password.');
    } finally {
      setSavingPassword(false);
    }
  };

  const signOut = async () => {
    setSigningOut(true);
    setSignOutError('');
    try {
      const { error: authError } = await supabase.auth.signOut();
      if (authError) setSignOutError(authError.message);
    } catch (authError) {
      setSignOutError(authError.message || 'Could not sign out. Please try again.');
    } finally {
      setSigningOut(false);
    }
  };
  const visibleProfileName = profileUserId === user?.id ? profileName : '';
  const visibleProfilePhone = profileUserId === user?.id ? profilePhone : '';
  const visibleFirstName = visibleProfileName.trim().split(/\s+/)[0] || 'there';

  if (authLoading) return <main className="customer-account-state">Checking your account…</main>;
  if (!user) return <Navigate to="/login" replace state={{ from: '/account' }} />;

  return (
    <>
      <Navbar />
      <main className="customer-dashboard wrap">
        <header className="customer-dashboard-header">
          <div>
            <span className="admin-eyebrow">YOUR GLOSSEDBYRIDHI ACCOUNT</span>
            <h1>Welcome back, {visibleFirstName}<span>✦</span></h1>
            <p>Your orders, appointments, and personal details, all in one place.</p>
          </div>
          <div className="customer-account-actions">
            <Link className="admin-secondary-button" to="/">Back to the studio</Link>
            <button className="admin-secondary-button" onClick={signOut} disabled={signingOut}>
              <LogOut size={16} />{signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </header>

        <nav className="customer-dashboard-tabs" aria-label="Account sections" role="tablist">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              aria-selected={activeTab === id}
              className={activeTab === id ? 'active' : ''}
              id={`customer-tab-${id}`}
              key={id}
              onClick={() => setActiveTab(id)}
              role="tab"
              type="button"
            >
              <Icon size={17} />{label}
            </button>
          ))}
        </nav>

        {authError && <div className="admin-alert" role="alert">{authError}</div>}
        {signOutError && <div className="admin-alert" role="alert">{signOutError}</div>}
        {error && (
          <div className="admin-alert" role="alert">
            <span>{error}</span>
            <button className="admin-secondary-button" onClick={() => void loadHistory()} disabled={loading}>
              <RefreshCw size={15} /> Retry
            </button>
          </div>
        )}

        <div className="customer-dashboard-content" role="tabpanel" aria-labelledby={`customer-tab-${activeTab}`}>
          {activeTab === 'overview' && (
            <>
              <section className="customer-dashboard-stats" aria-label="Account summary">
                <button className="customer-dashboard-stat" onClick={() => setActiveTab('orders')}>
                  <span className="customer-dashboard-stat-icon rose"><Package size={19} /></span>
                  <span>Total orders</span><strong>{loading ? '—' : orders.length}</strong>
                  <small>View your purchases <ArrowRight size={13} /></small>
                </button>
                <button className="customer-dashboard-stat" onClick={() => setActiveTab('appointments')}>
                  <span className="customer-dashboard-stat-icon gold"><CalendarDays size={19} /></span>
                  <span>Upcoming appointments</span><strong>{loading ? '—' : upcomingAppointments.length}</strong>
                  <small>See your bookings <ArrowRight size={13} /></small>
                </button>
                <button className="customer-dashboard-stat" onClick={() => setActiveTab('appointments')}>
                  <span className="customer-dashboard-stat-icon green"><CheckCircle2 size={19} /></span>
                  <span>Completed appointments</span><strong>{loading ? '—' : completedAppointments}</strong>
                  <small>Your studio visits <ArrowRight size={13} /></small>
                </button>
              </section>

              <div className="customer-dashboard-overview-grid">
                <AccountPanel
                  title="Recent orders"
                  action={<button className="customer-dashboard-text-link" onClick={() => setActiveTab('orders')}>All orders <ArrowRight size={15} /></button>}
                >
                  {loading ? <p className="customer-account-muted">Loading your orders…</p>
                    : orders.length ? <div className="customer-dashboard-list">{orders.slice(0, 3).map((order) => (
                      <div className="customer-dashboard-compact-order" key={order.id}>
                        <span className="customer-dashboard-compact-icon"><Package size={17} /></span>
                        <span><strong>Order #{order.id.slice(0, 8)}</strong><small>{formatDate(order.created_at)} · {formatCurrency(order.total)}</small></span>
                        <span className={`admin-badge status-${order.status}`}>{order.status}</span>
                      </div>
                    ))}</div>
                      : <EmptyState icon={Package} title="No orders yet">Your future purchases will appear here.</EmptyState>}
                </AccountPanel>

                <AccountPanel
                  title="Next appointment"
                  action={<button className="customer-dashboard-text-link" onClick={() => setActiveTab('appointments')}>All bookings <ArrowRight size={15} /></button>}
                >
                  {loading ? <p className="customer-account-muted">Loading your appointments…</p>
                    : nextAppointment ? (
                      <div className="customer-dashboard-next-appointment">
                        <span className="customer-dashboard-next-icon"><CalendarDays size={21} /></span>
                        <div>
                          <span className="admin-eyebrow">{formatDate(nextAppointment.appointment_date)}</span>
                          <h3>{nextAppointment.service_name || 'Studio appointment'}</h3>
                          <p>{nextAppointment.time_slot?.slice(0, 5) || 'Time not set'} · {nextAppointment.design_title || 'No design selected'}</p>
                          <span className={`admin-badge status-${nextAppointment.status}`}>{nextAppointment.status}</span>
                        </div>
                      </div>
                    ) : <EmptyState icon={CalendarDays} title="No upcoming appointments">Book a studio visit whenever you are ready.</EmptyState>}
                </AccountPanel>
              </div>
            </>
          )}

          {activeTab === 'orders' && (
            <AccountPanel title="My orders" className="customer-dashboard-full-panel">
              {loading ? <p className="customer-account-muted">Loading your orders…</p>
                : orders.length ? <div className="customer-dashboard-record-list">{orders.map((order) => <OrderCard key={order.id} order={order} />)}</div>
                  : <EmptyState icon={Package} title="No orders yet">Browse the shop to find your next favourite set.</EmptyState>}
            </AccountPanel>
          )}

          {activeTab === 'appointments' && (
            <div className="customer-dashboard-appointment-sections">
              <AccountPanel title="Upcoming appointments" className="customer-dashboard-full-panel">
                {loading ? <p className="customer-account-muted">Loading your appointments…</p>
                  : upcomingAppointments.length ? <div className="customer-dashboard-record-list">{upcomingAppointments.map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} />)}</div>
                    : <EmptyState icon={CalendarDays} title="No upcoming appointments">Your upcoming bookings will appear here.</EmptyState>}
              </AccountPanel>
              <AccountPanel title="Past appointments" className="customer-dashboard-full-panel">
                {loading ? <p className="customer-account-muted">Loading your appointments…</p>
                  : pastAppointments.length ? <div className="customer-dashboard-record-list">{pastAppointments.map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} />)}</div>
                    : <EmptyState icon={Clock3} title="No past appointments">Completed and previous bookings will appear here.</EmptyState>}
              </AccountPanel>
              <p className="customer-dashboard-footnote">Appointment details are read-only here. Contact the studio directly if a change is needed; only the studio can update booking status.</p>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="customer-dashboard-profile-grid">
              <AccountPanel title="Personal details">
                <form className="customer-dashboard-form" onSubmit={saveProfile}>
                  <label className="admin-field">Full name
                    <input autoComplete="name" disabled={profileLoading} maxLength={120} minLength={2} onChange={(event) => setProfileName(event.target.value)} required value={visibleProfileName} />
                  </label>
                  <label className="admin-field">Email
                    <input autoComplete="email" readOnly type="email" value={user.email || ''} />
                  </label>
                  <label className="admin-field">Phone number
                    <input autoComplete="tel" disabled={profileLoading} maxLength={30} onChange={(event) => setProfilePhone(event.target.value)} type="tel" value={visibleProfilePhone} />
                  </label>
                  <p className="customer-dashboard-footnote">Your name and phone are saved to your secure account profile. Email is managed by your sign-in settings.</p>
                  {profileLoading && <p className="customer-account-muted" role="status">Loading your profile…</p>}
                  {profileError && <p className="admin-error" role="alert">{profileError}</p>}
                  {profileMessage && <p className="customer-dashboard-success" role="status">{profileMessage}</p>}
                  <button className="btn" disabled={savingProfile || profileLoading}>{savingProfile ? 'Saving…' : 'Save profile'}</button>
                </form>
              </AccountPanel>

              <AccountPanel title="Password & security">
                <form className="customer-dashboard-form" onSubmit={savePassword}>
                  <label className="admin-field">New password
                    <input autoComplete="new-password" minLength={8} onChange={(event) => setNewPassword(event.target.value)} required type="password" value={newPassword} />
                  </label>
                  <label className="admin-field">Confirm new password
                    <input autoComplete="new-password" onChange={(event) => setConfirmPassword(event.target.value)} required type="password" value={confirmPassword} />
                  </label>
                  <p className="customer-dashboard-footnote">Use at least 8 characters. Your password is handled securely by Supabase Auth.</p>
                  {passwordError && <p className="admin-error" role="alert">{passwordError}</p>}
                  {passwordMessage && <p className="customer-dashboard-success" role="status">{passwordMessage}</p>}
                  <button className="btn" disabled={savingPassword}><KeyRound size={16} />{savingPassword ? 'Updating…' : 'Change password'}</button>
                </form>
              </AccountPanel>
            </div>
          )}
        </div>
      </main>
      <Footer />
      <CartDrawer />
    </>
  );
}

export default CustomerAccount;
