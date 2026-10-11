import { supabase } from './supabaseClient';

export async function submitOrder({ customerName, phone, address, items, paymentMethod }) {
  const { data, error } = await supabase.rpc('create_order', {
    p_address: address,
    p_customer_name: customerName,
    p_items: items.map((item) => ({ id: item.id, qty: item.qty })),
    p_payment_method: paymentMethod,
    p_phone: phone,
  });

  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}
