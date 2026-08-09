import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { KeyRound, Mail, Sparkles, AlertCircle, ArrowRight, ShieldCheck, UserCheck } from 'lucide-react';
import { getCachedData } from '../lib/offlineQueue';

export default function LoginPage() {
  const { login, loginWithMagicLink, loginWithGoogle, isSimulationMode } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [magicEmail, setMagicEmail] = useState('');
  
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [seedWorkers, setSeedWorkers] = useState([]);

  useEffect(() => {
    // Fetch local workers to populate the quick login selector
    const loadSeedWorkers = async () => {
      const workers = await getCachedData('workers');
      setSeedWorkers(workers || []);
    };
    loadSeedWorkers();
  }, []);

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    if (!email) return setError('Email is required');
    if (!isSimulationMode && !password) return setError('Password is required');
    
    setError('');
    setSuccess('');
    setSubmitting(true);
    
    const res = await login(email, password);
    if (!res.success) {
      setError(res.error || 'Failed to sign in.');
      setSubmitting(false);
    }
  };

  const handleMagicLinkLogin = async (e) => {
    e.preventDefault();
    if (!magicEmail) return setError('Email is required');
    
    setError('');
    setSuccess('');
    setSubmitting(true);
    
    const res = await loginWithMagicLink(magicEmail);
    if (res.success) {
      setSuccess(res.message || 'Login link sent successfully!');
      setSubmitting(false);
    } else {
      setError(res.error || 'Failed to send magic link.');
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setSuccess('');
    setSubmitting(true);
    const res = await loginWithGoogle();
    if (res && !res.success) {
      setError(res.error || 'Google login failed.');
      setSubmitting(false);
    }
  };

  const handleQuickLogin = async (workerEmail) => {
    setError('');
    setSuccess('');
    setSubmitting(true);
    const res = await login(workerEmail, '');
    if (!res.success) {
      setError(res.error || 'Quick login failed.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-farm flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-border-farm overflow-hidden">
        {/* Header Branding */}
        <div className="bg-dark-green p-8 text-center text-white relative">
          <div className="absolute top-3 right-3 bg-accent text-dark-green text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
            <Sparkles className="w-3 h-3" />
            {isSimulationMode ? 'Simulation Mode' : 'Supabase Live'}
          </div>
          
          <div className="flex justify-center mb-2">
            <span className="text-4xl">🌾</span>
          </div>
          <h1 className="text-3xl font-serif text-white tracking-tight">FAZKY FARM</h1>
          <p className="text-light-green text-sm font-sans mt-1">Management Ledger Portal</p>
        </div>

        <div className="p-8 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-accent text-sm rounded-lg p-3 flex gap-2 items-center">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 text-primary text-sm rounded-lg p-3 flex gap-2 items-center">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Method 1: Email & Password */}
          <form onSubmit={handlePasswordLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@fazky.com"
                  className="w-full bg-bg-farm border border-border-farm rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                />
                <Mail className="w-4 h-4 text-text-muted absolute left-3 top-3" />
              </div>
            </div>

            {!isSimulationMode && (
              <div>
                <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-bg-farm border border-border-farm rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                  />
                  <KeyRound className="w-4 h-4 text-text-muted absolute left-3 top-3" />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary hover:bg-dark-green text-white font-medium py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
            >
              Sign In with Credentials
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-border-farm"></div>
            <span className="flex-shrink mx-4 text-text-muted text-xs font-bold uppercase tracking-widest">
              or
            </span>
            <div className="flex-grow border-t border-border-farm"></div>
          </div>

          {/* Method 2: Magic Link */}
          <form onSubmit={handleMagicLinkLogin} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1">
                Sign in with Magic Link
              </label>
              <div className="relative flex gap-2">
                <div className="relative flex-grow">
                  <input
                    type="email"
                    value={magicEmail}
                    onChange={(e) => setMagicEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full bg-bg-farm border border-border-farm rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent transition-all"
                  />
                  <Mail className="w-4 h-4 text-text-muted absolute left-3 top-3" />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-accent hover:bg-opacity-90 text-dark-green font-medium px-4 rounded-lg text-xs transition-colors shrink-0 flex items-center justify-center shadow-sm disabled:opacity-50"
                >
                  Send Link
                </button>
              </div>
            </div>
          </form>

          {/* Method 3: Google OAuth */}
          <button
            onClick={handleGoogleLogin}
            disabled={submitting}
            className="w-full border border-border-farm hover:bg-bg-farm text-text-primary font-medium py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            Sign In with Google
          </button>

          {/* Developer Quick Login - Premium Simulation View */}
          {isSimulationMode && seedWorkers.length > 0 && (
            <div className="mt-8 pt-6 border-t border-border-farm bg-light-green p-4 rounded-xl border border-dashed border-accent">
              <div className="flex items-center gap-1.5 text-dark-green font-serif text-sm font-bold mb-3">
                <UserCheck className="w-4 h-4 text-primary" />
                <span>Simulation Quick Login</span>
              </div>
              <p className="text-xs text-text-muted mb-4 font-sans leading-relaxed">
                Click any seeded account profile below to login instantly as that role.
              </p>
              
              <div className="grid grid-cols-2 gap-2">
                {/* Admin */}
                <button
                  onClick={() => handleQuickLogin('admin@fazky.com')}
                  className="bg-white hover:bg-primary hover:text-white border border-border-farm rounded-lg p-2 text-left text-xs transition-all shadow-sm group"
                >
                  <div className="font-bold text-text-primary group-hover:text-white">Admin User</div>
                  <div className="text-[10px] text-text-muted group-hover:text-light-green">Full Access</div>
                </button>

                {/* Manager */}
                <button
                  onClick={() => handleQuickLogin('manager@fazky.com')}
                  className="bg-white hover:bg-primary hover:text-white border border-border-farm rounded-lg p-2 text-left text-xs transition-all shadow-sm group"
                >
                  <div className="font-bold text-text-primary group-hover:text-white">Manager User</div>
                  <div className="text-[10px] text-text-muted group-hover:text-light-green">General Records</div>
                </button>

                {/* Staff: Muslimat */}
                <button
                  onClick={() => handleQuickLogin('muslimat@fazky.com')}
                  className="bg-white hover:bg-primary hover:text-white border border-border-farm rounded-lg p-2 text-left text-xs transition-all shadow-sm group"
                >
                  <div className="font-bold text-text-primary group-hover:text-white">Muslimat (Staff)</div>
                  <div className="text-[10px] text-text-muted group-hover:text-light-green">Muslimat Pen Only</div>
                </button>

                {/* Staff: Iya Arishe */}
                <button
                  onClick={() => handleQuickLogin('iyaarishe@fazky.com')}
                  className="bg-white hover:bg-primary hover:text-white border border-border-farm rounded-lg p-2 text-left text-xs transition-all shadow-sm group"
                >
                  <div className="font-bold text-text-primary group-hover:text-white">Iya Arishe (Staff)</div>
                  <div className="text-[10px] text-text-muted group-hover:text-light-green">Iya Arishe Pen Only</div>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
