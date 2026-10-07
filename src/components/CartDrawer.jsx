import { motion, AnimatePresence } from 'framer-motion';
import { X, Minus, Plus, Trash2 } from 'lucide-react';
import { useCart } from '../context/CartContext';

export default function CartDrawer() {
  const { open, setOpen, items, qty, remove, subtotal, say } = useCart();
  const ship = subtotal > 999 || !items.length ? 0 : 60;

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

            {!items.length ? (
              <div className="empty">
                <p style={{ fontSize: 56 }}>💅</p>
                <p>Your cart is empty. Add a press-on set to get started.</p>
              </div>
            ) : (
              <div className="lines">
                {items.map((item) => (
                  <div key={item.id} className="line">
                    <img src={item.img} alt="" />

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

              <button
                className="btn full"
                disabled={!items.length}
                onClick={() => say('Checkout is a placeholder: connect your payment gateway here')}
              >
                Checkout
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
