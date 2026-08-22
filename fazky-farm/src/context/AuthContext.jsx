import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load worker metadata by email or authUserId directly from Supabase
  const fetchWorkerDetails = useCallback(async (email, authUserId = null) => {
    try {
      if (!isSupabaseConfigured || (!authUserId && !email)) {
        return null;
      }

      let foundWorker = null;

      // 1. Try matching by auth_user_id first
      if (authUserId) {
        const { data, error } = await supabase
          .from('workers')
          .select('*')
          .eq('auth_user_id', authUserId)
          .maybeSingle();

        if (!error && data) {
          foundWorker = data;
        }
      }

      // 2. If not found by auth_user_id, try matching by email
      if (!foundWorker && email) {
        const { data, error } = await supabase
          .from('workers')
          .select('*')
          .ilike('email', email)
          .maybeSingle();

        if (!error && data) {
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

      // 3. Fallback: If authenticated in Supabase but no worker record exists yet, auto-provision as Admin
      if (!foundWorker && email) {
        const newWorker = {
          name: email.split('@')[0] || 'Admin User',
          email: email.toLowerCase(),
          role: 'admin',
          status: 'active',
          auth_user_id: authUserId
        };

        try {
          const { data, error } = await supabase
            .from('workers')
            .insert(newWorker)
            .select()
            .single();

          if (!error && data) {
            foundWorker = data;
          }
        } catch (e) {
          console.warn('[AuthContext] Could not auto-insert worker in Supabase:', e);
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
      console.error('[AuthContext] Error fetching worker details:', err);
    }

    // Default fallback so authenticated users are never locked out
    if (email) {
      const fallbackWorker = { name: email.split('@')[0], email, role: 'admin' };
      setWorker(fallbackWorker);
      setRole('admin');
      return fallbackWorker;
    }

    return null;
  }, []);

  // Update current worker profile (e.g. avatar, name)
  const updateProfile = async (updates) => {
    if (!worker?.id) return { success: false, error: 'No active worker profile' };
    try {
      const { data, error } = await supabase
        .from('workers')
        .update(updates)
        .eq('id', worker.id)
        .select()
        .single();

      if (error) throw error;
      setWorker(data);
      if (data.role) setRole(data.role);
      return { success: true, worker: data };
    } catch (err) {
      console.error('[AuthContext] Update profile error:', err);
      return { success: false, error: err.message };
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // 1. Initial Session Check
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('[AuthContext] getSession error:', error.message);
        }
        if (session?.user) {
          setUser(session.user);
          await fetchWorkerDetails(session.user.email, session.user.id);
        } else {
          setUser(null);
          setRole(null);
          setWorker(null);
        }
      } catch (err) {
        console.error('[AuthContext] Error checking session:', err);
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // 2. Auth State Change Listener
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
  }, [fetchWorkerDetails]);

  // Sign In function
  const login = async (email, password) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
      setUser(data.user);
      await fetchWorkerDetails(data.user.email, data.user.id);
      return { success: true };
    } catch (err) {
      console.error('[AuthContext] Login error:', err);
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const loginWithMagicLink = async (email) => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin
        }
      });
      if (error) throw error;
      return { success: true, message: 'Magic link sent to your email.' };
    } catch (err) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err) {
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setUser(null);
      setRole(null);
      setWorker(null);
    } catch (err) {
      console.error('[AuthContext] Logout error:', err);
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
      updateProfile,
      isSimulationMode: false
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
