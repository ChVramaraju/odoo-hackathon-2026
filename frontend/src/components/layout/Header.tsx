import React, { useEffect, useState } from 'react';
import { Search, Bell, CheckCircle2, AlertTriangle, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../api/client';
import { Badge } from '../ui/Badge';

export const Header: React.FC = () => {
  const { user, role } = useAuth();
  const [backendStatus, setBackendStatus] = useState<'connected' | 'mock-mode' | 'checking'>('checking');
  const [currency, setCurrency] = useState<'USD' | 'EUR' | 'INR'>('USD');

  useEffect(() => {
    let isMounted = true;
    apiClient
      .getHealth()
      .then((res) => {
        if (!isMounted) return;
        if (res.status === 'ok') {
          setBackendStatus('connected');
        } else {
          setBackendStatus('mock-mode');
        }
      })
      .catch(() => {
        if (isMounted) setBackendStatus('mock-mode');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <header className="fixed top-0 left-64 right-0 h-16 bg-forest-950/80 backdrop-blur-xl border-b border-surface-border/60 z-30 flex items-center justify-between px-6">
      {/* Search Bar */}
      <div className="relative w-96">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-textMuted" />
        <input
          type="text"
          placeholder="Search catalog, plans, subscriptions..."
          className="w-full h-9 pl-9 pr-12 rounded-lg bg-forest-850/60 border border-surface-border text-xs text-surface-text placeholder:text-surface-subtle focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-forest-900 text-surface-textMuted border border-surface-border">
          ⌘K
        </span>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-4">
        {/* Backend health status badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-forest-900 border border-surface-border text-xs">
          {backendStatus === 'connected' ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium text-[11px]">FastAPI Live</span>
            </>
          ) : (
            <>
              <AlertTriangle className="w-3.5 h-3.5 text-mint-400" />
              <span className="text-mint-400 font-medium text-[11px]">Mock Mode Ready</span>
            </>
          )}
        </div>

        {/* Currency Switcher */}
        <div className="flex items-center bg-forest-900 border border-surface-border rounded-lg p-0.5">
          {(['USD', 'EUR', 'INR'] as const).map((curr) => (
            <button
              key={curr}
              onClick={() => setCurrency(curr)}
              className={`px-2 py-1 text-xs rounded font-medium transition-all ${
                currency === curr ? 'bg-forest-800 text-emerald-400 font-bold' : 'text-surface-textMuted hover:text-surface-text'
              }`}
            >
              {curr === 'USD' ? '$ USD' : curr === 'EUR' ? '€ EUR' : '₹ INR'}
            </button>
          ))}
        </div>

        {/* Notifications */}
        <button
          className="p-2 rounded-lg text-surface-textMuted hover:text-surface-text hover:bg-forest-900 border border-transparent hover:border-surface-border transition-all relative"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500" />
        </button>

        {/* User Profile */}
        <div className="flex items-center gap-3 pl-2 border-l border-surface-border/60">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-surface-text leading-tight">{user?.name || 'Elena Vance'}</div>
            <div className="flex items-center justify-end gap-1 mt-0.5">
              <Badge variant={role === 'admin' ? 'emerald' : role === 'staff' ? 'mint' : 'forest'} className="text-[9px] py-0 px-1">
                {role}
              </Badge>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <UserIcon className="w-4 h-4" />
          </div>
        </div>
      </div>
    </header>
  );
};

