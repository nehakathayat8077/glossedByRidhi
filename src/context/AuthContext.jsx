import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext(null);
const pendingActionKey = 'glossedByRidhi-pending-customer-action';
const customerActions = new Set(['appointment', 'order']);

function readPendingAction() {
  try {
    const action = sessionStorage.getItem(pendingActionKey);
    return customerActions.has(action) ? action : null;
  } catch (storageError) {
    console.error('Could not restore the pending customer action.', storageError);
    return null;
  }
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingAction, setPendingAction] = useState(readPendingAction);
  const pendingActionRef = useRef(pendingAction);

  const requestAuthentication = useCallback((action) => {
    if (!customerActions.has(action)) throw new Error('Unsupported customer action.');
    pendingActionRef.current = action;
    setPendingAction(action);
    try {
      sessionStorage.setItem(pendingActionKey, action);
    } catch (storageError) {
      console.error('Could not persist the pending customer action.', storageError);
    }
  }, []);

  const consumePendingAction = useCallback((action) => {
    if (pendingActionRef.current !== action) return false;
    pendingActionRef.current = null;
    setPendingAction(null);
    try {
      sessionStorage.removeItem(pendingActionKey);
    } catch (storageError) {
      console.error('Could not clear the saved customer action.', storageError);
    }
    return true;
  }, []);

  const clearPendingAction = useCallback(() => {
    pendingActionRef.current = null;
    setPendingAction(null);
    try {
      sessionStorage.removeItem(pendingActionKey);
    } catch (storageError) {
      console.error('Could not clear the saved customer action.', storageError);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const { data: authListener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (mounted) {
        setSession(nextSession);
        setLoading(false);
        setError('');
        if (event === 'SIGNED_OUT') clearPendingAction();
      }
    });

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!mounted) return;
      setSession(data.session);
      setError(sessionError?.message || '');
      setLoading(false);
    }).catch((sessionError) => {
      if (!mounted) return;
      setError(sessionError.message || 'Could not verify the current session.');
      setLoading(false);
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [clearPendingAction]);

  return (
    <AuthContext.Provider value={{
      session,
      loading,
      error,
      pendingAction,
      requestAuthentication,
      consumePendingAction,
      clearPendingAction,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
