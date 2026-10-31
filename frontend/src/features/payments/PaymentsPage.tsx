import React, { useState } from 'react';
import {
  CreditCard,
  Search,
  Filter,
  Eye,
  AlertTriangle,
  Database,
  Building,
  Calendar,
  RotateCcw,
  Receipt,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import { usePayments } from './usePayments';
import { Payment, PaymentMethod, PaymentStatus } from '../../types/payment';
import { PaymentDetailModal } from './PaymentDetailModal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { mockPayments } from '../../api/mocks';
import { apiClient } from '../../api/client';

type FilterStatus = 'all' | PaymentStatus;

export const PaymentsPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  const {
    data: paymentsData,
    isLoading,
    isError,
    refetch,
  } = usePayments({
    status: statusFilter === 'all' ? undefined : statusFilter,
    search: search || undefined,
  });

  // Use query data if available, or mock fixtures when apiClient is explicitly in mock mode
  const rawPayments = paymentsData?.items ?? (apiClient.isMockMode() ? mockPayments : []);

  // Filter client-side when using mock fallback
  const filteredPayments = rawPayments.filter((pay) => {
    const matchesStatus =
      statusFilter === 'all' || pay.status === statusFilter;
    const matchesSearch =
      !search ||
      pay.payment_number.toLowerCase().includes(search.toLowerCase()) ||
      pay.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      pay.customer.name.toLowerCase().includes(search.toLowerCase()) ||
      (pay.customer.company && pay.customer.company.toLowerCase().includes(search.toLowerCase())) ||
      (pay.reference_note && pay.reference_note.toLowerCase().includes(search.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Completed
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3 h-3" /> Failed
          </span>
        );
      case 'refunded':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <RotateCcw className="w-3 h-3" /> Refunded
          </span>
        );
      default:
        return <Badge variant="forest">{status}</Badge>;
    }
  };

  const getMethodBadge = (method: PaymentMethod) => {
    switch (method) {
      case 'card':
      case 'credit_card':
        return <span className="text-xs text-text-secondary font-medium">Credit Card</span>;
      case 'bank_transfer':
        return <span className="text-xs text-text-secondary font-medium">Bank Wire / ACH</span>;
      case 'upi':
        return <span className="text-xs text-text-secondary font-medium">UPI</span>;
      case 'net_banking':
        return <span className="text-xs text-text-secondary font-medium">Net Banking</span>;
      case 'ach':
        return <span className="text-xs text-text-secondary font-medium">ACH Debit</span>;
      case 'cash':
        return <span className="text-xs text-text-secondary font-medium">Cash</span>;
      case 'manual':
        return <span className="text-xs text-text-secondary font-medium">Manual / Check</span>;
      default:
        return <span className="text-xs text-text-secondary font-medium">{method}</span>;
    }
  };

  // KPI calculations
  const totalSettled = rawPayments
    .filter((p) => p.status === 'completed')
    .reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0);

  const pendingSettlement = rawPayments
    .filter((p) => p.status === 'pending')
    .reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0);

  const failedSettlement = rawPayments
    .filter((p) => p.status === 'failed')
    .reduce((sum, p) => sum + parseFloat(p.amount || '0'), 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Contract Ready / Mock Mode Notification */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald-800/40 bg-emerald-950/40 text-emerald-300 text-xs">
        <Database className="w-4 h-4 flex-shrink-0 text-emerald-400" />
        <span>
          <strong className="text-emerald-200">Contract Ready / Mock Mode:</strong>{' '}
          Payment operations follow proposed{' '}
          <code className="text-emerald-300 font-mono">API_CONTRACTS.md</code> endpoints (
          <code className="text-emerald-300 font-mono">/api/v1/payments</code>) using resilient
          in-memory fixture data while FastAPI backend routes are finalized. All settlement records and
          audit entries represent simulated prototype data.
        </span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="font-heading text-2xl font-bold text-surface-text tracking-tight">
              Payments & Settlements
            </h1>
            <Badge variant="mint" className="text-xs uppercase">
              Step 5 of Core Journey
            </Badge>
          </div>
          <p className="text-sm text-surface-textMuted">
            Record customer transactions, track settlement status, and link payments to invoice balances.
          </p>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-forest-900/60 border-surface-border">
          <div className="text-xs text-surface-textMuted uppercase tracking-wider font-medium">
            Total Settled
          </div>
          <div className="mt-2 text-2xl font-bold font-heading text-emerald-400">
            ${totalSettled.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-xs text-emerald-400 font-medium">Cleared to bank account</div>
        </Card>

        <Card className="bg-forest-900/60 border-surface-border">
          <div className="text-xs text-surface-textMuted uppercase tracking-wider font-medium">
            Pending Settlements
          </div>
          <div className="mt-2 text-2xl font-bold font-heading text-amber-400">
            ${pendingSettlement.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-xs text-amber-400/80 font-medium">Clearing via merchant / ACH</div>
        </Card>

        <Card className="bg-forest-900/60 border-surface-border">
          <div className="text-xs text-surface-textMuted uppercase tracking-wider font-medium">
            Failed Settlements
          </div>
          <div className="mt-2 text-2xl font-bold font-heading text-rose-400">
            ${failedSettlement.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-xs text-rose-400/80 font-medium">Requires payment retry</div>
        </Card>

        <Card className="bg-forest-900/60 border-surface-border">
          <div className="text-xs text-surface-textMuted uppercase tracking-wider font-medium">
            Total Transactions
          </div>
          <div className="mt-2 text-2xl font-bold font-heading text-surface-text">
            {rawPayments.length}
          </div>
          <div className="mt-1 text-xs text-surface-textMuted font-medium">Recorded payment events</div>
        </Card>
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface-card/60 p-4 rounded-xl border border-surface-border">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-surface-textMuted" />
          <input
            type="text"
            placeholder="Search by payment #, invoice #, customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-forest-950/60 border border-surface-border rounded-lg text-sm text-surface-text placeholder:text-surface-textMuted focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs text-surface-textMuted flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5" />
            Status:
          </span>
          {(['all', 'completed', 'pending', 'failed', 'refunded'] as FilterStatus[]).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                statusFilter === st
                  ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                  : 'bg-forest-950/40 text-surface-textMuted hover:text-surface-text hover:bg-forest-900/60 border border-surface-border'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area: Table / Loading / Error / Empty */}
      {isLoading ? (
        <div className="p-12 text-center text-surface-textMuted bg-surface-card/40 rounded-xl border border-surface-border">
          <div className="inline-block animate-spin w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full mb-3" />
          <p className="text-sm">Loading payments ledger...</p>
        </div>
      ) : isError ? (
        <div className="p-8 text-center bg-rose-950/20 border border-rose-900/40 rounded-xl space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
          <h3 className="text-base font-semibold text-rose-200">Unable to load payments</h3>
          <p className="text-xs text-rose-300/80 max-w-md mx-auto">
            Failed to retrieve payments from backend or in-memory fixtures.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Retry Connection
          </Button>
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="p-12 text-center bg-surface-card/30 rounded-xl border border-surface-border space-y-3">
          <CreditCard className="w-10 h-10 text-surface-textMuted mx-auto opacity-50" />
          <h3 className="text-base font-semibold text-surface-text">No payments found</h3>
          <p className="text-xs text-surface-textMuted max-w-sm mx-auto">
            {search || statusFilter !== 'all'
              ? 'No payment records match your active search and status filter criteria.'
              : 'No payment transactions have been recorded in the system yet.'}
          </p>
          {(search || statusFilter !== 'all') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
              }}
              className="mt-2 text-xs"
            >
              Clear Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-surface-border bg-surface-card/40">
          <table className="w-full text-left text-sm text-surface-text">
            <thead className="bg-forest-950/70 text-xs font-semibold uppercase tracking-wider text-surface-textMuted border-b border-surface-border">
              <tr>
                <th className="px-5 py-3.5">Payment Ref</th>
                <th className="px-5 py-3.5">Linked Invoice</th>
                <th className="px-5 py-3.5">Customer</th>
                <th className="px-5 py-3.5">Payment Date</th>
                <th className="px-5 py-3.5">Method</th>
                <th className="px-5 py-3.5 text-right">Settled Amount</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/50">
              {filteredPayments.map((pay) => (
                <tr
                  key={pay.id}
                  className="hover:bg-forest-900/40 transition-colors group"
                >
                  {/* Payment Ref */}
                  <td className="px-5 py-4 font-mono font-medium text-emerald-400">
                    {pay.payment_number}
                  </td>

                  {/* Linked Invoice */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1.5 font-mono text-xs text-text-primary">
                      <Receipt className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      {pay.invoice_number}
                    </div>
                  </td>

                  {/* Customer */}
                  <td className="px-5 py-4">
                    <div className="font-medium text-surface-text">{pay.customer.name}</div>
                    {pay.customer.company && (
                      <div className="text-xs text-surface-textMuted flex items-center gap-1 mt-0.5">
                        <Building className="w-3 h-3 text-surface-textMuted" />
                        {pay.customer.company}
                      </div>
                    )}
                  </td>

                  {/* Payment Date */}
                  <td className="px-5 py-4 text-xs text-surface-textMuted">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-surface-textMuted" />
                      {new Date(pay.payment_date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                  </td>

                  {/* Method */}
                  <td className="px-5 py-4">
                    {getMethodBadge(pay.payment_method)}
                  </td>

                  {/* Settled Amount */}
                  <td className="px-5 py-4 text-right font-medium text-emerald-400">
                    ${Number(pay.amount).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    <span className="text-xs font-normal text-surface-textMuted">
                      {pay.currency}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-5 py-4">
                    {getStatusBadge(pay.status)}
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-4 text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedPayment(pay)}
                      className="text-xs h-8 px-2.5 hover:border-emerald-500/50 hover:text-emerald-400"
                      aria-label={`View ${pay.payment_number}`}
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Payment Details Modal */}
      <PaymentDetailModal
        payment={selectedPayment}
        isOpen={!!selectedPayment}
        onClose={() => setSelectedPayment(null)}
      />
    </div>
  );
};
