import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ClipboardList, Gem, Package, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

const statDefinitions = [
  { key: 'appointments', label: 'Appointments', icon: CalendarDays, path: '/admin/appointments' },
  { key: 'pendingAppointments', label: 'Pending appointments', icon: CalendarDays, path: '/admin/appointments?status=pending' },
  { key: 'orders', label: 'Orders', icon: ClipboardList, path: '/admin/orders' },
  { key: 'pendingOrders', label: 'New orders', icon: ClipboardList, path: '/admin/orders?status=new' },
  { key: 'products', label: 'Active products', icon: Package, path: '/admin/products' },
  { key: 'services', label: 'Active services', icon: Sparkles, path: '/admin/services' },
  { key: 'designs', label: 'Active designs', icon: Gem, path: '/admin/designs' },
];

function dateLabel(value) {
  return value ? new Date(value).toLocaleDateString() : '—';
}

export default function AdminOverview() {
  const [summary, setSummary] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    const load = async () => {
      setLoading(true);
      setError('');
      const requests = await Promise.all([
        supabase.from('appointments').select('*', { count: 'exact', head: true }),
        supabase.from('appointments').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('orders').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('status', 'new'),
        supabase.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('services').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('designs').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('appointments').select('id, name, email, appointment_date, time_slot, status').order('created_at', { ascending: false }).limit(5),
        supabase.from('orders').select('id, customer_name, total, status, created_at').order('created_at', { ascending: false }).limit(5),
      ]);

      const failure = requests.find((result) => result.error);
      if (failure) {
        if (current) {
          setError(failure.error.message);
          setLoading(false);
        }
        return;
      }

      if (current) {
        setSummary(Object.fromEntries(
          statDefinitions.map((definition, index) => [definition.key, requests[index].count || 0]),
        ));
        setAppointments(requests[7].data || []);
        setOrders(requests[8].data || []);
        setLoading(false);
      }
    };

    load().catch((loadError) => {
      if (current) {
        setError(loadError.message);
        setLoading(false);
      }
    });

    return () => { current = false; };
  }, []);

  if (loading) return <p className="admin-state">Loading your studio overview…</p>;
  if (error) return <div className="admin-alert" role="alert">Could not load dashboard data: {error}</div>;

  return (
    <div className="admin-page">
      <div className="admin-page-intro">
        <div>
          <span className="admin-eyebrow">YOUR STUDIO AT A GLANCE</span>
          <h2>Good business starts with a beautiful overview.</h2>
        </div>
        <p>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </div>

      <div className="admin-stat-grid">
        {statDefinitions.map(({ key, label, icon: Icon, path }) => (
          <Link className="admin-stat-card" key={key} to={path}>
            <span className="admin-stat-icon"><Icon size={19} /></span>
            <span className="admin-stat-label">{label}</span>
            <strong>{summary[key]}</strong>
          </Link>
        ))}
      </div>

      <div className="admin-recent-grid">
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div><span className="admin-eyebrow">LATEST BOOKINGS</span><h3>Recent appointments</h3></div>
            <Link to="/admin/appointments">View all →</Link>
          </div>
          {appointments.length === 0 ? (
            <p className="admin-empty">No appointments yet.</p>
          ) : (
            <div className="admin-recent-list">
              {appointments.map((appointment) => (
                <div className="admin-recent-row" key={appointment.id}>
                  <span className="admin-avatar">{appointment.name?.slice(0, 1).toUpperCase() || 'G'}</span>
                  <div className="admin-recent-copy"><strong>{appointment.name}</strong><span>{dateLabel(appointment.appointment_date)} · {appointment.time_slot}</span></div>
                  <span className={`admin-badge status-${appointment.status}`}>{appointment.status}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div><span className="admin-eyebrow">LATEST SALES</span><h3>Recent orders</h3></div>
            <Link to="/admin/orders">View all →</Link>
          </div>
          {orders.length === 0 ? (
            <p className="admin-empty">No orders yet.</p>
          ) : (
            <div className="admin-recent-list">
              {orders.map((order) => (
                <div className="admin-recent-row" key={order.id}>
                  <span className="admin-avatar order-avatar">₹</span>
                  <div className="admin-recent-copy"><strong>{order.customer_name}</strong><span>{dateLabel(order.created_at)} · ₹{Number(order.total).toLocaleString('en-IN')}</span></div>
                  <span className={`admin-badge status-${order.status}`}>{order.status}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
