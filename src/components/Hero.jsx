import { motion } from 'framer-motion';
import heroNails from '../assets/hero-nails.png';
export default function Hero() {
  const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <section id="home" className="hero">
      <div className="wrap hero-in ">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <h1>
            Your Nails.
            <br />
            Your Signature.
          </h1>
          <p>Beautiful nail art, crafted with care and made to match your style.</p>

          <div className="row">
            <button className="btn" onClick={() => go('booking')}>
              Book Your Appointment
            </button>
            <button className="btn ghost" onClick={() => go('designs')}>
              Explore Nail Designs
            </button>
          </div>

          <p className="badge">
            <b>500+ Happy Clients</b> Premium nail art, custom designs, handcrafted
          </p>
        </motion.div>

        <motion.div
          className="hero-img"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <motion.img
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            src={heroNails}
            alt="Hand with blush nail art"
          />
          <span className="spark s1">✦</span>
          <span className="spark s2">✧</span>
          <span className="blob" />
        </motion.div>
      </div>

      <div className="wrap trust">
        {['Premium Nail Art', 'Custom Designs', '500+ Happy Clients', 'Safe & Beautiful Packaging'].map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </section>
  );
}
