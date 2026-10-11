import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Modal } from './NailDesigns';
import { loadActiveServices } from '../lib/catalogLoaders';
import { useCatalogData } from '../hooks/useCatalogData';
import { supabase } from '../lib/supabaseClient';

export async function saveBooking(booking) {
  const notes = [
    booking.shape ? `Nail shape: ${booking.shape}` : '',
    booking.note?.trim() || '',
  ].filter(Boolean).join('\n');
  const { error } = await supabase.from('appointments').insert({
    name: booking.name.trim(),
    phone: booking.phone.trim(),
    email: booking.email.trim(),
    service_id: booking.service,
    appointment_date: booking.date,
    time_slot: booking.time,
    notes: notes || null,
  });
  if (error) throw error;
}

const empty = {
  name: '',
  phone: '',
  email: '',
  date: '',
  time: '',
  service: '',
  shape: 'Almond',
  note: '',
};

const noFallbackServices = [];

function getTimeSlots(settings) {
  if (!settings) return [];
  const toMinutes = (value) => {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  };
  const start = toMinutes(settings.working_start);
  const end = toMinutes(settings.working_end);
  const duration = Number(settings.slot_duration_minutes);
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isInteger(duration) || duration < 1) return [];

  const slots = [];
  for (let minutes = start; minutes + duration <= end; minutes += duration) {
    slots.push(`${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`);
  }
  return slots;
}

export default function Booking() {
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [businessSettings, setBusinessSettings] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState('');
  const [bookedSlots, setBookedSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState('');
  const { items: services, loading: servicesLoading } = useCatalogData(
    loadActiveServices,
    noFallbackServices,
    'booking services',
  );
  const timeSlots = useMemo(() => getTimeSlots(businessSettings), [businessSettings]);

  useEffect(() => {
    let mounted = true;
    supabase
      .from('business_settings')
      .select('working_start, working_end, slot_duration_minutes, off_days')
      .order('created_at')
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) setSettingsError(error.message);
        else setBusinessSettings(data);
        setSettingsLoading(false);
      })
      .catch((error) => {
        if (!mounted) return;
        setSettingsError(error.message || 'Could not load studio availability.');
        setSettingsLoading(false);
      });

    return () => { mounted = false; };
  }, []);

  const closedDate = useMemo(() => {
    if (!businessSettings || !form.date) return false;
    const weekday = new Date(`${form.date}T00:00:00`).getDay();
    return (businessSettings.off_days || []).includes(weekday);
  }, [businessSettings, form.date]);

  useEffect(() => {
    if (!form.date || settingsLoading || !businessSettings || closedDate) {
      setBookedSlots([]);
      setSlotsError('');
      setSlotsLoading(false);
      return undefined;
    }

    let current = true;
    setSlotsLoading(true);
    setSlotsError('');
    supabase.rpc('get_booked_slots', { p_date: form.date })
      .then(({ data, error }) => {
        if (!current) return;
        if (error) setSlotsError(error.message);
        else setBookedSlots((data || []).map((row) => row.time_slot.slice(0, 5)));
        setSlotsLoading(false);
      })
      .catch((error) => {
        if (!current) return;
        setSlotsError(error.message || 'Could not check available times.');
        setSlotsLoading(false);
      });

    return () => { current = false; };
  }, [form.date, settingsLoading, businessSettings, closedDate]);

  const updateField = (key) => (event) => {
    const value = event.target.value;
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === 'date' ? { time: '' } : {}),
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = {};

    if (form.name.trim().length < 2) nextErrors.name = 'Enter your full name';
    if (!/^[6-9]\d{9}$/.test(form.phone)) nextErrors.phone = 'Enter a 10-digit mobile number';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) nextErrors.email = 'Enter a valid email';
    if (!form.date) nextErrors.date = 'Pick a date';
    if (!form.time) nextErrors.time = 'Pick a time';
    if (!form.service) nextErrors.service = 'Choose a service';
    if (closedDate) nextErrors.date = 'The studio is closed on this day. Choose another date.';
    if (businessSettings && !closedDate && slotsError) {
      nextErrors.submit = 'We could not verify availability. Please try changing the date and select a time again.';
    }
    if (businessSettings && !closedDate && !slotsLoading && !slotsError
      && (!timeSlots.includes(form.time) || bookedSlots.includes(form.time))) {
      nextErrors.time = 'Choose an available time slot.';
    }

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      await saveBooking(form);
      setDone(true);
      setForm(empty);
    } catch (error) {
      setErrors({
        submit: error.code === '23505'
          ? 'That time slot was just booked. Please choose another time.'
          : error.message || 'We could not save your booking. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ k, label, type = 'text', children }) => (
    <label>
      {label}
      {children || <input type={type} value={form[k]} onChange={updateField(k)} />}
      {errors[k] && <small>{errors[k]}</small>}
    </label>
  );

  return (
    <section id="booking" className="sec alt">
      <div className="wrap narrow">
        <h2>Ready for your next set?</h2>

        <form className="form" onSubmit={submit} noValidate>
          <Field k="name" label="Name" />
          <Field k="phone" label="Phone" type="tel" />
          <Field k="email" label="Email" type="email" />
          <Field k="date" label="Preferred date" type="date" />
          <Field k="time" label="Preferred time">
            {businessSettings ? (
              <select value={form.time} onChange={updateField('time')} disabled={!form.date || closedDate || slotsLoading || Boolean(slotsError)}>
                <option value="">
                  {!form.date ? 'Select a date first' : closedDate ? 'Studio closed' : slotsLoading ? 'Checking availability…' : slotsError ? 'Could not check availability' : 'Select'}
                </option>
                {timeSlots.filter((slot) => !bookedSlots.includes(slot)).map((slot) => (
                  <option key={slot} value={slot}>{slot}</option>
                ))}
              </select>
            ) : <input type="time" value={form.time} onChange={updateField('time')} />}
          </Field>
          {settingsError && <p className="wide" role="status">Studio hours could not be loaded; you can still request a preferred time for manual confirmation.</p>}
          {businessSettings && form.date && closedDate && <p className="wide" role="status">The studio is closed on the selected day.</p>}
          {businessSettings && form.date && !closedDate && !slotsLoading && !slotsError && timeSlots.length === 0 && <p className="wide" role="alert">No appointment slots are configured for these business hours.</p>}
          {slotsError && <p className="wide" role="alert">We could not check booked times. Please choose another date or try again later.</p>}

          <Field k="service" label="Service">
            <select value={form.service} onChange={updateField('service')} disabled={servicesLoading || services.length === 0}>
              <option value="">
                {servicesLoading ? 'Loading services…' : services.length ? 'Select' : 'No services available'}
              </option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>{service.name}</option>
              ))}
            </select>
          </Field>

          <Field k="shape" label="Nail shape">
            <select value={form.shape} onChange={updateField('shape')}>
              {['Almond', 'Coffin', 'Square', 'Oval', 'Stiletto'].map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </Field>

          <label className="wide">
            Special request
            <textarea rows="3" value={form.note} onChange={updateField('note')} />
          </label>

          {errors.submit && <p className="admin-error wide" role="alert">{errors.submit}</p>}
          <button className="btn full wide" disabled={saving || servicesLoading || services.length === 0 || settingsLoading || slotsLoading}>
            {saving ? 'Sending request…' : 'Book My Appointment'}
          </button>
        </form>
      </div>

      <AnimatePresence>
        {done && (
          <Modal onClose={() => setDone(false)}>
            <div className="empty">
              <p style={{ fontSize: 48 }}>✨</p>
              <h3>Your appointment request has been received</h3>
              <p>We will confirm your slot on WhatsApp shortly.</p>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </section>
  );
}
