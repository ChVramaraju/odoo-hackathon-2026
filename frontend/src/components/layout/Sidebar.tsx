import React, { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Layers,
  FileSpreadsheet,
  RefreshCw,
  Receipt,
  CreditCard,
  UserCheck,
  Hexagon,
  X,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../ui/Badge';

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const adminStaffNavItems: NavItem[] = [
  { name: 'Overview', path: '/', icon: LayoutDashboard },
  { name: 'Products & Variants', path: '/products', icon: Package },
  { name: 'Subscription Plans', path: '/plans', icon: Layers },
  { name: 'Quotations', path: '/quotations', icon: FileSpreadsheet, badge: 'Contract' },
  { name: 'Subscriptions', path: '/subscriptions', icon: RefreshCw, badge: 'Core' },
  { name: 'Invoices & Billing', path: '/invoices', icon: Receipt },
  { name: 'Payments & Balance', path: '/payments', icon: CreditCard },
  { name: 'Customer Portal', path: '/portal', icon: UserCheck },
];

const customerNavItems: NavItem[] = [
  { name: 'Customer Dashboard', path: '/portal?tab=dashboard', icon: LayoutDashboard },
  { name: 'My Subscriptions', path: '/portal?tab=subscriptions', icon: RefreshCw },
  { name: 'My Invoices', path: '/portal?tab=invoices', icon: Receipt },
  { name: 'Payment History', path: '/portal?tab=payments', icon: CreditCard },
  { name: 'Account & Profile', path: '/portal?tab=profile', icon: UserCheck },
];

export const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const { user, role, switchRole, logout, isEvaluatorMode, isRealAuth } = useAuth();
  const location = useLocation();
  const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development' || import.meta.env.MODE === 'test';

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const activeNavItems = role === 'customer' ? customerNavItems : adminStaffNavItems;

  const isItemActive = (itemPath: string) => {
    if (itemPath.includes('?')) {
      const fullCurrent = location.pathname + (location.search || '?tab=dashboard');
      return fullCurrent === itemPath;
    }
    return location.pathname === itemPath;
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-forest-950/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-full w-64 bg-forest-950 border-r border-surface-border z-50 flex flex-col justify-between transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Brand Header */}
          <div className="h-16 px-5 flex items-center justify-between border-b border-surface-border/60 bg-forest-900/40">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <Hexagon className="w-5 h-5 fill-emerald-500/20 text-emerald-400 animate-pulse" />
              </div>
              <div>
                <span className="font-heading text-lg font-bold text-surface-text tracking-tight block leading-tight">
                  Brightloop
                </span>
                <span className="text-[10px] uppercase font-semibold tracking-wider text-emerald-400/80">
                  Revenue in Motion
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="emerald" className="text-[10px] px-1.5 py-0.5">
                FinOps
              </Badge>
              {isOpen && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1 rounded-lg text-surface-textMuted hover:text-surface-text hover:bg-forest-850 lg:hidden"
                  aria-label="Close navigation menu"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

        {/* Authenticated Identity or Development Preview Switcher */}
        {isRealAuth ? (
          <div className="px-4 py-3 border-b border-surface-border/40 bg-surface-container/30">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-400">
                Supabase Verified
              </span>
              <Badge variant={role === 'admin' ? 'emerald' : role === 'staff' ? 'mint' : 'forest'} className="text-[9px] py-0 px-1">
                {role}
              </Badge>
            </div>
            <p className="text-[10px] text-surface-textMuted truncate">
              {user?.email}
            </p>
          </div>
        ) : isDev ? (
          <div className="px-4 py-3 border-b border-surface-border/40 bg-surface-container/30 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-surface-textMuted">
                Evaluator Role View:
              </span>
              {isEvaluatorMode ? (
                <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-amber-500 text-forest-950 uppercase tracking-wider">
                  DEMO PREVIEW
                </span>
              ) : (
                <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-forest-800 text-surface-textMuted border border-surface-border">
                  Dev Tool
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-1 bg-forest-900 p-1 rounded-lg border border-surface-border">
              {(['admin', 'staff', 'customer'] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => switchRole(r)}
                  className={`py-1 text-xs rounded font-medium capitalize transition-all ${
                    role === r
                      ? 'bg-emerald-600 text-forest-950 font-bold shadow-sm'
                      : 'text-surface-textMuted hover:text-surface-text hover:bg-forest-800'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <p className="text-[9px] text-amber-400/80 italic">
              Preview mode does not authenticate with Supabase.
            </p>
          </div>
        ) : null}

        {/* Navigation items */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {activeNavItems.map((item) => {
            const isActive = isItemActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => onClose?.()}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                  isActive
                    ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-500/30 shadow-glow-emerald font-semibold'
                    : 'text-surface-textMuted hover:bg-forest-900/60 hover:text-surface-text border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-emerald-400' : 'text-surface-textMuted group-hover:text-emerald-400'
                    }`}
                  />
                  <span>{item.name}</span>
                </div>
                {item.badge && (
                  <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-forest-850 text-surface-textMuted border border-surface-border">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer metadata & Sign Out */}
      <div className="p-4 border-t border-surface-border/60 bg-forest-950 text-xs text-surface-textMuted space-y-3">
        <button
          type="button"
          onClick={() => logout()}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-surface-textMuted hover:text-rose-400 hover:bg-forest-900 transition-colors border border-transparent hover:border-surface-border/60"
        >
          <LogOut className="w-4 h-4 text-surface-textMuted hover:text-rose-400" />
          <span>Sign Out</span>
        </button>

        <div className="flex items-center justify-between pt-1 border-t border-surface-border/40">
          <span className="text-[10px] uppercase tracking-wider">FastAPI • v0.1.0</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-emerald-400 text-[11px] font-medium">System Ready</span>
          </div>
        </div>
      </div>
    </aside>
    </>
  );
};

