import { useCart } from '../context/CartContext';

export default function Footer() {
  const { say, toast } = useCart();

  return (
    <>
      <footer className="foot">
        <div className="wrap fg">
          <div>
            <a className="logo">
              GlossedBy<em>Ridhi</em>
            </a>
            <p>Handcrafted nail art for your little moment of luxury.</p>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              say('Subscribed. Welcome to the list');
              event.target.reset();
            }}
          >
            <p>Get nail inspiration & exclusive offers</p>
            <div className="row">
              <input required type="email" placeholder="Email address" />
              <button className="btn sm">Subscribe</button>
            </div>
          </form>
        </div>

        <p className="wrap copy">© 2026 Glossed By Ridhi. All Rights Reserved.</p>
      </footer>

      <a className="wa" href="https://wa.me/918279397721" aria-label="WhatsApp">
        WhatsApp
      </a>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
