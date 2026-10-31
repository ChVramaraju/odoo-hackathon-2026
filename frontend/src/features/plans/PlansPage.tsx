import React, { useState } from 'react';
import { Plus, Check, Clock, RefreshCw, Database } from 'lucide-react';
import { usePlans } from './usePlans';
import { PlanCreateModal } from './PlanCreateModal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { useAuth } from '../../context/AuthContext';
import { BillingFrequency } from '../../types/plan';

export const PlansPage: React.FC = () => {
  const { role } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [frequencyFilter, setFrequencyFilter] = useState<'all' | BillingFrequency>('all');

  const { data, isLoading, error, refetch } = usePlans();
  const plans = data?.items || [];

  const filteredPlans = plans.filter((p) => {
    return frequencyFilter === 'all' || p.billing_frequency === frequencyFilter;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Mock-mode indicator — shown when backend is unreachable */}
      {!isLoading && !error && data && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-emerald-800/40 bg-emerald-950/40 text-emerald-400 text-xs">
          <Database className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            <strong>Mock Mode Active</strong> — data is served from in-memory fixtures.
            Start the FastAPI backend on port 8000 for live plan data.
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="font-heading text-2xl font-bold text-surface-text tracking-tight">
              Subscription Plans
            </h1>
            <Badge variant="mint">Pricing Engine</Badge>
          </div>
          <p className="text-sm text-surface-textMuted">
            Configure recurring intervals, tier pricing, minimum quantities, and end-of-term renewal rules.
          </p>
        </div>

        {role === 'admin' && (
          <Button variant="primary" onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4" />
            <span>New Plan</span>
          </Button>
        )}
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-forest-900/60 border-surface-border">
          <div className="text-xs text-surface-textMuted uppercase tracking-wider font-medium">Configured Tiers</div>
          <div className="mt-2 text-2xl font-bold font-heading text-surface-text">{plans.length} Plans</div>
          <div className="mt-1 text-xs text-emerald-400 font-medium">Published in catalog</div>
        </Card>
        <Card className="bg-forest-900/60 border-surface-border">
          <div className="text-xs text-surface-textMuted uppercase tracking-wider font-medium">Supported Cadences</div>
          <div className="mt-2 text-2xl font-bold font-heading text-surface-text">Monthly / Yearly / Weekly</div>
          <div className="mt-1 text-xs text-surface-textMuted">Multi-cadence billing</div>
        </Card>
        <Card className="bg-forest-900/60 border-surface-border">
          <div className="text-xs text-surface-textMuted uppercase tracking-wider font-medium">Renewal Safety</div>
          <div className="mt-2 text-2xl font-bold font-heading text-surface-text">Auto-Renew Protected</div>
          <div className="mt-1 text-xs text-mint-400">Idempotent billing period constraint</div>
        </Card>
      </div>

      {/* Frequency Filter Tabs */}
      <div className="flex items-center justify-between p-2 bg-forest-900/40 rounded-xl border border-surface-border">
        <div className="flex items-center gap-1.5">
          {(['all', 'monthly', 'yearly', 'weekly'] as const).map((freq) => (
            <button
              key={freq}
              onClick={() => setFrequencyFilter(freq)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                frequencyFilter === freq
                  ? 'bg-emerald-600 text-forest-950 shadow-glow-emerald'
                  : 'text-surface-textMuted hover:text-surface-text hover:bg-forest-850'
              }`}
            >
              {freq}
            </button>
          ))}
        </div>
        <div className="text-xs text-surface-textMuted pr-3">
          Showing <span className="font-semibold text-emerald-400">{filteredPlans.length}</span> of {plans.length} plans
        </div>
      </div>

      {/* Plans Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-surface-textMuted">Loading subscription plans...</div>
      ) : error ? (
        <div className="p-12 text-center space-y-3">
          <p className="text-red-400 text-sm">Unable to load subscription plans.</p>
          <p className="text-surface-textMuted text-xs">
            Backend appears offline. Ensure FastAPI is running on port 8000 and try again.
          </p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-forest-800 text-emerald-300 hover:bg-forest-700 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="p-12 text-center text-surface-textMuted">No subscription plans found for this frequency.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlans.map((plan) => (
            <Card
              key={plan.id}
              className="bg-forest-900/70 border-surface-border hover:border-emerald-500/50 flex flex-col justify-between transition-all duration-300 group hover:shadow-glow-emerald"
            >
              <div>
                <CardHeader>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-forest-950 text-emerald-400 border border-emerald-500/30">
                      {plan.code || 'BL-PLAN'}
                    </span>
                    <Badge variant={plan.is_active ? 'emerald' : 'forest'} className="capitalize">
                      {plan.billing_frequency}
                    </Badge>
                  </div>
                  <CardTitle className="group-hover:text-emerald-300 transition-colors">{plan.name}</CardTitle>
                  {plan.description && <CardDescription className="line-clamp-2 mt-1">{plan.description}</CardDescription>}
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Price display */}
                  <div className="p-4 rounded-xl bg-forest-950/70 border border-surface-border/60">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-heading font-extrabold text-surface-text">${plan.price}</span>
                      <span className="text-xs text-surface-textMuted font-medium">/{plan.billing_frequency}</span>
                    </div>
                    <div className="text-[11px] text-surface-textMuted mt-1">
                      Billed every {plan.billing_interval > 1 ? `${plan.billing_interval} ` : ''}
                      {plan.billing_frequency} • Min. seats: {plan.minimum_quantity}
                    </div>
                  </div>

                  {/* Feature checklist */}
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-2 text-surface-text">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Full automated recurring billing engine</span>
                    </div>
                    <div className="flex items-center gap-2 text-surface-text">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Multi-variant add-on entitlement support</span>
                    </div>
                    <div className="flex items-center gap-2 text-surface-text">
                      <Clock className="w-4 h-4 text-mint-400 shrink-0" />
                      <span>Term rule: Auto-{plan.end_of_term_behavior}</span>
                    </div>
                  </div>
                </CardContent>
              </div>

              <div className="pt-4 p-5 border-t border-surface-border/40 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-surface-textMuted">
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                  <span>State: {plan.status}</span>
                </div>
                <Button variant="secondary" size="sm">
                  Configure Tier
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <PlanCreateModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};
