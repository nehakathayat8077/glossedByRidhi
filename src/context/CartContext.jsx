import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../lib/supabaseClient';

const CartContext = createContext(null);
const guestCartKey = 'glossedByRidhi-cart';
const guestWishlistKey = 'glossedByRidhi-wish';

export const useCart = () => useContext(CartContext);

function loadGuestList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    if (Array.isArray(value)) return value;
    console.error(`Saved guest data in ${key} is not a list.`);
  } catch (storageError) {
    console.error(`Could not restore guest data from ${key}.`, storageError);
  }
  return [];
}

export function CartProvider({ children }) {
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user?.id || null;
  const [store, setStore] = useState(() => ({
    userId: null,
    items: loadGuestList(guestCartKey),
    wish: loadGuestList(guestWishlistKey),
    hydrated: true,
    dirty: false,
  }));
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState('');
  const toastTimer = useRef(null);
  const loadSequence = useRef(0);
  const writeQueue = useRef(Promise.resolve());
  const activeUserId = useRef(userId);
  activeUserId.current = authLoading ? null : userId;

  const say = useCallback((message) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 2200);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
  }, []);

  useEffect(() => {
    if (authLoading) return undefined;

    const sequence = ++loadSequence.current;
    if (!userId) {
      setStore({
        userId: null,
        items: loadGuestList(guestCartKey),
        wish: loadGuestList(guestWishlistKey),
        hydrated: true,
        dirty: false,
      });
      return undefined;
    }

    setStore({ userId, items: [], wish: [], hydrated: false, dirty: false });
    let active = true;

    const loadUserStore = async () => {
      const { data, error } = await supabase
        .from('customer_store_state')
        .select('cart, wishlist')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      if (!active || sequence !== loadSequence.current) return;

      setStore({
        userId,
        items: Array.isArray(data?.cart) ? data.cart : [],
        wish: Array.isArray(data?.wishlist) ? data.wishlist : [],
        hydrated: true,
        dirty: false,
      });
    };

    loadUserStore().catch((loadError) => {
      if (!active || sequence !== loadSequence.current) return;
      console.error('Could not load the saved cart and wishlist.', loadError);
      say(`Could not load your saved cart and wishlist: ${loadError.message || 'Please try again.'}`);
    });

    return () => {
      active = false;
    };
  }, [authLoading, say, userId]);

  useEffect(() => {
    if (store.userId !== null || !store.hydrated) return;
    try {
      localStorage.setItem(guestCartKey, JSON.stringify(store.items));
      localStorage.setItem(guestWishlistKey, JSON.stringify(store.wish));
    } catch (storageError) {
      console.error('Could not save the guest cart and wishlist.', storageError);
      say(`Could not save your cart: ${storageError.message || 'browser storage is unavailable.'}`);
    }
  }, [say, store]);

  useEffect(() => {
    if (authLoading || !userId || store.userId !== userId || !store.hydrated || !store.dirty) return undefined;

    const snapshot = {
      user_id: userId,
      cart: store.items,
      wishlist: store.wish,
    };
    const write = writeQueue.current.catch(() => undefined).then(async () => {
      if (activeUserId.current !== userId) return;
      const { error } = await supabase
        .from('customer_store_state')
        .upsert(snapshot, { onConflict: 'user_id' });
      if (error) throw error;
    });
    writeQueue.current = write;
    write.then(() => {
      setStore((current) => current.userId === userId
        && current.items === snapshot.cart
        && current.wish === snapshot.wishlist
        ? { ...current, dirty: false }
        : current);
    }).catch((writeError) => {
      console.error('Could not save the customer cart and wishlist.', writeError);
      say(`Could not save your cart and wishlist: ${writeError.message || 'Please try again.'}`);
    });

    return undefined;
  }, [authLoading, say, store, userId]);

  const update = useCallback((field, updater) => {
    if (store.userId !== userId || !store.hydrated) {
      say('Your saved cart is not ready yet. Please try again in a moment.');
      return false;
    }
    setStore((current) => {
      if (current.userId !== userId || (userId && !current.hydrated)) return current;
      const nextValue = typeof updater === 'function' ? updater(current[field]) : updater;
      return { ...current, [field]: nextValue, dirty: Boolean(userId) };
    });
    return true;
  }, [say, store.hydrated, store.userId, userId]);

  const add = (product) => {
    if (!update('items', (currentItems) =>
      currentItems.find((item) => item.id === product.id)
        ? currentItems.map((item) =>
            item.id === product.id ? { ...item, qty: item.qty + 1 } : item
          )
        : [...currentItems, { ...product, qty: 1 }]
    )) return;
    say(`${product.name} added to cart`);
  };

  const qty = (id, difference) => {
    update('items', (currentItems) =>
      currentItems
        .map((item) =>
          item.id === id ? { ...item, qty: item.qty + difference } : item
        )
        .filter((item) => item.qty > 0)
    );
  };

  const remove = (id) => {
    update('items', (currentItems) => currentItems.filter((item) => item.id !== id));
  };

  const clear = () => update('items', []);

  const toggleWish = (id) => {
    update('wish', (currentWish) =>
      currentWish.includes(id)
        ? currentWish.filter((itemId) => itemId !== id)
        : [...currentWish, id]
    );
  };

  const visible = !authLoading && store.userId === userId && store.hydrated;
  const items = visible ? store.items : [];
  const wish = visible ? store.wish : [];
  const count = items.reduce((total, item) => total + item.qty, 0);
  const subtotal = items.reduce((total, item) => total + item.qty * item.price, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        add,
        qty,
        remove,
        clear,
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
