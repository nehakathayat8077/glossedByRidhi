import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, X } from 'lucide-react';
import { designs, cats } from '../data/data';
import { useCart } from '../context/CartContext';
import { useCatalogData } from '../hooks/useCatalogData';
import { loadActiveDesigns } from '../lib/catalogLoaders';
import ResilientImage from './ResilientImage';

export default function NailDesigns() {
  const [category, setCategory] = useState('All');
  const [selected, setSelected] = useState(null);
  const { wish, toggleWish } = useCart();
  const { items, loading } = useCatalogData(loadActiveDesigns, designs, 'nail designs');

  const list = items.filter((design) => category === 'All' || design.cat === category);

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
            {loading ? (
              <p className="muted" role="status">Loading nail designs…</p>
            ) : list.map((design) => (
              <motion.article layout key={design.id} className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="ph tall">
                  <ResilientImage
                    loading="lazy"
                    src={design.image_url}
                    fallbackSrc={design.fallback_image_url}
                    alt={design.name}
                  />
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
                    {design.cat}{design.price != null ? ` · ₹${design.price}` : ''}
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
              <ResilientImage
                src={selected.image_url}
                fallbackSrc={selected.fallback_image_url}
                alt={selected.name}
              />

              <div>
                <h3>{selected.name}</h3>
                {selected.text && <p>{selected.text}</p>}
                {selected.price != null && (
                  <p>
                    <strong>₹{selected.price}</strong>
                  </p>
                )}
                <p className="muted">Colours: Blush, Nude, Wine · Shapes: Almond, Coffin, Square</p>
                <button
                  className="btn"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('booking:select-design', {
                      detail: { id: selected.id, name: selected.name },
                    }));
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
