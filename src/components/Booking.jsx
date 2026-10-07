import { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { services } from '../data/data';
import { Modal } from './NailDesigns';

// Swap this function for a Supabase/Firebase/API call later.
export async function saveBooking(booking) {
  const all = JSON.parse(localStorage.getItem('glossedByRidhi-bookings') || '[]');
  all.push({ ...booking, at: Date.now() });
  localStorage.setItem('glossedByRidhi-bookings', JSON.stringify(all));
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

export default function Booking() {
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState(false);

  const updateField = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = {};

    if (form.name.trim().length < 2) nextErrors.name = 'Enter your full name';
    if (!/^[6-9]\d{9}$/.test(form.phone)) nextErrors.phone = 'Enter a 10-digit mobile number';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) nextErrors.email = 'Enter a valid email';
    if (!form.date) nextErrors.date = 'Pick a date';
    if (!form.time) nextErrors.time = 'Pick a time';
    if (!form.service) nextErrors.service = 'Choose a service';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    await saveBooking(form);
    setDone(true);
    setForm(empty);
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
          <Field k="time" label="Preferred time" type="time" />

          <Field k="service" label="Service">
            <select value={form.service} onChange={updateField('service')}>
              <option value="">Select</option>
              {services.map((service) => (
                <option key={service.name}>{service.name}</option>
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

          <button className="btn full wide">Book My Appointment</button>
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
