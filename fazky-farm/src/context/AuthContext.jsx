import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getCachedData } from '../lib/offlineQueue';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load worker metadata by email (either from Supabase or IndexedDB)
  const fetchWorkerDetails = async (email, authUserId = null) => {
    try {
      // First try to fetch from local IndexedDB cache since it contains seed data
      const workers = await getCachedData('workers');
      let foundWorker = workers.find(w => w.email.toLowerCase() === email.toLowerCase());

      // If we are online and have Supabase, we can check database too
      if (!foundWorker && isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('workers')
          .select('*')
          .eq('email', email)
          .single();
        if (!error && data) {
          foundWorker = data;
        }
      }

      if (foundWorker) {
        setWorker(foundWorker);
        setRole(foundWorker.role);
        return foundWorker;
      }
    } catch (err) {
      console.error('Error fetching worker details:', err);
    }
    return null;
  };

  useEffect(() => {
    if (isSupabaseConfigured) {
      // 1. Supabase Auth setup
      const getSession = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          await fetchWorkerDetails(session.user.email, session.user.id);
        } else {
          // Check for simulated session in localStorage
          loadSimulatedSession();
        }
        setLoading(false);
      };

      getSession();

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          await fetchWorkerDetails(session.user.email, session.user.id);
        } else {
          setUser(null);
          setRole(null);
          setWorker(null);
        }
        setLoading(false);
      });

      return () => {
        subscription.unsubscribe();
      };
    } else {
      // 2. Simulated Auth setup (No Supabase)
      loadSimulatedSession();
      setLoading(false);
    }
  }, []);

  const loadSimulatedSession = () => {
    const cachedSession = localStorage.getItem('fazky_simulated_session');
    if (cachedSession) {
      try {
        const simUser = JSON.parse(cachedSession);
        setUser({ email: simUser.email, id: simUser.id, isSimulated: true });
        setRole(simUser.role);
        setWorker(simUser);
      } catch (err) {
        localStorage.removeItem('fazky_simulated_session');
      }
    }
  };

  // Sign In function supporting both modes
  const login = async (email, password) => {
    setLoading(true);
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;
        setUser(data.user);
        await fetchWorkerDetails(data.user.email, data.user.id);
        return { success: true };
      } else {
        // Local Simulation Login
        const workers = await getCachedData('workers');
        const found = workers.find(w => w.email.toLowerCase() === email.toLowerCase());
        
        if (found) {
          // If no password check in simulation, log in directly
          const sessionUser = { ...found, isSimulated: true };
          localStorage.setItem('fazky_simulated_session', JSON.stringify(sessionUser));
          setUser({ email: found.email, id: found.id, isSimulated: true });
          setRole(found.role);
          setWorker(found);
          return { success: true };
        } else {
          throw new Error('Worker email not found in local seed list.');
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const loginWithMagicLink = async (email) => {
    setLoading(true);
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: window.location.origin
          }
        });
        if (error) throw error;
        return { success: true, message: 'Magic link sent to your email.' };
      } else {
        // Simulation Magic Link
        return await login(email, '');
      }
    } catch (err) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin
          }
        });
        if (error) throw error;
      } else {
        // Simulation Google Login
        return await login('admin@fazky.com', '');
      }
    } catch (err) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      if (isSupabaseConfigured && !user?.isSimulated) {
        await supabase.auth.signOut();
      }
      localStorage.removeItem('fazky_simulated_session');
      setUser(null);
      setRole(null);
      setWorker(null);
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      role,
      worker,
      loading,
      login,
      loginWithMagicLink,
      loginWithGoogle,
      logout,
      isSimulationMode: !isSupabaseConfigured
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
