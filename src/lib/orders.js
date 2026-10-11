import { supabase } from './supabaseClient';

export async function submitOrder({ customerName, phone, address, items }) {
  const { data, error } = await supabase.rpc('create_order', {
    p_customer_name: customerName,
    p_phone: phone,
    p_address: address,
    p_items: items.map((item) => ({ id: item.id, qty: item.qty })),
  });

  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}
