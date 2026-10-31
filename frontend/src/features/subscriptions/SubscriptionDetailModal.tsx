import React from 'react';
import {
  X,
  RefreshCw,
  Calendar,
  Building,
  User,
  Layers,
  PauseCircle,
  PlayCircle,
  XCircle,
  RotateCw,
  Clock,
  CreditCard,
  Package,
  ShieldAlert,
} from 'lucide-react';
import { Subscription, SubscriptionStatus } from '../../types/subscription';
import {
  usePauseSubscription,
  useResumeSubscription,
  useRenewSubscription,
  useCloseSubscription,
} from './useSubscriptions';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../context/AuthContext';

interface SubscriptionDetailModalProps {
  subscription: Subscription | null;
  isOpen: boolean;
  onClose: () => void;
}

export const SubscriptionDetailModal: React.FC<SubscriptionDetailModalProps> = ({
  subscription,
  isOpen,
  onClose,
}) => {
  const { role } = useAuth();
  const pauseMutation = usePauseSubscription();
  const resumeMutation = useResumeSubscription();
  const renewMutation = useRenewSubscription();
  const closeMutation = useCloseSubscription();

  if (!isOpen || !subscription) return null;

  const isActionPending =
    pauseMutation.isPending ||
    resumeMutation.isPending ||
    renewMutation.isPending ||
    closeMutation.isPending;

  const getStatusBadge = (status: SubscriptionStatus) => {
    switch (status) {
      case 'active':
        return <Badge variant="emerald">Active Contract</Badge>;
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

  const handlePause = () => {
    pauseMutation.mutate(subscription.id);
  };

  const handleResume = () => {
    resumeMutation.mutate(subscription.id);
  };

  const handleRenew = () => {
    renewMutation.mutate(subscription.id);
  };

  const handleClose = () => {
    closeMutation.mutate(subscription.id);
  };

  const canManageLifecycle = role === 'admin' || role === 'staff';

  return (
    <Modal
      isOpen={isOpen && !!subscription}
      onClose={onClose}
      maxWidth="2xl"
      ariaLabel={`Subscription Contract Details ${subscription.subscription_number}`}
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-surface-border bg-forest-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-lg font-bold text-surface-text">
                  {subscription.subscription_number}
                </h2>
                {getStatusBadge(subscription.status)}
              </div>
              <p className="text-xs text-surface-textMuted mt-0.5">
                {subscription.customer.company || subscription.customer.name} • {subscription.plan_name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-surface-textMuted hover:text-surface-text hover:bg-forest-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Simulated Notice */}
          <div className="flex items-start gap-3 p-3.5 rounded-xl border border-emerald-900/40 bg-forest-950/70 text-xs text-surface-textMuted">
            <ShieldAlert className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="text-emerald-300 font-semibold">Simulated Subscription Contract:</span>{' '}
              Backend subscription endpoints are pending FastAPI finalization. Contract state, lifecycle transitions,
              and line totals represent simulated in-memory fixtures.
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer Details */}
            <div className="p-4 rounded-xl bg-forest-950/60 border border-surface-border/60 space-y-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 block">
                Customer Information
              </span>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2 text-surface-text">
                  <User className="w-3.5 h-3.5 text-surface-textMuted" />
                  <span className="font-medium">{subscription.customer.name}</span>
                </div>
                <div className="text-surface-textMuted pl-5">{subscription.customer.email}</div>
                {subscription.customer.company && (
                  <div className="flex items-center gap-2 text-surface-textMuted">
                    <Building className="w-3.5 h-3.5" />
                    <span>{subscription.customer.company}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Plan & Cycle Details */}
            <div className="p-4 rounded-xl bg-forest-950/60 border border-surface-border/60 space-y-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 block">
                Plan &amp; Terms
              </span>
              <div className="space-y-1.5 text-xs text-surface-text">
                <div className="flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-surface-textMuted" />
                  <span className="font-medium">{subscription.plan_name}</span>
                  {subscription.plan_code && (
                    <span className="text-[10px] font-mono text-surface-textMuted">
                      ({subscription.plan_code})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-surface-textMuted">
                  <Clock className="w-3.5 h-3.5" />
                  <span>
                    Billing: {subscription.billing_interval > 1 ? `Every ${subscription.billing_interval} ` : ''}
                    {subscription.billing_frequency}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-surface-textMuted">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Terms: {subscription.payment_terms || 'Due on Receipt'}</span>
                </div>
              </div>
            </div>

            {/* Dates & Timeline */}
            <div className="p-4 rounded-xl bg-forest-950/60 border border-surface-border/60 space-y-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 block">
                Contract Timeline
              </span>
              <div className="space-y-1.5 text-xs text-surface-text">
                <div className="flex items-center justify-between">
                  <span className="text-surface-textMuted flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> Start Date:
                  </span>
                  <span>{new Date(subscription.start_date).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-surface-textMuted flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> Next Billing Cycle:
                  </span>
                  <span className="text-emerald-400 font-medium">
                    {new Date(subscription.next_billing_date).toLocaleDateString()}
                  </span>
                </div>
                {subscription.end_date && (
                  <div className="flex items-center justify-between">
                    <span className="text-surface-textMuted flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> End / Termination Date:
                    </span>
                    <span className="text-red-400">
                      {new Date(subscription.end_date).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* End of Term Behavior & Notes */}
            <div className="p-4 rounded-xl bg-forest-950/60 border border-surface-border/60 space-y-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 block">
                Lifecycle Policy
              </span>
              <div className="space-y-1.5 text-xs text-surface-text">
                <div className="flex items-center justify-between">
                  <span className="text-surface-textMuted">End-of-term Behavior:</span>
                  <span className="capitalize font-medium">{subscription.end_of_term_behavior}</span>
                </div>
                {subscription.quotation_id && (
                  <div className="flex items-center justify-between">
                    <span className="text-surface-textMuted">Originating Quote:</span>
                    <span className="font-mono text-emerald-400">{subscription.quotation_id}</span>
                  </div>
                )}
                {subscription.notes && (
                  <p className="text-[11px] text-surface-textMuted italic pt-1 border-t border-surface-border/40">
                    "{subscription.notes}"
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Package className="w-4 h-4" />
              <span>Contract Line Items ({subscription.lines.length})</span>
            </h3>
            <div className="border border-surface-border rounded-xl overflow-hidden bg-forest-950/50">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-surface-border/60 text-surface-textMuted bg-forest-900/60">
                    <th className="py-2.5 px-3 font-medium">Product / Add-on</th>
                    <th className="py-2.5 px-3 font-medium text-center">Type</th>
                    <th className="py-2.5 px-3 font-medium text-center">Qty</th>
                    <th className="py-2.5 px-3 font-medium text-right">Unit Price</th>
                    <th className="py-2.5 px-3 font-medium text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border/40">
                  {subscription.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="py-2.5 px-3 font-medium text-surface-text">
                        {line.product_name}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-forest-800 text-surface-textMuted uppercase font-mono">
                          {line.product_type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center text-surface-textMuted">{line.quantity}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-surface-textMuted">
                        ${line.unit_price}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-400 font-semibold">
                        ${line.line_total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pricing Totals */}
          <div className="p-4 rounded-xl bg-forest-950/80 border border-emerald-900/40 space-y-1.5 text-xs">
            <div className="flex justify-between text-surface-textMuted">
              <span>Agreed Subtotal:</span>
              <span className="font-mono text-surface-text font-semibold">
                ${subscription.subtotal} {subscription.currency}
              </span>
            </div>
            <div className="flex justify-between text-surface-textMuted">
              <span>Jurisdiction Tax (Estimated):</span>
              <span className="font-mono">${subscription.tax_amount} {subscription.currency}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-surface-text pt-2 border-t border-surface-border/60">
              <span className="text-emerald-400">Total Recurring ({subscription.billing_frequency}):</span>
              <span className="font-mono text-emerald-400">
                ${subscription.total_amount} {subscription.currency}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-6 border-t border-surface-border bg-forest-950/70">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>

          {canManageLifecycle && (
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] text-surface-textMuted hidden sm:inline">
                Simulated Client-Side Action
              </span>

              {subscription.status === 'active' && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePause}
                    disabled={isActionPending}
                    className="text-xs h-9 text-amber-300 border-amber-800/60 hover:bg-amber-950/40"
                  >
                    <PauseCircle className="w-4 h-4 text-amber-400" />
                    <span>{pauseMutation.isPending ? 'Pausing...' : 'Pause Contract (Simulated)'}</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    disabled={isActionPending}
                    className="text-xs h-9 text-red-300 border-red-800/60 hover:bg-red-950/40"
                  >
                    <XCircle className="w-4 h-4 text-red-400" />
                    <span>{closeMutation.isPending ? 'Closing...' : 'Close Contract (Simulated)'}</span>
                  </Button>
                </>
              )}

              {subscription.status === 'paused' && (
                <>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleResume}
                    disabled={isActionPending}
                    className="text-xs h-9"
                  >
                    <PlayCircle className="w-4 h-4" />
                    <span>{resumeMutation.isPending ? 'Resuming...' : 'Resume Contract (Simulated)'}</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    disabled={isActionPending}
                    className="text-xs h-9 text-red-300 border-red-800/60 hover:bg-red-950/40"
                  >
                    <XCircle className="w-4 h-4 text-red-400" />
                    <span>{closeMutation.isPending ? 'Closing...' : 'Close Contract (Simulated)'}</span>
                  </Button>
                </>
              )}

              {subscription.status === 'closed' && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleRenew}
                  disabled={isActionPending}
                  className="text-xs h-9"
                >
                  <RotateCw className="w-4 h-4" />
                  <span>{renewMutation.isPending ? 'Renewing...' : 'Renew Contract (Simulated)'}</span>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

