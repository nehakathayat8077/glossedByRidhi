import { supabase } from './supabaseClient';

export const ORDER_HISTORY_CHANGED_EVENT = 'glossedbyridhi:order-history-changed';

export async function submitOrder({ customerName, phone, address, items, paymentMethod }) {
  const { data, error } = await supabase.rpc('create_order', {
    p_customer_name: customerName,
    p_phone: phone,
    p_address: address,
    p_items: items.map((item) => ({ id: item.id, qty: item.qty })),
    p_payment_method: paymentMethod,
  });

  if (error) throw error;
  const order = Array.isArray(data) ? data[0] : data;
  if (!order?.order_id) {
    throw new Error('The order could not be confirmed by the checkout service.');
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(ORDER_HISTORY_CHANGED_EVENT));
  }

  return order;
}
