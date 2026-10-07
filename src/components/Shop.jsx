import { useState } from 'react';
import { Heart, Star } from 'lucide-react';
import { products } from '../data/data';
import { useCart } from '../context/CartContext';

export default function Shop() {
  const [query, setQuery] = useState('');
  const { add, wish, toggleWish } = useCart();

  const list = products.filter((product) => product.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <section id="shop" className="sec">
      <div className="wrap">
        <h2>Nail care, delivered</h2>

        <input
          className="search"
          placeholder="Search products"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        {list.length === 0 ? (
          <p className="muted">No products match “{query}”. Try a shorter search.</p>
        ) : (
          <div className="grid g3">
            {list.map((product) => (
              <article key={product.id} className="card">
                <div className="ph">
                  <img loading="lazy" src={product.img} alt={product.name} />
                  {product.old && <span className="tag">{Math.round((1 - product.price / product.old) * 100)}% off</span>}
                  <button
                    className={'heart' + (wish.includes(product.id) ? ' on' : '')}
                    onClick={() => toggleWish(product.id)}
                    aria-label="Wishlist"
                  >
                    <Heart size={18} />
                  </button>
                </div>

                <div className="cb">
                  <h3>{product.name}</h3>
                  <p className="muted">
                    <Star size={14} fill="currentColor" /> {product.rating}
                  </p>

                  <div className="row sb">
                    <span>
                      <strong>₹{product.price}</strong> {product.old && <s className="muted">₹{product.old}</s>}
                    </span>
                    <button className="btn sm" onClick={() => add(product)}>
                      Add to Cart
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
