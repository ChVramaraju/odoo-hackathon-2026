import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Hexagon, RefreshCw } from 'lucide-react';

export const ProtectedRoute: React.FC = () => {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-12 h-12 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-glow-emerald">
          <Hexagon className="w-7 h-7 fill-emerald-500/20 text-emerald-400 animate-pulse" />
        </div>
        <div className="flex items-center gap-2 text-surface-text text-sm font-medium">
          <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
          <span>Restoring Brightloop session...</span>
        </div>
        <p className="text-xs text-surface-textMuted">Verifying identity against Supabase Auth</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
};

