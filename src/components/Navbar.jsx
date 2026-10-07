import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Menu, X, Instagram, MessageCircle } from 'lucide-react';
import { useCart } from '../context/CartContext';
const links = ['Home', 'About', 'Designs', 'Services', 'Shop', 'Booking'];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { count, setOpen } = useCart();

  // Update the sticky header state when the page scrolls.
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', handleScroll);

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll to the requested page section and close the mobile menu.
  const go = (label) => {
    setMobileOpen(false);
    document.getElementById(label.toLowerCase())?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header className={'nav' + (scrolled ? ' scrolled' : '')}>
      <div className="wrap nav-in">
        <a className="logo" href="#">
          GlossedBy<em>Ridhi</em>
        </a>

        <nav className="links">
          {links.map((label) => (
            <button key={label} onClick={() => go(label)}>
              {label}
            </button>
          ))}
        </nav>

        <div className="nav-r">
          <a href="https://www.instagram.com/glossedbyridhi/" aria-label="Instagram">
            <Instagram size={18} />
          </a>
          <a href="https://wa.me/918279397721" aria-label="WhatsApp">
            <MessageCircle size={18} />
          </a>

          <button className="cart" onClick={() => setOpen(true)} aria-label="Cart">
            <ShoppingBag size={20} />
            {count > 0 && <b>{count}</b>}
          </button>

          <button className="btn sm hide-m" onClick={() => go('Booking')}>
            Book Appointment
          </button>

          <button className="burger" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menu">
            {mobileOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            className="mnav"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            {links.map((label) => (
              <button key={label} onClick={() => go(label)}>
                {label}
              </button>
            ))}

            <button className="btn" onClick={() => go('Booking')}>
              Book Appointment
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
