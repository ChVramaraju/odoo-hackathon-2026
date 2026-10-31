import React, { useState } from 'react';
import {
  Receipt,
  Search,
  Filter,
  Eye,
  AlertTriangle,
  Database,
  Building,
  Calendar,
  RotateCcw,
} from 'lucide-react';
import { useInvoices } from './useInvoices';
import { Invoice, InvoiceStatus } from '../../types/invoice';
import { InvoiceDetailModal } from './InvoiceDetailModal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { mockInvoices } from '../../api/mocks';

type FilterStatus = 'all' | InvoiceStatus;

export const InvoicesPage: React.FC = () => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const {
    data: invoicesData,
    isLoading,
    isError,
    refetch,
  } = useInvoices({
    status: statusFilter === 'all' ? undefined : statusFilter,
    search: search || undefined,
  });

  // Fallback to mockInvoices if backend is offline or returns empty
  const rawInvoices =
    invoicesData?.items && invoicesData.items.length > 0
      ? invoicesData.items
      : mockInvoices;

  // Filter client-side when using mock fallback
  const filteredInvoices = rawInvoices.filter((inv) => {
    const matchesStatus =
      statusFilter === 'all' || inv.status === statusFilter;
    const matchesSearch =
      !search ||
      inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      inv.customer.name.toLowerCase().includes(search.toLowerCase()) ||
      (inv.customer.company && inv.customer.company.toLowerCase().includes(search.toLowerCase())) ||
      (inv.subscription_number && inv.subscription_number.toLowerCase().includes(search.toLowerCase()));
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: InvoiceStatus) => {
    switch (status) {
      case 'paid':
        return <Badge variant="emerald">Paid in Full</Badge>;
      case 'posted':
        return <Badge variant="mint">Posted</Badge>;
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

  // KPI computations
  const totalInvoiced = rawInvoices.reduce(
    (sum, inv) => sum + parseFloat(inv.total_amount || '0'),
    0
  );
  const totalOutstanding = rawInvoices.reduce(
    (sum, inv) => sum + parseFloat(inv.amount_due || '0'),
    0
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Contract Ready / Mock Mode Notification */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald-800/40 bg-emerald-950/40 text-emerald-300 text-xs">
        <Database className="w-4 h-4 flex-shrink-0 text-emerald-400" />
        <span>
          <strong className="text-emerald-200">Contract Ready / Mock Mode:</strong>{' '}
          Invoice operations follow proposed{' '}
          <code className="text-emerald-300 font-mono">API_CONTRACTS.md</code> endpoints (
          <code className="text-emerald-300 font-mono">/api/v1/invoices</code>, confirm/cancel) using
          resilient in-memory fixture data while FastAPI backend routes are finalized. All invoice balances
          and line snapshots represent simulated prototype data.
        </span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="font-heading text-2xl font-bold text-surface-text tracking-tight">
              Customer Invoices
            </h1>
            <Badge variant="mint" className="text-xs uppercase">
              Step 4 of Journey
            </Badge>
          </div>
          <p className="text-sm text-surface-textMuted">
            Track recurring billing snapshots, outstanding ledger balances, and immutable tax snapshots.
          </p>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-forest-900/60 border-surface-border">
          <div className="text-xs text-surface-textMuted uppercase tracking-wider font-medium">
            Total Invoiced
          </div>
          <div className="mt-2 text-2xl font-bold font-heading text-surface-text">
            ${totalInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-xs text-emerald-400 font-medium">{rawInvoices.length} invoices recorded</div>
        </Card>

        <Card className="bg-forest-900/60 border-surface-border">
          <div className="text-xs text-surface-textMuted uppercase tracking-wider font-medium">
            Outstanding Balance
          </div>
          <div className="mt-2 text-2xl font-bold font-heading text-amber-400">
            ${totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-xs text-amber-400">Receivables awaiting settlement</div>
        </Card>

        <Card className="bg-forest-900/60 border-surface-border">
          <div className="text-xs text-surface-textMuted uppercase tracking-wider font-medium">
            Paid Invoices
          </div>
          <div className="mt-2 text-2xl font-bold font-heading text-surface-text">
            {rawInvoices.filter((i) => i.status === 'paid').length}
          </div>
          <div className="mt-1 text-xs text-emerald-400">Settled in full</div>
        </Card>

        <Card className="bg-forest-900/60 border-surface-border">
          <div className="text-xs text-surface-textMuted uppercase tracking-wider font-medium">
            Overdue Invoices
          </div>
          <div className="mt-2 text-2xl font-bold font-heading text-red-400">
            {rawInvoices.filter((i) => i.status === 'overdue').length}
          </div>
          <div className="mt-1 text-xs text-red-400">Requires collection attention</div>
        </Card>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-xl bg-forest-900/40 border border-surface-border">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-textMuted" />
          <input
            type="text"
            placeholder="Search by invoice #, customer, sub #, or company..."
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
          {(['all', 'draft', 'posted', 'paid', 'overdue', 'cancelled'] as FilterStatus[]).map((status) => (
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
          <Receipt className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-3" />
          <p className="text-sm text-surface-text font-medium">Loading invoice ledger...</p>
          <p className="text-xs text-surface-textMuted mt-1">Retrieving billing periods and payment balances</p>
        </div>
      ) : isError ? (
        <div className="p-8 text-center border border-red-900/50 rounded-2xl bg-forest-900/40 space-y-3">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
          <p className="text-sm text-surface-text font-medium">Failed to connect to invoice ledger</p>
          <p className="text-xs text-surface-textMuted">
            Unable to load backend invoices. You can retry the connection or view prototype fixtures.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            <span>Retry Connection</span>
          </Button>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="p-12 text-center border border-surface-border rounded-2xl bg-forest-900/30 space-y-2">
          <Receipt className="w-8 h-8 text-surface-textMuted mx-auto opacity-40" />
          <p className="text-sm font-medium text-surface-text">No invoices found</p>
          <p className="text-xs text-surface-textMuted">
            {search || statusFilter !== 'all'
              ? 'Try adjusting your search query or status filter.'
              : 'Automated billing jobs create recurring invoices for due subscriptions.'}
          </p>
        </div>
      ) : (
        <div className="border border-surface-border rounded-2xl overflow-hidden bg-forest-900/40 shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-surface-border text-surface-textMuted bg-forest-950/60 uppercase tracking-wider font-semibold text-[11px]">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Subscription Ref</th>
                  <th className="py-3 px-4">Issue Date</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Total Amount</th>
                  <th className="py-3 px-4 text-right">Balance Due</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/40">
                {filteredInvoices.map((inv) => {
                  const balanceNum = parseFloat(inv.amount_due || '0');
                  return (
                    <tr
                      key={inv.id}
                      className="hover:bg-forest-800/40 transition-colors group cursor-pointer"
                      onClick={() => setSelectedInvoice(inv)}
                    >
                      <td className="py-3 px-4">
                        <div className="font-mono font-semibold text-surface-text group-hover:text-emerald-400 transition-colors">
                          {inv.invoice_number}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-medium text-surface-text">{inv.customer.name}</div>
                        {inv.customer.company && (
                          <div className="text-[11px] text-surface-textMuted flex items-center gap-1 mt-0.5">
                            <Building className="w-3 h-3" />
                            <span>{inv.customer.company}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {inv.subscription_number ? (
                          <span className="font-mono text-emerald-400/90 text-xs">
                            {inv.subscription_number}
                          </span>
                        ) : (
                          <span className="text-surface-textMuted text-[11px]">One-time</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-surface-textMuted">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(inv.issue_date).toLocaleDateString()}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div
                          className={`flex items-center gap-1 ${
                            inv.status === 'overdue' ? 'text-red-400 font-semibold' : 'text-surface-textMuted'
                          }`}
                        >
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(inv.due_date).toLocaleDateString()}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="font-mono font-bold text-surface-text text-sm">
                          ${inv.total_amount}
                        </div>
                        <span className="text-[10px] text-surface-textMuted">{inv.currency}</span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div
                          className={`font-mono font-semibold ${
                            balanceNum > 0 ? 'text-amber-400' : 'text-emerald-400'
                          }`}
                        >
                          ${inv.amount_due}
                        </div>
                        <span className="text-[10px] text-surface-textMuted">
                          {balanceNum > 0 ? 'Unpaid' : 'Settled'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center">{getStatusBadge(inv.status)}</td>

                      <td className="py-3 px-4 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={`View ${inv.invoice_number}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedInvoice(inv);
                          }}
                          className="text-xs py-1 h-7 px-2"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoice Detail Modal */}
      <InvoiceDetailModal
        invoice={selectedInvoice}
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
      />
    </div>
  );
};
