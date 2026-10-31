import React, { Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Layers,
  Package,
  FileSpreadsheet,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { HexCanvas } from '../../components/common/HexCanvas';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { useAuth } from '../../context/AuthContext';

export const DashboardPage: React.FC = () => {
  const { user, role } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="space-y-8 animate-fade-in">
      {/* DEMO DATA BANNER — shown whenever backend is not supplying live metrics */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs font-medium">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-400" />
        <span>
          <strong className="text-amber-200">DEMO DATA</strong> — Dashboard metrics are
          illustrative placeholders. Connect and start the FastAPI backend (port&nbsp;8000)
          to display live data.
        </span>
      </div>

      {/* 3D HEXAGONAL HERO SECTION */}
      <div className="relative w-full min-h-[360px] lg:min-h-[380px] rounded-2xl border border-emerald-900/40 bg-forest-950 overflow-hidden shadow-2xl">
        {/* Background 3D Architectural Hexagon Terrain */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <Suspense
            fallback={
              <div className="w-full h-full bg-gradient-to-br from-forest-950 to-forest-900 opacity-80" />
            }
          >
            <HexCanvas className="w-full h-full" />
          </Suspense>
        </div>

        {/* Refined Dark Vignette & Gradient Overlays for Maximum Text Contrast */}
        <div className="absolute inset-0 z-[1] bg-gradient-to-r from-forest-950 via-forest-950/85 via-40% to-transparent pointer-events-none" />
        <div className="absolute inset-0 z-[1] bg-gradient-to-t from-forest-950/90 via-forest-950/30 to-transparent pointer-events-none" />
        <div className="absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_top_left,rgba(6,22,14,0.6)_0%,transparent_60%)] pointer-events-none" />

        {/* Hero Foreground Content */}
        <div className="relative z-10 h-full min-h-[360px] lg:min-h-[380px] p-6 sm:p-8 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Badge variant="mint" className="px-2.5 py-1">
                <Zap className="w-3 h-3 mr-1 fill-current" />
                Revenue in Motion
              </Badge>
              <Badge variant="forest" className="border-surface-border text-surface-textMuted">
                Demo Environment
              </Badge>
            </div>
            <span className="text-xs text-surface-textMuted font-mono">
              Signed in as{' '}
              <strong className="text-emerald-400">{user?.name ?? 'unknown'}</strong>
            </span>
          </div>

          <div className="max-w-xl my-4">
            <h1 className="font-heading text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-[1.15]">
              Brightloop FinOps &amp; Subscription Automation
            </h1>
            <p className="mt-3 text-sm text-surface-textMuted/90 leading-relaxed max-w-lg">
              Unified recurring billing engine, real-time revenue radar, and multi-variant
              catalog management powered by FastAPI and Supabase.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              variant="primary"
              onClick={() => navigate('/products')}
              className="shadow-lg shadow-emerald-950/50"
            >
              <Package className="w-4 h-4" />
              <span>Explore Products</span>
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate('/plans')}
              className="backdrop-blur-sm bg-forest-900/80"
            >
              <Layers className="w-4 h-4" />
              <span>Manage Plans</span>
            </Button>
            {role === 'admin' && (
              <Button
                variant="outline"
                onClick={() => navigate('/quotations')}
                className="backdrop-blur-sm bg-forest-950/60"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>New Quotation</span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* KPI METRICS OVERVIEW — visually consistent placeholders */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Annual Run Rate */}
        <Card className="bg-forest-900/50 border-surface-border/80 hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-surface-textMuted">
              Annual Run Rate
            </span>
            <Badge variant="forest" className="text-[10px] py-0">DEMO</Badge>
          </div>
          <div className="mt-2 text-3xl font-extrabold font-mono text-surface-text/40 tracking-tight">
            —
          </div>
          <div className="mt-1 text-xs text-surface-textMuted flex items-center gap-1">
            Awaiting backend connection
          </div>
        </Card>

        {/* Active Subscriptions */}
        <Card className="bg-forest-900/50 border-surface-border/80 hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-surface-textMuted">
              Active Subscriptions
            </span>
            <Badge variant="forest" className="text-[10px] py-0">DEMO</Badge>
          </div>
          <div className="mt-2 text-3xl font-extrabold font-mono text-surface-text/40 tracking-tight">
            —
          </div>
          <div className="mt-1 text-xs text-surface-textMuted">
            Awaiting backend connection
          </div>
        </Card>

        {/* Invoiced This Month */}
        <Card className="bg-forest-900/50 border-surface-border/80 hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-surface-textMuted">
              Invoiced This Month
            </span>
            <Badge variant="forest" className="text-[10px] py-0">DEMO</Badge>
          </div>
          <div className="mt-2 text-3xl font-extrabold font-mono text-surface-text/40 tracking-tight">
            —
          </div>
          <div className="mt-1 text-xs text-surface-textMuted">
            Awaiting backend connection
          </div>
        </Card>

        {/* Attention / Overdue */}
        <Card className="bg-forest-900/50 border-surface-border/80 hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-surface-textMuted">
              Attention / Overdue
            </span>
            <Badge variant="forest" className="text-[10px] py-0">DEMO</Badge>
          </div>
          <div className="mt-2 text-3xl font-extrabold font-mono text-surface-text/40 tracking-tight">
            —
          </div>
          <div className="mt-1 text-xs text-surface-textMuted">
            Awaiting backend connection
          </div>
        </Card>
      </div>

      {/* QUICK WORKFLOW SHORTCUTS & GOVERNANCE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-forest-900/40 border-surface-border/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-emerald-400" />
              <span>Core End-to-End Workflow Status</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                step: '1. Catalog & Plan Definition',
                desc: 'Define software base products, seat variants, and multi-cadence recurring plans.',
                status: 'Ready',
                variant: 'emerald' as const,
                route: '/products',
              },
              {
                step: '2. Customer Quotation Builder',
                desc: 'Assemble quotes with customer terms, product lines, and contract duration.',
                status: 'Awaiting Endpoints',
                variant: 'mint' as const,
                route: '/quotations',
              },
              {
                step: '3. Subscription Confirmation & Lifecycle',
                desc: 'Promote quotation into active subscription. Manage Pause, Resume, and Renew.',
                status: 'Awaiting Endpoints',
                variant: 'forest' as const,
                route: '/subscriptions',
              },
              {
                step: '4. Automated Billing & Payment Allocation',
                desc: 'Idempotent billing period generator. Create invoices and allocate payments.',
                status: 'Awaiting Endpoints',
                variant: 'forest' as const,
                route: '/invoices',
              },
            ].map((item, idx) => (
              <div
                key={idx}
                onClick={() => navigate(item.route)}
                className="p-3.5 rounded-xl bg-forest-950/60 border border-surface-border/60 flex items-center justify-between hover:border-emerald-500/40 transition-all cursor-pointer group"
              >
                <div>
                  <div className="font-semibold text-sm text-surface-text group-hover:text-emerald-300 transition-colors">
                    {item.step}
                  </div>
                  <div className="text-xs text-surface-textMuted mt-0.5">{item.desc}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={item.variant}>{item.status}</Badge>
                  <ArrowUpRight className="w-4 h-4 text-surface-textMuted group-hover:text-emerald-400 transition-colors" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Security & Integrity Safeguards */}
        <Card className="bg-forest-900/40 border-surface-border/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Security &amp; Governance</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-forest-950/70 border border-surface-border">
              <div className="font-semibold text-surface-text">Backend Authoritative</div>
              <p className="text-surface-textMuted mt-1">
                Pricing, taxes, discounts, and invoices are strictly calculated by FastAPI.
                Client input is untrusted.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-forest-950/70 border border-surface-border">
              <div className="font-semibold text-surface-text">No Client Service Keys</div>
              <p className="text-surface-textMuted mt-1">
                Supabase service-role keys remain exclusively on the server. Browser
                communicates via JWT.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-forest-950/70 border border-surface-border">
              <div className="font-semibold text-surface-text">Idempotent Billing</div>
              <p className="text-surface-textMuted mt-1">
                Unique database constraint on (subscription_id, billing_period) prevents
                duplicate recurring charges.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
