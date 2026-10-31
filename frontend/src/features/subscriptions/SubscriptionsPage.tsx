import React, { useState } from 'react';
import {
  RefreshCw,
  Search,
  Filter,
  Eye,
  AlertTriangle,
  Database,
  Building,
  Calendar,
  Layers,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { useSubscriptions } from './useSubscriptions';
import { Subscription, SubscriptionStatus } from '../../types/subscription';
import { SubscriptionDetailModal } from './SubscriptionDetailModal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { mockSubscriptions } from '../../api/mocks';

type FilterStatus = 'all' | SubscriptionStatus;

export const SubscriptionsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);

  const {
    data: subscriptionsData,
    isLoading,
    isError,
    refetch,
  } = useSubscriptions({
    status: statusFilter === 'all' ? undefined : statusFilter,
    search: search || undefined,
  });

  // Fallback to mockSubscriptions if backend is offline or empty
  const rawSubscriptions =
    subscriptionsData?.items && subscriptionsData.items.length > 0
      ? subscriptionsData.items
      : mockSubscriptions;

  // Filter client-side when using mock fallback
  const filteredSubscriptions = rawSubscriptions.filter((sub) => {
    const matchesStatus =
      statusFilter === 'all' || sub.status === statusFilter;
    const matchesSearch =
      !search ||
      sub.subscription_number.toLowerCase().includes(search.toLowerCase()) ||
      sub.customer.name.toLowerCase().includes(search.toLowerCase()) ||
      (sub.customer.company && sub.customer.company.toLowerCase().includes(search.toLowerCase())) ||
      sub.plan_name.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: SubscriptionStatus) => {
    switch (status) {
      case 'active':
        return <Badge variant="emerald">Active</Badge>;
      case 'paused':
        return <Badge variant="warning">Paused</Badge>;
      case 'closed':
        return <Badge variant="forest">Closed</Badge>;
      case 'draft':
        return <Badge variant="outline">Draft</Badge>;
      case 'expired':
        return <Badge variant="danger">Expired</Badge>;
      default:
        return <Badge variant="forest">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Contract Ready / Mock Mode Notification */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald-800/40 bg-emerald-950/40 text-emerald-300 text-xs">
        <Database className="w-4 h-4 flex-shrink-0 text-emerald-400" />
        <span>
          <strong className="text-emerald-200">Contract Ready / Mock Mode:</strong>{' '}
          Subscription operations follow proposed{' '}
          <code className="text-emerald-300 font-mono">API_CONTRACTS.md</code> endpoints (
          <code className="text-emerald-300 font-mono">/api/v1/subscriptions</code>, lifecycle actions) using
          resilient in-memory fixture data while FastAPI backend routes are finalized. All metrics and contract
          records represent simulated prototype data.
        </span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="font-heading text-2xl font-bold text-surface-text tracking-tight">
              Customer Subscriptions
            </h1>
            <Badge variant="mint" className="text-xs uppercase">
              Step 3 of Journey
            </Badge>
          </div>
          <p className="text-sm text-surface-textMuted">
            Monitor active recurring commitments, automated billing schedules, and server-validated lifecycle states.
          </p>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-forest-900/60 border-surface-border">
          <div className="text-xs text-surface-textMuted uppercase tracking-wider font-medium">
            Total Subscriptions
          </div>
          <div className="mt-2 text-2xl font-bold font-heading text-surface-text">
            {rawSubscriptions.length}
          </div>
          <div className="mt-1 text-xs text-emerald-400 font-medium">Recorded in registry</div>
        </Card>

        <Card className="bg-forest-900/60 border-surface-border">
          <div className="text-xs text-surface-textMuted uppercase tracking-wider font-medium">
            Active Contracts
          </div>
          <div className="mt-2 text-2xl font-bold font-heading text-surface-text">
            {rawSubscriptions.filter((s) => s.status === 'active').length}
          </div>
          <div className="mt-1 text-xs text-emerald-400">Generating recurring revenue</div>
        </Card>

        <Card className="bg-forest-900/60 border-surface-border">
          <div className="text-xs text-surface-textMuted uppercase tracking-wider font-medium">
            Paused Contracts
          </div>
          <div className="mt-2 text-2xl font-bold font-heading text-surface-text">
            {rawSubscriptions.filter((s) => s.status === 'paused').length}
          </div>
          <div className="mt-1 text-xs text-amber-400">Pending operational review</div>
        </Card>

        <Card className="bg-forest-900/60 border-surface-border">
          <div className="text-xs text-surface-textMuted uppercase tracking-wider font-medium">
            Closed / Completed
          </div>
          <div className="mt-2 text-2xl font-bold font-heading text-surface-text">
            {rawSubscriptions.filter((s) => s.status === 'closed' || s.status === 'expired').length}
          </div>
          <div className="mt-1 text-xs text-surface-textMuted">Archived contracts</div>
        </Card>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-xl bg-forest-900/40 border border-surface-border">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-textMuted" />
          <input
            type="text"
            placeholder="Search by sub #, customer, plan, or company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-4 rounded-lg bg-forest-950 border border-surface-border text-xs text-surface-text placeholder:text-surface-subtle focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs text-surface-textMuted flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter:</span>
          </span>
          {(['all', 'active', 'paused', 'closed', 'draft'] as FilterStatus[]).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-all ${
                statusFilter === status
                  ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 font-semibold'
                  : 'text-surface-textMuted hover:text-surface-text hover:bg-forest-800 border border-transparent'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="p-12 text-center border border-surface-border rounded-2xl bg-forest-900/40">
          <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-3" />
          <p className="text-sm text-surface-text font-medium">Loading subscription registry...</p>
          <p className="text-xs text-surface-textMuted mt-1">Fetching recurring contracts and billing cycles</p>
        </div>
      ) : isError ? (
        <div className="p-8 text-center border border-red-900/50 rounded-2xl bg-forest-900/40 space-y-3">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-sm text-surface-text font-medium">Failed to connect to subscription registry</p>
          <p className="text-xs text-surface-textMuted">
            Unable to load live backend records. You can retry the request or continue using prototype mock fixtures.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            <span>Retry Connection</span>
          </Button>
        </div>
      ) : filteredSubscriptions.length === 0 ? (
        <div className="p-12 text-center border border-surface-border rounded-2xl bg-forest-900/30 space-y-2">
          <RefreshCw className="w-8 h-8 text-surface-textMuted mx-auto opacity-40" />
          <p className="text-sm font-medium text-surface-text">No subscriptions found</p>
          <p className="text-xs text-surface-textMuted">
            {search || statusFilter !== 'all'
              ? 'Try adjusting your search criteria or status filter.'
              : 'Confirmed customer quotations automatically generate active subscriptions.'}
          </p>
        </div>
      ) : (
        <div className="border border-surface-border rounded-2xl overflow-hidden bg-forest-900/40 shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-surface-border text-surface-textMuted bg-forest-950/60 uppercase tracking-wider font-semibold text-[11px]">
                  <th className="py-3 px-4">Subscription Ref</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Base Plan Tier</th>
                  <th className="py-3 px-4">Frequency</th>
                  <th className="py-3 px-4 text-right">Recurring Total</th>
                  <th className="py-3 px-4">Start Date</th>
                  <th className="py-3 px-4">Next Billing</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/40">
                {filteredSubscriptions.map((sub) => (
                  <tr
                    key={sub.id}
                    className="hover:bg-forest-800/40 transition-colors group cursor-pointer"
                    onClick={() => setSelectedSubscription(sub)}
                  >
                    <td className="py-3 px-4">
                      <div className="font-mono font-semibold text-surface-text group-hover:text-emerald-400 transition-colors">
                        {sub.subscription_number}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-surface-text">{sub.customer.name}</div>
                      {sub.customer.company && (
                        <div className="text-[11px] text-surface-textMuted flex items-center gap-1 mt-0.5">
                          <Building className="w-3 h-3" />
                          <span>{sub.customer.company}</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-surface-text font-medium">
                        <Layers className="w-3.5 h-3.5 text-surface-textMuted" />
                        <span>{sub.plan_name}</span>
                      </div>
                      {sub.plan_code && (
                        <span className="text-[10px] font-mono text-surface-textMuted">
                          {sub.plan_code}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <span className="text-surface-text capitalize flex items-center gap-1">
                        <Clock className="w-3 h-3 text-surface-textMuted" />
                        {sub.billing_frequency}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="font-mono font-bold text-emerald-400 text-sm">
                        ${sub.total_amount}
                      </div>
                      <span className="text-[10px] text-surface-textMuted">{sub.currency}</span>
                    </td>

                    <td className="py-3 px-4 text-surface-textMuted">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(sub.start_date).toLocaleDateString()}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1 text-emerald-300 font-medium">
                        <Calendar className="w-3 h-3 text-emerald-400" />
                        <span>{new Date(sub.next_billing_date).toLocaleDateString()}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-center">{getStatusBadge(sub.status)}</td>

                    <td className="py-3 px-4 text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        aria-label={`View ${sub.subscription_number}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSubscription(sub);
                        }}
                        className="text-xs py-1 h-7 px-2"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subscription Detail Modal */}
      <SubscriptionDetailModal
        subscription={selectedSubscription}
        isOpen={!!selectedSubscription}
        onClose={() => setSelectedSubscription(null)}
      />
    </div>
  );
};
