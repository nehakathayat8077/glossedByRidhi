import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Services from './components/Services';
import NailDesigns from './components/NailDesigns';
import Shop from './components/Shop';
import Booking from './components/Booking';
import FAQ from './components/FAQ';
import Footer from './components/Footer';
import CartDrawer from './components/CartDrawer';

export default function App() {
  return (
    <>
      <Navbar />

      <main>
        {/* Hero banner and brand introduction */}
        <Hero />

        <section id="about" className="sec">
          <div className="wrap narrow">
            <h2>More than nails. It is your little moment of luxury.</h2>
            <p className="lead">
              Every set is handcrafted with premium products, a hygienic process and a style built around you.
            </p>
          </div>
        </section>

        {/* Core service and shopping sections */}
        <Services />
        <NailDesigns />
        <Shop />
        <Booking />
        <FAQ />
      </main>

      <Footer />
      <CartDrawer />
    </>
  );
}
