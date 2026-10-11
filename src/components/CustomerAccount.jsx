import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import CartDrawer from './CartDrawer';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';

function formatDate(value, options = {}) {
  return value ? new Date(value).toLocaleString(undefined, options) : '—';
}

function AccountHistory({ title, children, empty, loading }) {
  return (
    <section className="customer-account-panel">
      <div className="customer-account-panel-heading"><h2>{title}</h2></div>
      {loading ? <p className="customer-account-muted">Loading {title.toLowerCase()}…</p> : children || <p className="customer-account-muted">{empty}</p>}
    </section>
  );
}

export default function CustomerAccount() {
  const { session, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const user = session?.user;
  const profileName = user?.user_metadata?.full_name || user?.user_metadata?.name || '';

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
          .order('created_at', { ascending: false }),
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
    if (user?.id) loadHistory();
  }, [loadHistory, user?.id]);

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

  if (authLoading) return <main className="customer-account-state">Checking your account…</main>;
  if (!user) return <Navigate to="/login" replace state={{ from: '/account' }} />;

  return (
    <>
      <Navbar />
      <main className="customer-account wrap">
        <header className="customer-account-header">
          <div>
            <span className="admin-eyebrow">YOUR GLOSSEDBYRIDHI ACCOUNT</span>
            <h1>My account</h1>
            <p>Welcome{profileName ? `, ${profileName}` : ''}. Your bookings and purchases are here.</p>
          </div>
          <div className="customer-account-actions">
            <Link className="admin-secondary-button" to="/">Back to the studio</Link>
            <button className="admin-secondary-button" onClick={signOut} disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button>
          </div>
        </header>

        <section className="customer-account-panel customer-profile">
          <div><span className="admin-eyebrow">PROFILE</span><h2>{profileName || 'Customer account'}</h2></div>
          <p><strong>Email</strong>{user.email || '—'}</p>
          {signOutError && <p className="admin-error" role="alert">{signOutError}</p>}
        </section>

        {error && <div className="admin-alert" role="alert">{error}<button onClick={loadHistory}>Retry</button></div>}

        <div className="customer-account-history">
          <AccountHistory title="Order history" loading={loading} empty="You have not placed any orders yet.">
            {orders.length > 0 && <div className="customer-order-list">
              {orders.map((order) => (
                <article className="customer-history-card" key={order.id}>
                  <div className="customer-history-heading">
                    <div><span className="admin-eyebrow">ORDER</span><h3>#{order.id.slice(0, 8)}</h3></div>
                    <span className={`admin-badge status-${order.status}`}>{order.status}</span>
                  </div>
                  <p className="customer-account-muted">{formatDate(order.created_at)}</p>
                  <div className="customer-order-items">
                    {(Array.isArray(order.items) ? order.items : []).map((item, index) => (
                      <p key={`${item.id || item.name}-${index}`}>
                        <span>{item.name || 'Product'} × {item.qty ?? item.quantity ?? 1}</span>
                        <span>₹{Number(item.line_total ?? (item.unit_price ?? item.price ?? 0) * (item.qty ?? item.quantity ?? 1)).toLocaleString('en-IN')}</span>
                      </p>
                    ))}
                  </div>
                  <p><strong>Total</strong><strong>₹{Number(order.total).toLocaleString('en-IN')}</strong></p>
                  <p><strong>Payment</strong><span>{order.payment_method === 'cod' ? 'Cash on Delivery' : order.payment_method === 'qr_whatsapp' ? 'QR / WhatsApp' : 'Not recorded'} · {order.payment_status || 'status unavailable'}</span></p>
                </article>
              ))}
            </div>}
          </AccountHistory>

          <AccountHistory title="Appointment history" loading={loading} empty="You have not requested an appointment yet.">
            {appointments.length > 0 && <div className="customer-order-list">
              {appointments.map((appointment) => (
                <article className="customer-history-card" key={appointment.id}>
                  <div className="customer-history-heading">
                    <div><span className="admin-eyebrow">APPOINTMENT</span><h3>{appointment.service_name || 'Studio appointment'}</h3></div>
                    <span className={`admin-badge status-${appointment.status}`}>{appointment.status}</span>
                  </div>
                  <p><strong>Nail design</strong><span>{appointment.design_title || 'No design selected'}</span></p>
                  <p><strong>Requested</strong><span>{formatDate(`${appointment.appointment_date}T${appointment.time_slot}`)}</span></p>
                  <p><strong>Booked</strong><span>{formatDate(appointment.created_at)}</span></p>
                  {appointment.notes && <p><strong>Notes</strong><span>{appointment.notes}</span></p>}
                </article>
              ))}
            </div>}
          </AccountHistory>
        </div>
      </main>
      <Footer />
      <CartDrawer />
    </>
  );
}
