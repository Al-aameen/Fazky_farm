import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-farm flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary border-b-2"></div>
          <p className="text-sm text-text-muted font-sans">Checking credentials...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    // We can handle navigation in App.jsx, but returning a wrapper or fallback is very clean
    return null; 
  }

  // Check role authorization
  if (allowedRoles && !allowedRoles.includes(role)) {
    return (
      <div className="min-h-screen bg-bg-farm flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl p-8 border border-border-farm text-center shadow-lg">
          <div className="text-red-accent text-5xl mb-3">⚠️</div>
          <h2 className="text-2xl font-serif text-dark-green mb-2">Access Denied</h2>
          <p className="text-sm text-text-muted font-sans mb-4">
            Your worker profile ({role}) does not have permission to view this module.
          </p>
        </div>
      </div>
    );
  }

  return children;
}
