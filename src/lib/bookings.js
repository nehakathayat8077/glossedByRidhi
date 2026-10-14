import { supabase } from './supabaseClient';

export async function saveBooking(booking) {
  const notes = [
    booking.shape ? `Nail shape: ${booking.shape}` : '',
    booking.note?.trim() || '',
  ].filter(Boolean).join('\n');
  const appointment = {
    name: booking.name.trim(),
    phone: booking.phone.trim(),
    email: booking.email.trim(),
    service_id: booking.service,
    design_id: booking.design_id || null,
    appointment_date: booking.date,
    time_slot: booking.time,
    notes: notes || null,
  };

  // The database trigger assigns auth.uid(); ownership must not come from client input.
  const { error } = await supabase.from('appointments').insert(appointment);
  if (error) throw error;
}
