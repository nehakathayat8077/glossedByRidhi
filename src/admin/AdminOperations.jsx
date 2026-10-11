import { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, Pencil, Search, X } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAdminNotice } from './AdminLayout';
import { loadActiveDesigns, loadActiveServices } from '../lib/catalogLoaders';

const appointmentStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
const orderStatuses = ['new', 'paid', 'shipped', 'delivered', 'cancelled'];
const pageSize = 10;

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : '—';
}

function OperationsToolbar({ query, setQuery, status, setStatus, statuses, date, setDate, searchPlaceholder }) {
  return (
    <div className="admin-toolbar">
      <label className="admin-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={searchPlaceholder} /></label>
      <select className="admin-filter" value={status} onChange={(event) => setStatus(event.target.value)}>
        <option value="all">All statuses</option>
        {statuses.map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}
      </select>
      <label className="admin-date-filter">Date <input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
    </div>
  );
}

function Pagination({ page, setPage, count }) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  if (count <= pageSize) return null;
  return (
    <div className="admin-pagination">
      <span>{page * pageSize + 1}–{Math.min((page + 1) * pageSize, count)} of {count}</span>
      <div>
        <button disabled={page === 0} onClick={() => setPage((current) => current - 1)}>Previous</button>
        <button disabled={page + 1 >= pages} onClick={() => setPage((current) => current + 1)}>Next</button>
      </div>
    </div>
  );
}

function AppointmentEditor({ appointment, onClose, onSaved }) {
  const [services, setServices] = useState([]);
  const [designs, setDesigns] = useState([]);
  const [form, setForm] = useState({
    name: appointment.name || '',
    phone: appointment.phone || '',
    email: appointment.email || '',
    appointment_date: appointment.appointment_date || '',
    time_slot: appointment.time_slot?.slice(0, 5) || '',
    service_id: appointment.service_id || '',
    design_id: appointment.design_id || '',
    service_name: appointment.service_name || '',
    design_title: appointment.design_title || '',
    notes: appointment.notes || '',
    status: appointment.status,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([loadActiveServices(), loadActiveDesigns()])
      .then(([activeServices, activeDesigns]) => {
        setServices(activeServices);
        setDesigns(activeDesigns);
      })
      .catch((loadError) => setError(loadError.message));
  }, []);

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const { error: saveError } = await supabase
        .from('appointments')
        .update({
          ...form,
          service_id: form.service_id || null,
          design_id: form.design_id || null,
          notes: form.notes || null,
        })
        .eq('id', appointment.id);
      if (saveError) setError(saveError.message);
      else await onSaved();
    } catch (saveError) {
      setError(saveError.message || 'Could not update this appointment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-modal-backdrop">
      <form className="admin-modal" onSubmit={save}>
        <div className="admin-modal-heading"><div><span className="admin-eyebrow">BOOKING DETAILS</span><h2>Edit appointment</h2></div><button type="button" className="admin-icon-button" onClick={onClose} aria-label="Close"><X /></button></div>
        <div className="admin-form-grid">
          <label className="admin-field">Customer name<input required value={form.name} onChange={update('name')} /></label>
          <label className="admin-field">Phone<input required value={form.phone} onChange={update('phone')} /></label>
          <label className="admin-field">Email<input required type="email" value={form.email} onChange={update('email')} /></label>
          <label className="admin-field">Service<select required value={form.service_id} onChange={update('service_id')}><option value="">Choose a service</option>{form.service_id && !services.some((service) => service.id === form.service_id) && <option value={form.service_id}>{form.service_name || 'Previously selected service (inactive)'}</option>}{services.map((service) => <option value={service.id} key={service.id}>{service.name}</option>)}</select></label>
          <label className="admin-field">Nail design<select value={form.design_id || ''} onChange={update('design_id')}><option value="">No design selected</option>{form.design_id && !designs.some((design) => design.id === form.design_id) && <option value={form.design_id}>{form.design_title || 'Previously selected design (inactive)'}</option>}{designs.map((design) => <option value={design.id} key={design.id}>{design.name}</option>)}</select></label>
          <label className="admin-field">Appointment date<input required type="date" value={form.appointment_date} onChange={update('appointment_date')} /></label>
          <label className="admin-field">Time slot<input required type="time" value={form.time_slot} onChange={update('time_slot')} /></label>
          <label className="admin-field">Status<select value={form.status} onChange={update('status')}>{appointmentStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
          <label className="admin-field full">Appointment notes<textarea rows="3" value={form.notes} onChange={update('notes')} /></label>
        </div>
        {error && <p className="admin-error" role="alert">{error}</p>}
        <div className="admin-modal-actions"><button type="button" className="admin-secondary-button" onClick={onClose}>Cancel</button><button className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save appointment'}</button></div>
      </form>
    </div>
  );
}

function AppointmentDetails({ appointment, onClose, onEdit }) {
  return (
    <div className="admin-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="admin-modal" aria-labelledby="appointment-details-title">
        <div className="admin-modal-heading">
          <div><span className="admin-eyebrow">BOOKING DETAILS</span><h2 id="appointment-details-title">{appointment.name}</h2></div>
          <button type="button" className="admin-icon-button" onClick={onClose} aria-label="Close"><X /></button>
        </div>
        <div className="admin-order-details">
          <p><strong>Email</strong>{appointment.email}</p>
          <p><strong>Phone</strong>{appointment.phone}</p>
          <p><strong>Service</strong>{appointment.service_name || '—'}</p>
          <p><strong>Nail design</strong>{appointment.design_title || '—'}</p>
          <p><strong>Requested date</strong>{formatDate(appointment.appointment_date)}</p>
          <p><strong>Requested time</strong>{appointment.time_slot}</p>
          <p><strong>Status</strong><span className={`admin-badge status-${appointment.status}`}>{appointment.status}</span></p>
          <p><strong>Booked</strong>{appointment.created_at ? new Date(appointment.created_at).toLocaleString() : '—'}</p>
        </div>
        <h3 className="admin-subheading">Customer notes</h3>
        <p className="admin-note">{appointment.notes || 'No notes provided.'}</p>
        <div className="admin-modal-actions">
          <button type="button" className="admin-secondary-button" onClick={onClose}>Close</button>
          <button type="button" className="btn" onClick={onEdit}>Edit appointment</button>
        </div>
      </section>
    </div>
  );
}

function AppointmentManager() {
  const notify = useAdminNotice();
  const [searchParams] = useSearchParams();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(searchParams.get('status') || 'all');
  const [date, setDate] = useState('');
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data: appointmentData, error: loadError } = await supabase
      .from('appointments')
      .select('id, name, phone, email, service_id, design_id, appointment_date, time_slot, notes, status, created_at')
      .order('created_at', { ascending: false });
    if (loadError) {
      setError(loadError.message);
      setRecords([]);
      setLoading(false);
      return;
    }

    const serviceIds = [...new Set((appointmentData || []).map((record) => record.service_id).filter(Boolean))];
    const designIds = [...new Set((appointmentData || []).map((record) => record.design_id).filter(Boolean))];
    const [serviceResult, designResult] = await Promise.all([
      serviceIds.length ? supabase.from('services').select('id, name').in('id', serviceIds) : { data: [], error: null },
      designIds.length ? supabase.from('designs').select('id, title').in('id', designIds) : { data: [], error: null },
    ]);
    if (serviceResult.error || designResult.error) {
      setError(serviceResult.error?.message || designResult.error?.message);
      setRecords([]);
    } else {
      const servicesById = new Map((serviceResult.data || []).map((service) => [service.id, service.name]));
      const designsById = new Map((designResult.data || []).map((design) => [design.id, design.title]));
      setRecords((appointmentData || []).map((record) => ({
        ...record,
        service_name: servicesById.get(record.service_id) || '',
        design_title: designsById.get(record.design_id) || '',
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return records.filter((record) =>
      (!term || [record.name, record.email, record.phone, record.appointment_date, record.service_name, record.design_title].some((value) => String(value || '').toLowerCase().includes(term)))
      && (status === 'all' || record.status === status)
      && (!date || record.appointment_date === date),
    );
  }, [records, query, status, date]);

  const updateStatus = async (record, nextStatus) => {
    const { error: updateError } = await supabase.from('appointments').update({ status: nextStatus }).eq('id', record.id);
    if (updateError) setError(updateError.message);
    else {
      await load();
      notify('Appointment status updated.');
    }
  };

  const saveEdit = async () => {
    setEditing(null);
    await load();
    notify('Appointment updated.');
  };

  return (
    <section className="admin-page">
      <div className="admin-page-intro"><div><span className="admin-eyebrow">CUSTOMER BOOKINGS</span><h2>Appointments</h2></div><span className="admin-record-count">{records.length} total</span></div>
      <OperationsToolbar query={query} setQuery={(value) => { setQuery(value); setPage(0); }} status={status} setStatus={(value) => { setStatus(value); setPage(0); }} statuses={appointmentStatuses} date={date} setDate={(value) => { setDate(value); setPage(0); }} searchPlaceholder="Search name, email, phone, date, service or design" />
      {error && <div className="admin-alert" role="alert">{error}</div>}
      <div className="admin-panel admin-table-panel">
        {loading ? <p className="admin-state">Loading appointments…</p> : filtered.length === 0 ? <p className="admin-empty">No appointments match these filters.</p> : (
          <div className="admin-table-scroll"><table className="admin-table">
            <thead><tr><th>Customer</th><th>Service / design</th><th>Date & time</th><th>Contact</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>{filtered.slice(page * pageSize, (page + 1) * pageSize).map((record) => (
              <tr key={record.id}>
                <td><strong>{record.name}</strong><small>Created {formatDate(record.created_at)}</small></td>
                <td>{record.service_name || '—'}<small>{record.design_title || 'No design selected'}</small></td>
                <td>{formatDate(record.appointment_date)}<small>{record.time_slot}</small></td>
                <td>{record.phone}<small>{record.email}</small></td>
                <td><span className={`admin-badge status-${record.status}`}>{record.status}</span></td>
                <td><div className="admin-row-actions">
                  <button className="admin-icon-button" title="View appointment details" onClick={() => setViewing(record)}><Eye size={16} /></button>
                  <button className="admin-icon-button" title="Edit details" onClick={() => setEditing(record)}><Pencil size={16} /></button>
                  <select className="admin-inline-status" aria-label="Appointment status" value={record.status} onChange={(event) => updateStatus(record, event.target.value)}>{appointmentStatuses.map((value) => <option key={value}>{value}</option>)}</select>
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        {!loading && <Pagination page={page} setPage={setPage} count={filtered.length} />}
      </div>
      {viewing && <AppointmentDetails appointment={viewing} onClose={() => setViewing(null)} onEdit={() => { setEditing(viewing); setViewing(null); }} />}
      {editing && <AppointmentEditor appointment={editing} onClose={() => setEditing(null)} onSaved={saveEdit} />}
    </section>
  );
}

function OrderDetails({ order, onClose, onStatus }) {
  const [status, setStatus] = useState(order.status);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await onStatus(order, status);
    setSaving(false);
  };

  return (
    <div className="admin-modal-backdrop">
      <div className="admin-modal">
        <div className="admin-modal-heading"><div><span className="admin-eyebrow">ORDER #{order.id.slice(0, 8)}</span><h2>Order details</h2></div><button className="admin-icon-button" onClick={onClose} aria-label="Close"><X /></button></div>
        <div className="admin-order-details">
          <p><strong>Customer</strong>{order.customer_name}</p><p><strong>Phone</strong>{order.phone}</p><p><strong>Address</strong>{order.address}</p><p><strong>Placed</strong>{formatDate(order.created_at)}</p>
          <p><strong>Payment method</strong>{order.payment_method === 'cod' ? 'Cash on Delivery' : order.payment_method === 'qr_whatsapp' ? 'QR via WhatsApp' : 'Not recorded'}</p>
          <p><strong>Payment status</strong>{order.payment_status || 'Not recorded'}</p>
        </div>
        <h3 className="admin-subheading">Purchased items (saved order snapshot)</h3>
        {Array.isArray(order.items) && order.items.length ? <div className="admin-order-lines">{order.items.map((item, index) => <div key={`${item.id || item.name}-${index}`}><span>{item.name || 'Product'} × {item.qty || item.quantity || 1}</span><strong>₹{Number(item.line_total ?? (item.unit_price ?? item.price ?? 0) * (item.qty ?? item.quantity ?? 1)).toLocaleString('en-IN')}</strong></div>)}</div> : <p className="admin-empty">No item details were saved for this order.</p>}
        <p className="admin-order-total"><strong>Order total</strong><b>₹{Number(order.total).toLocaleString('en-IN')}</b></p>
        <label className="admin-field">Fulfillment status<select value={status} onChange={(event) => setStatus(event.target.value)}>{orderStatuses.map((value) => <option key={value} value={value} disabled={value === 'paid' && order.status !== 'paid'}>{value}</option>)}</select></label>
        <p className="admin-note">Changing order status is not payment verification. Payment confirmation is not integrated.</p>
        <div className="admin-modal-actions"><button className="admin-secondary-button" onClick={onClose}>Close</button><button className="btn" disabled={saving || status === 'paid' && order.status !== 'paid'} onClick={save}>{saving ? 'Saving…' : 'Save status'}</button></div>
      </div>
    </div>
  );
}

function OrdersManager() {
  const notify = useAdminNotice();
  const [searchParams] = useSearchParams();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(searchParams.get('status') || 'all');
  const [date, setDate] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: loadError } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (loadError) {
      setError(loadError.message);
      setRecords([]);
    } else setRecords(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return records.filter((record) =>
      (!term || [record.customer_name, record.phone, record.id].some((value) => String(value || '').toLowerCase().includes(term)))
      && (status === 'all' || record.status === status)
      && (!date || record.created_at?.slice(0, 10) === date),
    );
  }, [records, query, status, date]);

  const updateStatus = async (order, nextStatus) => {
    setError('');
    if (nextStatus === 'paid' && order.status !== 'paid') {
      setError('A manual dashboard change cannot verify payment. Use a trusted payment-provider webhook after integrating payments.');
      return;
    }
    const { error: updateError } = await supabase.from('orders').update({ status: nextStatus }).eq('id', order.id);
    if (updateError) setError(updateError.message);
    else {
      setSelected(null);
      await load();
      notify('Order status updated.');
    }
  };

  return (
    <section className="admin-page">
      <div className="admin-page-intro"><div><span className="admin-eyebrow">CUSTOMER PURCHASES</span><h2>Orders</h2></div><span className="admin-record-count">{records.length} total</span></div>
      <OperationsToolbar query={query} setQuery={(value) => { setQuery(value); setPage(0); }} status={status} setStatus={(value) => { setStatus(value); setPage(0); }} statuses={orderStatuses} date={date} setDate={(value) => { setDate(value); setPage(0); }} searchPlaceholder="Search customer, phone or order ID" />
      {error && <div className="admin-alert" role="alert">{error}</div>}
      <div className="admin-panel admin-table-panel">
        {loading ? <p className="admin-state">Loading orders…</p> : filtered.length === 0 ? <p className="admin-empty">No orders match these filters.</p> : (
          <div className="admin-table-scroll"><table className="admin-table">
            <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Date</th><th>Status</th><th>Details</th></tr></thead>
            <tbody>{filtered.slice(page * pageSize, (page + 1) * pageSize).map((record) => (
              <tr key={record.id}>
                <td>#{record.id.slice(0, 8)}</td><td><strong>{record.customer_name}</strong><small>{record.phone}</small></td>
                <td>{Array.isArray(record.items) ? record.items.length : 0} line items</td><td>₹{Number(record.total).toLocaleString('en-IN')}</td>
                <td>{record.payment_method === 'cod' ? 'COD' : record.payment_method === 'qr_whatsapp' ? 'QR / WhatsApp' : '—'}<small>{record.payment_status || 'Not recorded'}</small></td>
                <td>{formatDate(record.created_at)}</td><td><span className={`admin-badge status-${record.status}`}>{record.status}</span></td>
                <td><button className="admin-icon-button" onClick={() => setSelected(record)} aria-label={`View order ${record.id}`}><Eye size={17} /></button></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
        {!loading && <Pagination page={page} setPage={setPage} count={filtered.length} />}
      </div>
      {selected && <OrderDetails order={selected} onClose={() => setSelected(null)} onStatus={updateStatus} />}
    </section>
  );
}

const offDayNames = [
  ['Sunday', 0], ['Monday', 1], ['Tuesday', 2], ['Wednesday', 3],
  ['Thursday', 4], ['Friday', 5], ['Saturday', 6],
];

function BusinessSettings() {
  const notify = useAdminNotice();
  const [record, setRecord] = useState(null);
  const [form, setForm] = useState({ working_start: '', working_end: '', slot_duration_minutes: '', off_days: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: loadError } = await supabase.from('business_settings').select('*').order('created_at').limit(1).maybeSingle();
    if (loadError) setError(loadError.message);
    else if (data) {
      setRecord(data);
      setForm({
        working_start: data.working_start?.slice(0, 5) || '',
        working_end: data.working_end?.slice(0, 5) || '',
        slot_duration_minutes: data.slot_duration_minutes ?? '',
        off_days: data.off_days || [],
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    if (form.working_end <= form.working_start) {
      setError('Closing time must be later than opening time.');
      setSaving(false);
      return;
    }

    const payload = {
      working_start: form.working_start,
      working_end: form.working_end,
      slot_duration_minutes: Number(form.slot_duration_minutes),
      off_days: form.off_days,
    };
    const result = record
      ? await supabase.from('business_settings').update(payload).eq('id', record.id)
      : await supabase.from('business_settings').insert(payload);
    if (result.error) setError(result.error.message);
    else {
      await load();
      notify('Business availability settings saved.');
    }
    setSaving(false);
  };

  const toggleDay = (day) => setForm((current) => ({
    ...current,
    off_days: current.off_days.includes(day)
      ? current.off_days.filter((value) => value !== day)
      : [...current.off_days, day].sort(),
  }));

  if (loading) return <p className="admin-state">Loading business settings…</p>;

  return (
    <section className="admin-page">
      <div className="admin-page-intro"><div><span className="admin-eyebrow">STUDIO AVAILABILITY</span><h2>Business settings</h2></div></div>
      <div className="admin-settings-grid">
        <form className="admin-panel admin-settings-form" onSubmit={save}>
          <span className="admin-eyebrow">BOOKING HOURS</span>
          <h3>Set your availability</h3>
          <p className="admin-note">Your database currently stores working hours, slot length, and days off. Business contact and social fields are not present in this table.</p>
          <div className="admin-form-grid">
            <label className="admin-field">Opening time<input type="time" required value={form.working_start} onChange={(event) => setForm({ ...form, working_start: event.target.value })} /></label>
            <label className="admin-field">Closing time<input type="time" required value={form.working_end} onChange={(event) => setForm({ ...form, working_end: event.target.value })} /></label>
            <label className="admin-field full">Appointment slot length (minutes)<input type="number" min="1" step="1" required value={form.slot_duration_minutes} onChange={(event) => setForm({ ...form, slot_duration_minutes: event.target.value })} /></label>
          </div>
          <fieldset className="admin-days-field"><legend>Days off</legend><div>{offDayNames.map(([name, day]) => <label key={day}><input type="checkbox" checked={form.off_days.includes(day)} onChange={() => toggleDay(day)} />{name}</label>)}</div></fieldset>
          {error && <p className="admin-error" role="alert">{error}</p>}
          <button className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save availability'}</button>
        </form>
        <aside className="admin-panel admin-settings-help">
          <span className="admin-eyebrow">CURRENT SCHEMA</span><h3>What these settings control</h3>
          <ul><li>Start and end of the booking day</li><li>Minutes in each appointment slot</li><li>Weekly off-days (Sunday = 0 through Saturday = 6)</li></ul>
          <p>Contact information, social links, and business name remain in the existing environment/content setup; there are no corresponding columns in <code>business_settings</code>.</p>
        </aside>
      </div>
    </section>
  );
}

export default function AdminOperations({ type }) {
  if (type === 'appointments') return <AppointmentManager />;
  if (type === 'orders') return <OrdersManager />;
  return <BusinessSettings />;
}
