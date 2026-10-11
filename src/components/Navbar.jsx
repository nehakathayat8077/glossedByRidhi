import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Menu, X, Instagram, MessageCircle, UserRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
const links = ['Home', 'About', 'Designs', 'Services', 'Shop', 'Booking'];
const instagramHandle = import.meta.env.VITE_INSTAGRAM_HANDLE;
const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER;

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { count, setOpen } = useCart();
  const { session } = useAuth();
  const navigate = useNavigate();

  // Update the sticky header state when the page scrolls.
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', handleScroll);

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll to the requested page section and close the mobile menu.
  const go = (label) => {
    setMobileOpen(false);
    const target = document.getElementById(label.toLowerCase());
    if (target) target.scrollIntoView({ behavior: 'smooth' });
    else {
      navigate('/');
      window.setTimeout(() => document.getElementById(label.toLowerCase())?.scrollIntoView({ behavior: 'smooth' }), 0);
    }
  };

  return (
    <header className={'nav' + (scrolled ? ' scrolled' : '')}>
      <div className="wrap nav-in">
        <Link className="logo" to="/">
          GlossedBy<em>Ridhi</em>
        </Link>

        <nav className="links">
          {links.map((label) => (
            <button key={label} onClick={() => go(label)}>
              {label}
            </button>
          ))}
        </nav>

        <div className="nav-r">
          <a href={`https://www.instagram.com/${instagramHandle}/`} aria-label="Instagram">
            <Instagram size={18} />
          </a>
          <a href={`https://wa.me/${whatsappNumber}`} aria-label="WhatsApp">
            <MessageCircle size={18} />
          </a>

          <button className="cart" onClick={() => setOpen(true)} aria-label="Cart">
            <ShoppingBag size={20} />
            {count > 0 && <b>{count}</b>}
          </button>

          <Link className="nav-account" to={session ? '/account' : '/login'} aria-label={session ? 'My account' : 'Sign in'}>
            <UserRound size={18} />
            <span>{session ? 'Account' : 'Sign in'}</span>
          </Link>

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

            <Link className="nav-mobile-account" to={session ? '/account' : '/login'} onClick={() => setMobileOpen(false)}>
              {session ? 'My account' : 'Sign in / Create account'}
            </Link>

            <button className="btn" onClick={() => go('Booking')}>
              Book Appointment
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
