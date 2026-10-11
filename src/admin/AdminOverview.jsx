import { useCallback, useEffect, useState } from 'react';
import { Activity, CalendarDays, CheckCircle2, Clock3, Gem, IndianRupee, Package, RefreshCw, ShoppingBag, Sparkles, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
const pageSize = 500;

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value || 0);
}

function formatDate(value) {
  if (!value) return 'Date not set';
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

async function loadOrderValue() {
  let offset = 0;
  let recordedSales = 0;

  while (true) {
    const { data, error } = await supabase
      .from('orders')
      .select('total, status')
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    for (const order of data || []) {
      if (['paid', 'shipped', 'delivered'].includes(order.status)) {
        recordedSales += Number(order.total) || 0;
      }
    }

    if (!data || data.length < pageSize) return recordedSales;
    offset += data.length;
  }
}

export default function AdminOverview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const today = localDateString();
      const queries = {
        appointments: supabase.from('appointments').select('id', { count: 'exact', head: true }),
        pendingAppointments: supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        confirmedAppointments: supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('status', 'confirmed'),
        completedAppointments: supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
        cancelledAppointments: supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('status', 'cancelled'),
        orders: supabase.from('orders').select('id', { count: 'exact', head: true }),
        newOrders: supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'new'),
        products: supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true),
        services: supabase.from('services').select('id', { count: 'exact', head: true }).eq('is_active', true),
        serviceNames: supabase.from('services').select('id, name'),
        designs: supabase.from('designs').select('id', { count: 'exact', head: true }).eq('is_active', true),
        upcoming: supabase.from('appointments')
          .select('id, name, phone, email, service_id, appointment_date, time_slot, status')
          .gte('appointment_date', today)
          .in('status', ['pending', 'confirmed'])
          .order('appointment_date', { ascending: true })
          .order('time_slot', { ascending: true })
          .limit(5),
        recentOrders: supabase.from('orders')
          .select('id, customer_name, total, status, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
      };

      const keys = Object.keys(queries);
      const results = await Promise.all(Object.values(queries));
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;

      const resultByKey = Object.fromEntries(keys.map((key, index) => [key, results[index]]));
      const [salesValue] = await Promise.all([loadOrderValue()]);

      setData({
        counts: Object.fromEntries(keys
          .filter((key) => !['upcoming', 'recentOrders', 'serviceNames'].includes(key))
          .map((key) => [key, resultByKey[key].count || 0])),
        upcoming: (resultByKey.upcoming.data || []).map((appointment) => ({
          ...appointment,
          serviceName: (resultByKey.serviceNames.data || []).find((service) => service.id === appointment.service_id)?.name || 'Service',
        })),
        recentOrders: resultByKey.recentOrders.data || [],
        salesValue,
      });
    } catch (loadError) {
      setError(loadError.message || 'Could not load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) return <div className="admin-state"><span className="admin-spinner" /> Loading your business overview…</div>;
  if (error && !data) {
    return (
      <div className="admin-state admin-error" role="alert">
        <p>{error}</p>
        <button className="admin-secondary-btn" onClick={load}><RefreshCw size={15} /> Try again</button>
      </div>
    );
  }

  const count = data?.counts || {};
  const stats = [
    { label: 'Appointments', value: count.appointments, icon: CalendarDays, tone: 'rose' },
    { label: 'Pending appointments', value: count.pendingAppointments, icon: Clock3, tone: 'amber' },
    { label: 'Confirmed appointments', value: count.confirmedAppointments, icon: CheckCircle2, tone: 'green' },
    { label: 'Completed appointments', value: count.completedAppointments, icon: CheckCircle2, tone: 'green' },
    { label: 'Cancelled appointments', value: count.cancelledAppointments, icon: XCircle, tone: 'muted' },
    { label: 'Orders', value: count.orders, icon: ShoppingBag, tone: 'rose' },
    { label: 'New orders', value: count.newOrders, icon: Activity, tone: 'amber' },
    { label: 'Active products', value: count.products, icon: Package, tone: 'green' },
    { label: 'Active services', value: count.services, icon: Sparkles, tone: 'rose' },
    { label: 'Active designs', value: count.designs, icon: Gem, tone: 'amber' },
  ];

  return (
    <div className="admin-page">
      <div className="admin-page-heading">
        <div>
          <span className="admin-eyebrow">YOUR BUSINESS AT A GLANCE</span>
          <h1>Good day, Ridhi <span>✦</span></h1>
          <p>Here’s what’s happening at your studio.</p>
        </div>
        <button className="admin-secondary-btn" onClick={load} disabled={loading}><RefreshCw size={15} className={loading ? 'spin' : ''} /> Refresh</button>
      </div>

      {error && <div className="admin-inline-error" role="alert">{error}</div>}

      <section className="admin-stat-grid" aria-label="Business statistics">
        {stats.map(({ label, value, icon: Icon, tone }) => (
          <article className="admin-stat-card" key={label}>
            <span className={`admin-stat-icon ${tone}`}><Icon size={18} /></span>
            <span className="admin-stat-label">{label}</span>
            <strong>{loading && !data ? '—' : value ?? 0}</strong>
          </article>
        ))}
        <article className="admin-stat-card admin-sales-card">
          <span className="admin-stat-icon green"><IndianRupee size={18} /></span>
          <span className="admin-stat-label">Recorded sales value*</span>
          <strong>{formatCurrency(data?.salesValue)}</strong>
        </article>
      </section>

      <div className="admin-overview-grid">
        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div><span className="admin-eyebrow">NEXT UP</span><h2>Upcoming appointments</h2></div>
            <CalendarDays size={19} />
          </div>
          {!data?.upcoming.length ? (
            <div className="admin-empty">No upcoming appointments yet.</div>
          ) : (
            <div className="admin-list">
              {data.upcoming.map((appointment) => (
                <div className="admin-list-row" key={appointment.id}>
                  <span className="admin-list-date">{formatDate(appointment.appointment_date)}</span>
                  <span className="admin-list-main"><strong>{appointment.name}</strong><small>{appointment.serviceName} · {appointment.time_slot || 'Time not set'} · {appointment.phone}</small></span>
                  <span className={`admin-badge status-${appointment.status}`}>{appointment.status}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="admin-panel">
          <div className="admin-panel-heading">
            <div><span className="admin-eyebrow">LATEST ACTIVITY</span><h2>Recent orders</h2></div>
            <ShoppingBag size={19} />
          </div>
          {!data?.recentOrders.length ? (
            <div className="admin-empty">No orders yet.</div>
          ) : (
            <div className="admin-list">
              {data.recentOrders.map((order) => (
                <div className="admin-list-row" key={order.id}>
                  <span className="admin-order-avatar">{(order.customer_name || '?').slice(0, 1).toUpperCase()}</span>
                  <span className="admin-list-main"><strong>{order.customer_name || 'Customer'}</strong><small>{new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {formatCurrency(order.total)}</small></span>
                  <span className={`admin-badge status-${order.status}`}>{order.status}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <p className="admin-data-note">
        * Recorded sales value sums order totals marked paid, shipped, or delivered. Order status is not independent payment verification; no payment provider is connected.
      </p>
    </div>
  );
}
