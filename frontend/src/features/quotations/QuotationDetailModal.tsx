import React from 'react';
import {
  X,
  CheckCircle2,
  Calendar,
  Building,
  User,
  Layers,
  FileSpreadsheet,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { Quotation } from '../../types/quotation';
import { useConfirmQuotation } from './useQuotations';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { ApiError } from '../../api/client';

interface QuotationDetailModalProps {
  quotation: Quotation | null;
  isOpen: boolean;
  onClose: () => void;
}

export const QuotationDetailModal: React.FC<QuotationDetailModalProps> = ({
  quotation,
  isOpen,
  onClose,
}) => {
  const confirmMutation = useConfirmQuotation();

  if (!isOpen || !quotation) return null;

  const getStatusBadge = (status: Quotation['status']) => {
    switch (status) {
      case 'confirmed':
        return <Badge variant="emerald">Confirmed (Simulated Sub)</Badge>;
      case 'quotation':
        return <Badge variant="mint">Open Quotation</Badge>;
      case 'draft':
        return <Badge variant="forest">Draft</Badge>;
      case 'expired':
        return <Badge variant="warning">Expired</Badge>;
      case 'cancelled':
        return <Badge variant="danger">Cancelled</Badge>;
      default:
        return <Badge variant="forest">{status}</Badge>;
    }
  };

  const handleConfirm = () => {
    confirmMutation.mutate(quotation.id);
  };

  return (
    <Modal
      isOpen={isOpen && !!quotation}
      onClose={onClose}
      maxWidth="2xl"
      ariaLabel={`Quotation Details ${quotation.quotation_number}`}
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-surface-border bg-forest-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-lg font-bold text-surface-text">
                  {quotation.quotation_number}
                </h2>
                {getStatusBadge(quotation.status)}
              </div>
              <p className="text-xs text-surface-textMuted mt-0.5">
                Created on {new Date(quotation.created_at).toLocaleDateString()} • Valid until{' '}
                {new Date(quotation.expiry_date).toLocaleDateString()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-surface-textMuted hover:text-surface-text hover:bg-forest-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {/* Linked Subscription Banner (if confirmed) */}
          {quotation.status === 'confirmed' && quotation.subscription_id && (
            <div className="p-3.5 rounded-xl border border-emerald-500/40 bg-emerald-950/40 flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-xs text-emerald-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <div>
                  <div>
                    Simulated Promotion Reference: <strong>{quotation.subscription_id}</strong>
                  </div>
                  <div className="text-[11px] text-surface-textMuted mt-0.5">
                    In-memory prototype. Live recurring subscriptions require backend /api/v1/subscriptions persistence.
                  </div>
                </div>
              </div>
              <Badge variant="warning" className="text-[10px]">
                Simulated Promotion
              </Badge>
            </div>
          )}

          {/* Customer & Plan Overview Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-forest-950/60 border border-surface-border space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-surface-textMuted flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                Customer Contact (Unregistered Lead)
              </span>
              <div className="font-bold text-sm text-surface-text">{quotation.customer.name}</div>
              {quotation.customer.company && (
                <div className="text-xs text-surface-textMuted flex items-center gap-1">
                  <Building className="w-3.5 h-3.5" />
                  {quotation.customer.company}
                </div>
              )}
              <div className="text-xs text-emerald-400 font-mono">{quotation.customer.email}</div>
            </div>

            <div className="p-4 rounded-xl bg-forest-950/60 border border-surface-border space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-surface-textMuted flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                Recurring Base Plan
              </span>
              <div className="font-bold text-sm text-surface-text">{quotation.plan_name}</div>
              <div className="text-xs text-surface-textMuted">
                Cadence: <span className="font-semibold capitalize text-emerald-300">{quotation.billing_frequency}</span>
              </div>
              <div className="text-xs text-surface-textMuted flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Validity: {quotation.validity_days} Days
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-surface-textMuted">
              Quotation Line Items &amp; Add-ons
            </h3>
            <div className="rounded-xl border border-surface-border overflow-hidden bg-forest-950/50">
              <table className="w-full text-left text-xs">
                <thead className="bg-forest-950/90 border-b border-surface-border text-surface-textMuted uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Item & Variant</th>
                    <th className="px-4 py-2.5 font-semibold text-center">Type</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Qty</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Unit Price</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border/60">
                  {quotation.lines.map((line) => (
                    <tr key={line.id} className="hover:bg-forest-900/40">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-surface-text">{line.product_name}</div>
                        {line.variant_name && (
                          <div className="text-[11px] text-emerald-400 font-medium">
                            Variant: {line.variant_name}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant="forest" className="text-[10px] capitalize">
                          {line.product_type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-surface-text">
                        {line.quantity}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-surface-textMuted">
                        ${line.unit_price}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-surface-text">
                        ${line.subtotal}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pricing Summary */}
          <div className="p-4 rounded-xl bg-forest-950/80 border border-surface-border space-y-2 max-w-sm ml-auto">
            <div className="flex items-center justify-between text-xs text-surface-textMuted">
              <span>Lines Subtotal:</span>
              <span className="font-mono text-surface-text font-semibold">
                ${quotation.subtotal} {quotation.currency || 'USD'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-surface-textMuted">
              <span>Estimated Tax (10% Demo Rate):</span>
              <span className="font-mono text-surface-text">
                ${quotation.tax_amount} {quotation.currency || 'USD'}
              </span>
            </div>
            {parseFloat(quotation.discount_amount || '0') > 0 && (
              <div className="flex items-center justify-between text-xs text-emerald-400">
                <span>Applied Discount:</span>
                <span className="font-mono">
                  -${quotation.discount_amount} {quotation.currency || 'USD'}
                </span>
              </div>
            )}
            <div className="pt-2 border-t border-surface-border flex items-center justify-between text-sm font-bold text-surface-text">
              <span className="text-emerald-400">Total Projected Amount:</span>
              <span className="font-mono text-emerald-400">
                ${quotation.total_amount} {quotation.currency || 'USD'}
              </span>
            </div>
            <div className="text-[10px] text-surface-textMuted text-right">
              Illustrative estimate • Non-authoritative
            </div>
          </div>

          {/* Terms & Notes */}
          {quotation.notes && (
            <div className="p-3.5 rounded-lg bg-forest-950/50 border border-surface-border text-xs text-surface-textMuted">
              <span className="font-semibold text-surface-text block mb-0.5">Terms &amp; Notes:</span>
              {quotation.notes}
            </div>
          )}

          {/* Confirmation Error Banner */}
          {confirmMutation.isError && (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-900/60 text-xs text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>
                {(confirmMutation.error as ApiError)?.message ||
                  (confirmMutation.error as Error)?.message ||
                  'Failed to confirm quotation. Operation requires backend authorization.'}
              </span>
            </div>
          )}

          {/* Governance Notice */}
          <div className="flex items-center gap-2 text-[11px] text-surface-textMuted bg-forest-950/30 p-2.5 rounded-lg border border-surface-border/50">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span>
              Simulation Notice: Quotation validation, tax rules, and subscription state transitions are authorized strictly
              via FastAPI (/api/v1/quotations/{'{id}'}/confirm).
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-6 border-t border-surface-border bg-forest-950/70">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>

          {quotation.status === 'quotation' && (
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-surface-textMuted hidden sm:inline">
                Simulated Client-Side Action
              </span>
              <Button
                variant="primary"
                onClick={handleConfirm}
                disabled={confirmMutation.isPending}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {confirmMutation.isPending ? 'Simulating...' : 'Confirm to Subscription (Simulated)'}
                </span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
