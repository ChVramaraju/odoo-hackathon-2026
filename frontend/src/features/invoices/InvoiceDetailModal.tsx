import React, { useState, useEffect } from 'react';
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
  CreditCard,
  AlertCircle,
  RotateCw,
  KeyRound,
} from 'lucide-react';
import { Invoice, InvoiceStatus } from '../../types/invoice';
import { PaymentMethod } from '../../types/payment';
import { useConfirmInvoice, useCancelInvoice } from './useInvoices';
import { useCreatePayment } from '../payments/usePayments';
import { apiClient } from '../../api/client';
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
  invoice: initialInvoice,
  isOpen,
  onClose,
}) => {
  const { role } = useAuth();
  const confirmMutation = useConfirmInvoice();
  const cancelMutation = useCancelInvoice();
  const createPaymentMutation = useCreatePayment();

  const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(initialInvoice);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [payAmount, setPayAmount] = useState<string>('');
  const [payMethod, setPayMethod] = useState<PaymentMethod>('card');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState<string | null>(null);

  // Idempotency key is retained across retries of the current payment attempt
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() =>
    initialInvoice
      ? `idem-${initialInvoice.id.slice(0, 8)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      : ''
  );

  useEffect(() => {
    setActiveInvoice(initialInvoice);
    if (initialInvoice) {
      setPayAmount(initialInvoice.amount_due || '0.00');
      setIdempotencyKey(
        `idem-${initialInvoice.id.slice(0, 8)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      );
    }
  }, [initialInvoice]);

  if (!isOpen || !initialInvoice) return null;
  const invoice = activeInvoice || initialInvoice;

  const isActionPending =
    confirmMutation.isPending || cancelMutation.isPending || createPaymentMutation.isPending;

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
    confirmMutation.mutate(invoice.id, {
      onSuccess: (updated) => {
        setActiveInvoice(updated);
      },
    });
  };

  const handleCancel = () => {
    cancelMutation.mutate(invoice.id, {
      onSuccess: (updated) => {
        setActiveInvoice(updated);
      },
    });
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError(null);
    setPaymentSuccessMsg(null);

    const amountNum = parseFloat(payAmount);
    const balanceNum = parseFloat(invoice.amount_due || '0');

    if (isNaN(amountNum) || amountNum <= 0) {
      setPaymentError('Payment amount must be greater than zero.');
      return;
    }

    if (amountNum > balanceNum + 0.001) {
      setPaymentError(
        `Payment amount ($${amountNum.toFixed(2)}) exceeds outstanding invoice balance ($${balanceNum.toFixed(2)}).`
      );
      return;
    }

    createPaymentMutation.mutate(
      {
        invoice_id: invoice.id,
        amount: amountNum.toFixed(2),
        currency: invoice.currency,
        payment_method: payMethod,
        transaction_reference: payRef.trim() || undefined,
        notes: payNotes.trim() || undefined,
        idempotency_key: idempotencyKey, // Preserved across retries!
      },
      {
        onSuccess: async (payment) => {
          // Sync invoice with server
          try {
            const updated = await apiClient.getInvoice(invoice.id);
            setActiveInvoice(updated);
          } catch {
            const newBal = Math.max(0, balanceNum - amountNum);
            setActiveInvoice({
              ...invoice,
              amount_due: newBal.toFixed(2),
              status: newBal === 0 ? 'paid' : invoice.status,
            });
          }
          setPaymentSuccessMsg(
            `Payment ${payment.payment_number} ($${payment.amount} ${payment.currency}) successfully recorded. Invoice balance updated.`
          );
          setShowPaymentForm(false);
          // Only generate a new idempotency key after full success
          setIdempotencyKey(
            `idem-${invoice.id.slice(0, 8)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
          );
        },
        onError: (err: any) => {
          // Idempotency key is explicitly preserved on failure for retry
          const msg =
            err?.message ||
            err?.error?.message ||
            'Payment request failed. Check network connection and retry with the same idempotency key.';
          setPaymentError(msg);
        },
      }
    );
  };

  const canManageInvoice = role === 'admin' || role === 'staff';
  const balanceDueNum = parseFloat(invoice.amount_due || '0');
  const canSettleInvoice = (invoice.status === 'posted' || invoice.status === 'overdue') && balanceDueNum > 0;

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
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 block">
                  Payment &amp; Ledger Balance
                </span>
                {canSettleInvoice && !showPaymentForm && (
                  <button
                    type="button"
                    onClick={() => {
                      setPayAmount(invoice.amount_due || '0.00');
                      setPaymentError(null);
                      setPaymentSuccessMsg(null);
                      setShowPaymentForm(true);
                    }}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-medium underline flex items-center gap-1"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    Record Settlement
                  </button>
                )}
              </div>
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

          {/* Payment Success Notification */}
          {paymentSuccessMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between gap-2 animate-fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>{paymentSuccessMsg}</span>
              </div>
              <button
                type="button"
                onClick={() => setPaymentSuccessMsg(null)}
                className="text-emerald-400 hover:text-emerald-200 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Payment Error Alert with Idempotent Retry */}
          {paymentError && (
            <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-fade-in">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">Settlement Error:</span>
                  <span>{paymentError}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRecordPayment}
                  disabled={createPaymentMutation.isPending}
                  className="text-xs h-7 text-red-200 border-red-700/60 hover:bg-red-900/40"
                >
                  <RotateCw className="w-3 h-3 mr-1" />
                  Retry Same Key
                </Button>
                <button
                  type="button"
                  onClick={() => setPaymentError(null)}
                  className="text-red-400 hover:text-red-200 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Payment Recording Form */}
          {showPaymentForm && (
            <form
              onSubmit={handleRecordPayment}
              className="p-5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-4 animate-fade-in"
            >
              <div className="flex items-center justify-between border-b border-emerald-800/40 pb-2.5">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                    Record Payment Settlement (API v1 /payments)
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPaymentForm(false)}
                  className="text-surface-textMuted hover:text-surface-text p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Settlement Disclaimer */}
              <div className="text-[11px] text-emerald-300/80 bg-emerald-950/50 p-2.5 rounded-lg border border-emerald-800/40">
                <strong className="text-emerald-200">Internal Settlement Recording:</strong> No card numbers or CVVs are collected or stored. This records internal payment settlement against this invoice.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                {/* Amount */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-surface-textMuted font-medium">Payment Amount</label>
                    <button
                      type="button"
                      onClick={() => setPayAmount(invoice.amount_due || '0.00')}
                      className="text-[11px] text-emerald-400 hover:underline"
                    >
                      Pay Full (${invoice.amount_due})
                    </button>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-textMuted">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={invoice.amount_due}
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      disabled={createPaymentMutation.isPending}
                      className="w-full pl-7 pr-3 py-1.5 bg-forest-950/80 border border-surface-border rounded-lg text-surface-text focus:outline-none focus:border-emerald-500 text-xs font-mono"
                      required
                    />
                  </div>
                </div>

                {/* Currency */}
                <div className="space-y-1">
                  <label className="text-surface-textMuted font-medium">Currency (Locked to Invoice)</label>
                  <input
                    type="text"
                    value={invoice.currency}
                    disabled
                    className="w-full px-3 py-1.5 bg-forest-950/40 border border-surface-border/50 rounded-lg text-surface-textMuted text-xs font-mono cursor-not-allowed"
                  />
                </div>

                {/* Method */}
                <div className="space-y-1">
                  <label className="text-surface-textMuted font-medium">Settlement Method</label>
                  <select
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                    disabled={createPaymentMutation.isPending}
                    className="w-full px-3 py-1.5 bg-forest-950/80 border border-surface-border rounded-lg text-surface-text focus:outline-none focus:border-emerald-500 text-xs"
                  >
                    <option value="card">Credit / Debit Card (Settlement Record)</option>
                    <option value="bank_transfer">Bank Wire / Transfer</option>
                    <option value="upi">UPI Payment</option>
                    <option value="net_banking">Net Banking</option>
                    <option value="manual">Manual / Check</option>
                    <option value="cash">Cash Settlement</option>
                  </select>
                </div>

                {/* Transaction Reference */}
                <div className="space-y-1">
                  <label className="text-surface-textMuted font-medium">Reference / UTR / Check #</label>
                  <input
                    type="text"
                    placeholder="e.g. UTR-98234-AX or Check #441"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    disabled={createPaymentMutation.isPending}
                    className="w-full px-3 py-1.5 bg-forest-950/80 border border-surface-border rounded-lg text-surface-text focus:outline-none focus:border-emerald-500 text-xs"
                  />
                </div>
              </div>

              {/* Accounting Notes */}
              <div className="space-y-1 text-xs">
                <label className="text-surface-textMuted font-medium">Accounting Memo / Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="Optional internal audit memo..."
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  disabled={createPaymentMutation.isPending}
                  className="w-full px-3 py-1.5 bg-forest-950/80 border border-surface-border rounded-lg text-surface-text focus:outline-none focus:border-emerald-500 text-xs"
                />
              </div>

              {/* Idempotency Key Badge */}
              <div className="flex items-center gap-1.5 text-[11px] text-surface-textMuted font-mono">
                <KeyRound className="w-3 h-3 text-emerald-400" />
                <span>Idempotency Key: {idempotencyKey}</span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-emerald-800/40">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPaymentForm(false)}
                  disabled={createPaymentMutation.isPending}
                  className="text-xs h-8"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={createPaymentMutation.isPending}
                  className="text-xs h-8"
                >
                  {createPaymentMutation.isPending ? (
                    <>
                      <div className="inline-block animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full mr-1.5" />
                      <span>Recording Settlement...</span>
                    </>
                  ) : (
                    <span>Confirm &amp; Record Payment</span>
                  )}
                </Button>
              </div>
            </form>
          )}

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

          <div className="flex items-center gap-2.5">
            {canSettleInvoice && !showPaymentForm && (
              <Button
                type="button"
                variant="primary"
                onClick={() => {
                  setPayAmount(invoice.amount_due || '0.00');
                  setPaymentError(null);
                  setPaymentSuccessMsg(null);
                  setShowPaymentForm(true);
                }}
                disabled={isActionPending}
                className="text-xs h-9 bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm"
              >
                <CreditCard className="w-4 h-4 mr-1.5" />
                <span>Record Payment</span>
              </Button>
            )}

            {canManageInvoice && (
              <>
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
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
