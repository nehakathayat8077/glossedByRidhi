import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, X } from 'lucide-react';
import { designs, cats } from '../data/data';
import { useCart } from '../context/CartContext';

export default function NailDesigns() {
  const [category, setCategory] = useState('All');
  const [selected, setSelected] = useState(null);
  const { wish, toggleWish } = useCart();

  const list = designs.filter((design) => category === 'All' || design.cat === category);

  return (
    <section id="designs" className=" sec alt">
      <div className="wrap">
        <h2>Find your next nail obsession</h2>

        <div className="tabs">
          {cats.map((tab) => (
            <button key={tab} className={tab === category ? 'on' : ''} onClick={() => setCategory(tab)}>
              {tab}
            </button>
          ))}
        </div>

        <motion.div layout className="grid g4">
          <AnimatePresence>
            {list.map((design) => (
              <motion.article layout key={design.id} className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="ph tall">
                  <img loading="lazy" src={design.img} alt={design.name} />
                  <button
                    className={'heart' + (wish.includes(design.id) ? ' on' : '')}
                    onClick={() => toggleWish(design.id)}
                    aria-label="Favorite"
                  >
                    <Heart size={18} />
                  </button>
                </div>

                <div className="cb">
                  <h3>{design.name}</h3>
                  <p className="muted">
                    {design.cat} · ₹{design.price}
                  </p>
                  <button className="link" onClick={() => setSelected(design)}>
                    View Design
                  </button>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>

      <AnimatePresence>
        {selected && (
          <Modal onClose={() => setSelected(null)}>
            <div className="split">
              <img src={selected.img} alt={selected.name} />

              <div>
                <h3>{selected.name}</h3>
                <p>{selected.text}</p>
                <p>
                  <strong>₹{selected.price}</strong>
                </p>
                <p className="muted">Colours: Blush, Nude, Wine · Shapes: Almond, Coffin, Square</p>
                <button
                  className="btn"
                  onClick={() => {
                    setSelected(null);
                    document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  Book This Design
                </button>
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </section>
  );
}

export function Modal({ children, onClose }) {
  return (
    <motion.div className="ov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        className="modal"
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 30, opacity: 0 }}
        onClick={(event) => event.stopPropagation()}
      >
        <button className="x" onClick={onClose} aria-label="Close">
          <X />
        </button>
        {children}
      </motion.div>
    </motion.div>
  );
}
