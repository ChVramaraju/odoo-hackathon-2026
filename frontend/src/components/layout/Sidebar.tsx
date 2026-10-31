import React from 'react';
import { NavLink } from 'react-router-dom';
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
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../ui/Badge';

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const navItems: NavItem[] = [
  { name: 'Overview', path: '/', icon: LayoutDashboard },
  { name: 'Products & Variants', path: '/products', icon: Package },
  { name: 'Subscription Plans', path: '/plans', icon: Layers },
  { name: 'Quotations', path: '/quotations', icon: FileSpreadsheet, badge: 'Contract' },
  { name: 'Subscriptions', path: '/subscriptions', icon: RefreshCw, badge: 'Core' },
  { name: 'Invoices & Billing', path: '/invoices', icon: Receipt },
  { name: 'Payments & Balance', path: '/payments', icon: CreditCard },
  { name: 'Customer Portal', path: '/portal', icon: UserCheck },
];

export const Sidebar: React.FC = () => {
  const { role, switchRole } = useAuth();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-forest-950 border-r border-surface-border z-40 flex flex-col justify-between">
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
          <Badge variant="emerald" className="text-[10px] px-1.5 py-0.5">
            FinOps
          </Badge>
        </div>

        {/* Role Switcher Pill */}
        <div className="px-4 py-3 border-b border-surface-border/40 bg-surface-container/30">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-surface-textMuted mb-1.5">
            Evaluator Role View:
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
        </div>

        {/* Navigation items */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                  isActive
                    ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-500/30 shadow-glow-emerald font-semibold'
                    : 'text-surface-textMuted hover:bg-forest-900/60 hover:text-surface-text border border-transparent'
                }`
              }
            >
              {({ isActive }) => (
                <>
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
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Footer metadata */}
      <div className="p-4 border-t border-surface-border/60 bg-forest-950 text-xs text-surface-textMuted space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider">FastAPI • v0.1.0</span>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-emerald-400 text-[11px] font-medium">System Ready</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

