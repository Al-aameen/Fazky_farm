import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { getCachedData } from '../lib/offlineQueue';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load worker metadata by email or authUserId (either from Supabase or IndexedDB)
  const fetchWorkerDetails = async (email, authUserId = null) => {
    try {
      let foundWorker = null;

      // 1. If Supabase is configured, try querying live Supabase database first
      if (isSupabaseConfigured && (authUserId || email)) {
        // Try matching by auth_user_id first
        if (authUserId) {
          const { data } = await supabase
            .from('workers')
            .select('*')
            .eq('auth_user_id', authUserId)
            .maybeSingle();
          if (data) foundWorker = data;
        }

        // If not found by auth_user_id, try matching by email
        if (!foundWorker && email) {
          const { data } = await supabase
            .from('workers')
            .select('*')
            .ilike('email', email)
            .maybeSingle();
          if (data) {
            foundWorker = data;
            // Auto-link auth_user_id if missing
            if (authUserId && !data.auth_user_id) {
              await supabase
                .from('workers')
                .update({ auth_user_id: authUserId })
                .eq('id', data.id);
            }
          }
        }
      }

      // 2. Fall back to local IndexedDB cache
      if (!foundWorker && email) {
        const workers = await getCachedData('workers');
        foundWorker = (workers || []).find(w => w.email.toLowerCase() === email.toLowerCase());
      }

      // 3. Fall back: If authenticated in Supabase but no worker record exists yet, auto-provision as Admin
      if (!foundWorker && isSupabaseConfigured && email) {
        const newWorker = {
          name: email.split('@')[0] || 'Admin User',
          email: email.toLowerCase(),
          role: 'admin',
          status: 'active',
          auth_user_id: authUserId
        };

        try {
          const { data } = await supabase
            .from('workers')
            .insert(newWorker)
            .select()
            .single();
          if (data) foundWorker = data;
        } catch (e) {
          console.warn('Could not auto-insert worker in Supabase:', e);
        }

        if (!foundWorker) {
          foundWorker = newWorker;
        }
      }

      if (foundWorker) {
        setWorker(foundWorker);
        setRole(foundWorker.role || 'admin');
        return foundWorker;
      }
    } catch (err) {
      console.error('Error fetching worker details:', err);
    }

    // Default fallback for authenticated users so they are never locked out with role ()
    if (email) {
      const fallbackWorker = { name: email.split('@')[0], email, role: 'admin' };
      setWorker(fallbackWorker);
      setRole('admin');
      return fallbackWorker;
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
        setRole(simUser.role || 'admin');
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
        let found = (workers || []).find(w => w.email.toLowerCase() === email.toLowerCase());
        
        if (!found) {
          found = { name: email.split('@')[0], email, role: 'admin', status: 'active' };
        }
        
        const sessionUser = { ...found, isSimulated: true };
        localStorage.setItem('fazky_simulated_session', JSON.stringify(sessionUser));
        setUser({ email: found.email, id: found.id || 'sim-user', isSimulated: true });
        setRole(found.role || 'admin');
        setWorker(found);
        return { success: true };
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
