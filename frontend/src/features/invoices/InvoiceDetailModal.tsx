import React from 'react';
import {
  X,
  Receipt,
  Calendar,
  Building,
  User,
  Clock,
  Package,
  ShieldAlert,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Invoice, InvoiceStatus } from '../../types/invoice';
import { useConfirmInvoice, useCancelInvoice } from './useInvoices';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../context/AuthContext';

interface InvoiceDetailModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  invoice,
  isOpen,
  onClose,
}) => {
  const { role } = useAuth();
  const confirmMutation = useConfirmInvoice();
  const cancelMutation = useCancelInvoice();

  if (!isOpen || !invoice) return null;

  const isActionPending = confirmMutation.isPending || cancelMutation.isPending;

  const getStatusBadge = (status: InvoiceStatus) => {
    switch (status) {
      case 'paid':
        return <Badge variant="emerald">Paid in Full</Badge>;
      case 'posted':
        return <Badge variant="mint">Posted / Awaiting Payment</Badge>;
      case 'overdue':
        return <Badge variant="danger">Overdue</Badge>;
      case 'draft':
        return <Badge variant="warning">Draft</Badge>;
      case 'cancelled':
        return <Badge variant="forest">Cancelled</Badge>;
      default:
        return <Badge variant="forest">{status}</Badge>;
    }
  };

  const handleConfirm = () => {
    confirmMutation.mutate(invoice.id);
  };

  const handleCancel = () => {
    cancelMutation.mutate(invoice.id);
  };

  const canManageInvoice = role === 'admin' || role === 'staff';
  const balanceDueNum = parseFloat(invoice.amount_due || '0');

  return (
    <Modal
      isOpen={isOpen && !!invoice}
      onClose={onClose}
      maxWidth="2xl"
      ariaLabel={`Invoice Details ${invoice.invoice_number}`}
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-surface-border bg-forest-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-lg font-bold text-surface-text">
                  {invoice.invoice_number}
                </h2>
                {getStatusBadge(invoice.status)}
              </div>
              <p className="text-xs text-surface-textMuted mt-0.5">
                {invoice.customer.company || invoice.customer.name} • Issue:{' '}
                {new Date(invoice.issue_date).toLocaleDateString()}
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
              <span className="text-emerald-300 font-semibold">Simulated Invoice Record:</span>{' '}
              Backend invoice generation endpoints are pending FastAPI implementation. All balances, tax
              snapshots, and transaction states represent prototype mock data.
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer Details */}
            <div className="p-4 rounded-xl bg-forest-950/60 border border-surface-border/60 space-y-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 block">
                Bill To
              </span>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center gap-2 text-surface-text">
                  <User className="w-3.5 h-3.5 text-surface-textMuted" />
                  <span className="font-medium">{invoice.customer.name}</span>
                </div>
                <div className="text-surface-textMuted pl-5">{invoice.customer.email}</div>
                {invoice.customer.company && (
                  <div className="flex items-center gap-2 text-surface-textMuted">
                    <Building className="w-3.5 h-3.5" />
                    <span>{invoice.customer.company}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Payment & Balance Status */}
            <div className="p-4 rounded-xl bg-forest-950/60 border border-surface-border/60 space-y-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 block">
                Payment &amp; Ledger Balance
              </span>
              <div className="space-y-1.5 text-xs text-surface-text">
                <div className="flex justify-between items-center">
                  <span className="text-surface-textMuted">Total Invoiced:</span>
                  <span className="font-mono font-semibold">${invoice.total_amount} {invoice.currency}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-surface-textMuted">Amount Paid:</span>
                  <span className="font-mono text-emerald-400">${invoice.amount_paid} {invoice.currency}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-surface-border/40 font-bold">
                  <span className={balanceDueNum > 0 ? 'text-amber-400' : 'text-surface-textMuted'}>
                    Outstanding Balance:
                  </span>
                  <span className={`font-mono ${balanceDueNum > 0 ? 'text-amber-400' : 'text-surface-text'}`}>
                    ${invoice.amount_due} {invoice.currency}
                  </span>
                </div>
              </div>
            </div>

            {/* Billing Timeline */}
            <div className="p-4 rounded-xl bg-forest-950/60 border border-surface-border/60 space-y-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 block">
                Dates &amp; Terms
              </span>
              <div className="space-y-1.5 text-xs text-surface-text">
                <div className="flex items-center justify-between">
                  <span className="text-surface-textMuted flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> Issue Date:
                  </span>
                  <span>{new Date(invoice.issue_date).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-surface-textMuted flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" /> Due Date:
                  </span>
                  <span className={invoice.status === 'overdue' ? 'text-red-400 font-semibold' : ''}>
                    {new Date(invoice.due_date).toLocaleDateString()}
                  </span>
                </div>
                {invoice.billing_period_start && invoice.billing_period_end && (
                  <div className="flex items-center justify-between text-[11px] text-surface-textMuted pt-1 border-t border-surface-border/40">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Period:
                    </span>
                    <span>
                      {new Date(invoice.billing_period_start).toLocaleDateString()} –{' '}
                      {new Date(invoice.billing_period_end).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Subscription Link & Notes */}
            <div className="p-4 rounded-xl bg-forest-950/60 border border-surface-border/60 space-y-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 block">
                Subscription Reference
              </span>
              <div className="space-y-1.5 text-xs text-surface-text">
                {invoice.subscription_number ? (
                  <div className="flex items-center justify-between">
                    <span className="text-surface-textMuted">Linked Contract:</span>
                    <span className="font-mono text-emerald-400 font-semibold">
                      {invoice.subscription_number}
                    </span>
                  </div>
                ) : (
                  <span className="text-surface-textMuted text-[11px]">One-time or standalone invoice</span>
                )}
                {invoice.notes && (
                  <p className="text-[11px] text-surface-textMuted italic pt-1 border-t border-surface-border/40">
                    "{invoice.notes}"
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Line Items Snapshot Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Package className="w-4 h-4" />
              <span>Invoice Line Snapshots ({invoice.lines.length})</span>
            </h3>
            <div className="border border-surface-border rounded-xl overflow-hidden bg-forest-950/50">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-surface-border/60 text-surface-textMuted bg-forest-900/60">
                    <th className="py-2.5 px-3 font-medium">Description Snapshot</th>
                    <th className="py-2.5 px-3 font-medium text-center">Qty</th>
                    <th className="py-2.5 px-3 font-medium text-right">Unit Price</th>
                    <th className="py-2.5 px-3 font-medium text-right">Tax</th>
                    <th className="py-2.5 px-3 font-medium text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border/40">
                  {invoice.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="py-2.5 px-3 font-medium text-surface-text">
                        {line.description}
                      </td>
                      <td className="py-2.5 px-3 text-center text-surface-textMuted">{line.quantity}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-surface-textMuted">
                        ${line.unit_price}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-surface-textMuted">
                        ${line.tax_amount}
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

          {/* Financial Breakdown */}
          <div className="p-4 rounded-xl bg-forest-950/80 border border-emerald-900/40 space-y-1.5 text-xs">
            <div className="flex justify-between text-surface-textMuted">
              <span>Subtotal:</span>
              <span className="font-mono text-surface-text font-semibold">
                ${invoice.subtotal} {invoice.currency}
              </span>
            </div>
            <div className="flex justify-between text-surface-textMuted">
              <span>Jurisdiction Tax (Snapshot):</span>
              <span className="font-mono">${invoice.tax_amount} {invoice.currency}</span>
            </div>
            {parseFloat(invoice.discount_amount || '0') > 0 && (
              <div className="flex justify-between text-emerald-400">
                <span>Discount Applied:</span>
                <span className="font-mono">-${invoice.discount_amount} {invoice.currency}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold text-surface-text pt-2 border-t border-surface-border/60">
              <span className="text-emerald-400">Total Invoiced Amount:</span>
              <span className="font-mono text-emerald-400">
                ${invoice.total_amount} {invoice.currency}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-surface-border bg-forest-950/70">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>

          {canManageInvoice && (
            <div className="flex items-center gap-2.5">
              <span className="text-[11px] text-surface-textMuted hidden sm:inline">
                Simulated Client-Side Action
              </span>

              {invoice.status === 'draft' && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleConfirm}
                  disabled={isActionPending}
                  className="text-xs h-9"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{confirmMutation.isPending ? 'Confirming...' : 'Confirm Invoice (Simulated)'}</span>
                </Button>
              )}

              {(invoice.status === 'posted' || invoice.status === 'overdue') && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isActionPending}
                  className="text-xs h-9 text-red-300 border-red-800/60 hover:bg-red-950/40"
                >
                  <XCircle className="w-4 h-4 text-red-400" />
                  <span>{cancelMutation.isPending ? 'Cancelling...' : 'Cancel Invoice (Simulated)'}</span>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
