import React from 'react';
import {
  X,
  CreditCard,
  Building,
  User,
  Calendar,
  Receipt,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  RotateCcw,
  FileText,
} from 'lucide-react';
import { Payment, PaymentMethod, PaymentStatus } from '../../types/payment';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';

interface PaymentDetailModalProps {
  payment: Payment | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToInvoice?: (invoiceNumber: string) => void;
}

export const PaymentDetailModal: React.FC<PaymentDetailModalProps> = ({
  payment,
  isOpen,
  onClose,
  onNavigateToInvoice,
}) => {
  if (!isOpen || !payment) return null;

  const getStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" /> Completed / Settled
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" /> Pending Settlement
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" /> Failed / Declined
          </span>
        );
      case 'refunded':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <RotateCcw className="w-3.5 h-3.5" /> Refunded
          </span>
        );
      default:
        return <Badge variant="forest">{status}</Badge>;
    }
  };

  const getMethodLabel = (method: PaymentMethod) => {
    switch (method) {
      case 'card':
      case 'credit_card':
        return 'Credit / Debit Card';
      case 'bank_transfer':
        return 'Bank Transfer / Wire';
      case 'upi':
        return 'UPI Payment';
      case 'net_banking':
        return 'Net Banking';
      case 'ach':
        return 'ACH Direct Debit';
      case 'cash':
        return 'Cash Settlement';
      case 'manual':
        return 'Manual / Ledger Entry';
      default:
        return method;
    }
  };

  const formattedAmount = Number(payment.amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const formattedDate = new Date(payment.payment_date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="lg">
      <div className="flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-surface-border flex items-center justify-between bg-surface-card/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-semibold text-text-primary">
                  {payment.payment_number}
                </h2>
                {getStatusBadge(payment.status)}
              </div>
              <p className="text-xs text-text-muted mt-0.5">
                Payment Record &bull; Ledger Snapshot
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-hover rounded-lg transition-colors"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Simulated Notice */}
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3 text-xs text-emerald-300/90 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-emerald-200">Contract Ready / Simulated Record</p>
              <p className="mt-0.5 text-emerald-300/80">
                Payment details reflect confirmed operational ledger records adhering to API_CONTRACTS.md.
                No third-party payment gateway or external card processor is connected.
              </p>
            </div>
          </div>

          {/* Amount Hero Card */}
          <div className="p-4 rounded-xl bg-surface-subtle border border-surface-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
                Settled Amount
              </span>
              <div className="text-3xl font-bold text-emerald-400 mt-1">
                ${formattedAmount}{' '}
                <span className="text-sm font-semibold text-text-muted">{payment.currency}</span>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
                Payment Method
              </span>
              <div className="text-sm font-semibold text-text-primary mt-1 flex items-center sm:justify-end gap-1.5">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                {getMethodLabel(payment.payment_method)}
              </div>
            </div>
          </div>

          {/* Customer & Linked Invoice Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Customer Information */}
            <div className="p-4 rounded-lg bg-surface-subtle/50 border border-surface-border space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                <User className="w-3.5 h-3.5" />
                Customer Account
              </div>
              <div className="text-sm font-medium text-text-primary">{payment.customer.name}</div>
              {payment.customer.company && (
                <div className="text-xs text-text-muted flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-text-secondary" />
                  {payment.customer.company}
                </div>
              )}
              <div className="text-xs text-text-secondary">{payment.customer.email}</div>
            </div>

            {/* Linked Invoice */}
            <div className="p-4 rounded-lg bg-surface-subtle/50 border border-surface-border space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                <Receipt className="w-3.5 h-3.5" />
                Linked Invoice
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-mono font-medium text-text-primary">
                  {payment.invoice_number}
                </span>
                {onNavigateToInvoice && (
                  <button
                    onClick={() => onNavigateToInvoice(payment.invoice_number)}
                    className="text-xs text-emerald-400 hover:text-emerald-300 underline font-medium"
                  >
                    View Invoice
                  </button>
                )}
              </div>
              <div className="text-xs text-text-muted flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-text-secondary" />
                Processed: {formattedDate}
              </div>
            </div>
          </div>

          {/* Reference & Notes */}
          <div className="p-4 rounded-lg bg-surface-subtle/30 border border-surface-border space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
              <FileText className="w-3.5 h-3.5 text-emerald-400" />
              Accounting Memo / Audit Reference
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">
              {payment.reference_note || 'No additional settlement reference notes recorded.'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-surface-border bg-surface-card/50 flex items-center justify-between">
          <div className="text-xs text-text-muted">
            Internal ID: <span className="font-mono text-text-secondary">{payment.id}</span>
          </div>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};

