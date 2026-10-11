import { motion, AnimatePresence } from 'framer-motion';
import { X, Minus, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useCart } from '../context/CartContext';
import ResilientImage from './ResilientImage';
import { submitOrder } from '../lib/orders';

const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER;
const whatsappDigits = String(whatsappNumber || '').replace(/\D/g, '');

export default function CartDrawer() {
  const { open, setOpen, items, qty, remove, clear, subtotal, say } = useCart();
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customer, setCustomer] = useState({ customerName: '', phone: '', address: '' });
  const [checkoutError, setCheckoutError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [placedOrder, setPlacedOrder] = useState(null);
  const ship = subtotal > 999 || !items.length ? 0 : 60;
  const whatsappLink = placedOrder?.paymentMethod === 'qr_whatsapp' && whatsappDigits
    ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(
      `Hello, I placed order ${placedOrder.id} for ₹${placedOrder.total.toLocaleString('en-IN')}. Please share the QR code for payment.`,
    )}`
    : '';

  const placeOrder = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setCheckoutError('');
    try {
      const order = await submitOrder({ ...customer, items, paymentMethod });
      setPlacedOrder({
        id: order.order_id,
        total: Number(order.order_total),
        paymentMethod,
      });
      clear();
      setCheckoutOpen(false);
      setCustomer({ customerName: '', phone: '', address: '' });
      setPaymentMethod('cod');
      say(`Order request received. Total: ₹${Number(order.order_total).toLocaleString('en-IN')}`);
    } catch (error) {
      setCheckoutError(error.message || 'Could not submit your order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="ov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />

          <motion.aside
            className="drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.4 }}
          >
            <div className="row sb">
              <h3>Your cart</h3>
              <button onClick={() => setOpen(false)} aria-label="Close">
                <X />
              </button>
            </div>

            {placedOrder != null && (
              <div className="admin-success checkout-success" role="status">
                {placedOrder.paymentMethod === 'cod'
                  ? <>Order {placedOrder.id.slice(0, 8)} is saved for ₹{placedOrder.total.toLocaleString('en-IN')}. Pay Cash on Delivery; payment is still pending.</>
                  : <>Order {placedOrder.id.slice(0, 8)} is saved for ₹{placedOrder.total.toLocaleString('en-IN')}. Payment is pending. Request the QR code from the studio on WhatsApp.</>}
                {placedOrder.paymentMethod === 'qr_whatsapp' && (
                  whatsappLink
                    ? <a className="checkout-whatsapp-link" href={whatsappLink} target="_blank" rel="noreferrer">Request QR code on WhatsApp</a>
                    : <p>WhatsApp is not configured. The order is saved; please contact the studio to request its QR code.</p>
                )}
                <button onClick={() => setPlacedOrder(null)} aria-label="Dismiss confirmation"><X size={15} /></button>
              </div>
            )}

            {!items.length ? (
              <div className="empty">
                <p style={{ fontSize: 56 }}>💅</p>
                <p>Your cart is empty. Add a press-on set to get started.</p>
              </div>
            ) : (
              <div className="lines">
                {items.map((item) => (
                  <div key={item.id} className="line">
                    <ResilientImage src={item.image_url || item.img} alt="" />

                    <div>
                      <b>{item.name}</b>
                      <p>₹{item.price}</p>

                      <div className="q">
                        <button onClick={() => qty(item.id, -1)}>
                          <Minus size={14} />
                        </button>
                        {item.qty}
                        <button onClick={() => qty(item.id, 1)}>
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>

                    <button onClick={() => remove(item.id)} aria-label="Remove">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {items.length > 0 && checkoutOpen && (
              <form className="checkout-form" onSubmit={placeOrder}>
                <h4>Delivery details</h4>
                <label>Name<input required minLength="2" value={customer.customerName} onChange={(event) => setCustomer({ ...customer, customerName: event.target.value })} /></label>
                <label>Phone<input required minLength="7" value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} /></label>
                <label>Delivery address<textarea required minLength="5" rows="2" value={customer.address} onChange={(event) => setCustomer({ ...customer, address: event.target.value })} /></label>
                <label>Payment method
                  <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                    <option value="cod">Cash on Delivery</option>
                    <option value="qr_whatsapp">QR code via WhatsApp</option>
                  </select>
                </label>
                {paymentMethod === 'qr_whatsapp' && <p className="checkout-payment-note">After saving your order, WhatsApp will open a message to request the payment QR code. Payment is confirmed manually by the studio.</p>}
                {checkoutError && <p className="admin-error" role="alert">{checkoutError}</p>}
                <button className="btn full" disabled={submitting}>{submitting ? 'Submitting order…' : 'Place order request'}</button>
              </form>
            )}

            <div className="sum">
              <p className="row sb">
                <span>Subtotal</span>₹{subtotal}
              </p>
              <p className="row sb">
                <span>Delivery</span>
                {ship ? `₹${ship}` : 'Free'}
              </p>
              <p className="row sb">
                <b>Total</b>
                <b>₹{subtotal + ship}</b>
              </p>

              {!checkoutOpen && <button className="btn full" disabled={!items.length} onClick={() => setCheckoutOpen(true)}>Continue to checkout</button>}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
