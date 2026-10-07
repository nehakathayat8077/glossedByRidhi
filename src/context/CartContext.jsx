import { createContext, useContext, useEffect, useState } from 'react';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

// Restore a saved list when possible; malformed or missing storage starts empty.
const load = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
};

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => load('glossedByRidhi-cart'));
  const [wish, setWish] = useState(() => load('glossedByRidhi-wish'));
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState('');

  // Keep cart and wishlist state available after the page reloads.
  useEffect(() => {
    localStorage.setItem('glossedByRidhi-cart', JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    localStorage.setItem('glossedByRidhi-wish', JSON.stringify(wish));
  }, [wish]);

  const say = (message) => {
    setToast(message);
    setTimeout(() => setToast(''), 2200);
  };

  const add = (product) => {
    setItems((currentItems) =>
      currentItems.find((item) => item.id === product.id)
        ? currentItems.map((item) =>
            item.id === product.id ? { ...item, qty: item.qty + 1 } : item
          )
        : [...currentItems, { ...product, qty: 1 }]
    );
    say(`${product.name} added to cart`);
  };

  const qty = (id, difference) => {
    setItems((currentItems) =>
      currentItems
        .map((item) =>
          item.id === id ? { ...item, qty: item.qty + difference } : item
        )
        .filter((item) => item.qty > 0)
    );
  };

  const remove = (id) => {
    setItems((currentItems) => currentItems.filter((item) => item.id !== id));
  };

  const toggleWish = (id) => {
    setWish((currentWish) =>
      currentWish.includes(id)
        ? currentWish.filter((itemId) => itemId !== id)
        : [...currentWish, id]
    );
  };

  const count = items.reduce((total, item) => total + item.qty, 0);
  const subtotal = items.reduce(
    (total, item) => total + item.qty * item.price,
    0
  );

  return (
    <CartContext.Provider
      value={{
        items,
        add,
        qty,
        remove,
        wish,
        toggleWish,
        open,
        setOpen,
        count,
        subtotal,
        toast,
        say,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
