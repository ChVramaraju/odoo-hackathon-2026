import React, { useState } from 'react';
import {
  Plus,
  Search,
  CheckCircle2,
  RefreshCw,
  Eye,
  Calendar,
  Building,
  Database,
} from 'lucide-react';
import { useQuotations, useConfirmQuotation } from './useQuotations';
import { QuotationCreateModal } from './QuotationCreateModal';
import { QuotationDetailModal } from './QuotationDetailModal';
import { Quotation, QuotationStatus } from '../../types/quotation';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { useAuth } from '../../context/AuthContext';

export const QuotationsPage: React.FC = () => {
  const { role } = useAuth();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quotation | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | QuotationStatus>('all');

  const { data, isLoading, error, refetch } = useQuotations();
  const confirmMutation = useConfirmQuotation();

  const quotations = data?.items || [];

  const filteredQuotes = quotations.filter((q) => {
    const matchesSearch =
      q.quotation_number.toLowerCase().includes(search.toLowerCase()) ||
      q.customer.name.toLowerCase().includes(search.toLowerCase()) ||
      (q.customer.company && q.customer.company.toLowerCase().includes(search.toLowerCase())) ||
      q.plan_name.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: QuotationStatus) => {
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

  const handleQuickConfirm = (e: React.MouseEvent, quoteId: string) => {
    e.stopPropagation();
    confirmMutation.mutate(quoteId);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Mock-Mode & Contract Transparency Banner */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald-800/40 bg-emerald-950/40 text-emerald-300 text-xs">
        <Database className="w-4 h-4 flex-shrink-0 text-emerald-400" />
        <span>
          <strong className="text-emerald-200">Contract Ready / Mock Mode:</strong> Quotation operations
          follow proposed <code className="text-emerald-300 font-mono">API_CONTRACTS.md</code> endpoints
          (<code className="text-emerald-300 font-mono">/api/v1/quotations</code>,{' '}
          <code className="text-emerald-300 font-mono">/confirm</code>) using resilient in-memory fixture data
          while backend routes are finalized. All confirmations and metrics represent simulated prototype data.
        </span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="font-heading text-2xl font-bold text-surface-text tracking-tight">
              Customer Quotations
            </h1>
            <Badge variant="mint">Step 2 of Journey</Badge>
          </div>
          <p className="text-sm text-surface-textMuted">
            Assemble multi-line quotes with catalog products, validity terms, and atomic subscription confirmation.
          </p>
        </div>

        {role === 'admin' && (
          <Button variant="primary" onClick={() => setIsCreateOpen(true)}>
            <Plus className="w-4 h-4" />
            <span>New Quotation</span>
          </Button>
        )}
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-forest-900/60 border-surface-border">
          <div className="text-xs text-surface-textMuted uppercase tracking-wider font-medium">
            Total Quotations
          </div>
          <div className="mt-2 text-2xl font-bold font-heading text-surface-text">
            {quotations.length}
          </div>
          <div className="mt-1 text-xs text-emerald-400 font-medium">Recorded in registry</div>
        </Card>

        <Card className="bg-forest-900/60 border-surface-border">
          <div className="text-xs text-surface-textMuted uppercase tracking-wider font-medium">
            Open Quotations
          </div>
          <div className="mt-2 text-2xl font-bold font-heading text-surface-text">
            {quotations.filter((q) => q.status === 'quotation').length}
          </div>
          <div className="mt-1 text-xs text-mint-400">Awaiting customer acceptance</div>
        </Card>

        <Card className="bg-forest-900/60 border-surface-border">
          <div className="text-xs text-surface-textMuted uppercase tracking-wider font-medium">
            Promoted / Confirmed
          </div>
          <div className="mt-2 text-2xl font-bold font-heading text-surface-text">
            {quotations.filter((q) => q.status === 'confirmed').length}
          </div>
          <div className="mt-1 text-xs text-emerald-400">Promoted to demo subscriptions</div>
        </Card>

        <Card className="bg-forest-900/60 border-surface-border">
          <div className="text-xs text-surface-textMuted uppercase tracking-wider font-medium">
            Drafts &amp; Expired
          </div>
          <div className="mt-2 text-2xl font-bold font-heading text-surface-text">
            {quotations.filter((q) => q.status === 'draft' || q.status === 'expired').length}
          </div>
          <div className="mt-1 text-xs text-amber-400">Requires follow-up</div>
        </Card>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="p-3 bg-forest-900/40 rounded-xl border border-surface-border flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-surface-textMuted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by quote #, client, or plan..."
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-forest-850/70 border border-surface-border text-xs text-surface-text placeholder:text-surface-subtle focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'quotation', 'confirmed', 'draft', 'expired'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all whitespace-nowrap ${
                statusFilter === status
                  ? 'bg-emerald-600 text-forest-950 font-bold shadow-sm'
                  : 'text-surface-textMuted hover:bg-forest-800'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Quotations Table */}
      <div className="bg-forest-900/50 rounded-xl border border-surface-border overflow-hidden shadow-card">
        {isLoading ? (
          <div className="p-12 text-center text-surface-textMuted">Loading quotations...</div>
        ) : error ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-red-400 text-sm">Unable to load quotations.</p>
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
        ) : filteredQuotes.length === 0 ? (
          <div className="p-12 text-center text-surface-textMuted">
            No quotations found matching your search and filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-forest-950/80 border-b border-surface-border/60 text-xs uppercase text-surface-textMuted tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-3.5">Quotation Ref</th>
                  <th className="px-6 py-3.5">Customer Contact</th>
                  <th className="px-6 py-3.5">Plan Cadence</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Validity / Expiry</th>
                  <th className="px-6 py-3.5 text-right">Projected Total (USD)</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/40">
                {filteredQuotes.map((quote) => (
                  <tr
                    key={quote.id}
                    onClick={() => setSelectedQuote(quote)}
                    className="hover:bg-forest-850/40 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4">
                      <div className="font-mono font-bold text-surface-text group-hover:text-emerald-300 transition-colors">
                        {quote.quotation_number}
                      </div>
                      <div className="text-[11px] text-surface-textMuted mt-0.5">
                        {quote.lines.length} {quote.lines.length === 1 ? 'line item' : 'line items'}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="font-semibold text-surface-text">{quote.customer.name}</div>
                      {quote.customer.company && (
                        <div className="text-xs text-surface-textMuted flex items-center gap-1 mt-0.5">
                          <Building className="w-3 h-3 text-emerald-500/70" />
                          <span>{quote.customer.company}</span>
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <div className="text-xs font-semibold text-surface-text">{quote.plan_name}</div>
                      <div className="text-[11px] text-emerald-400 capitalize">
                        {quote.billing_frequency} billing
                      </div>
                    </td>

                    <td className="px-6 py-4">{getStatusBadge(quote.status)}</td>

                    <td className="px-6 py-4 text-xs">
                      <div className="text-surface-text flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-surface-textMuted" />
                        <span>Valid {quote.validity_days}d</span>
                      </div>
                      <div className="text-surface-textMuted text-[11px] mt-0.5">
                        Expires {new Date(quote.expiry_date).toLocaleDateString()}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="font-mono font-bold text-surface-text text-sm">
                        ${quote.total_amount}
                      </div>
                      <div className="text-[10px] text-surface-textMuted uppercase">
                        {quote.currency}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {quote.status === 'quotation' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={(e) => handleQuickConfirm(e, quote.id)}
                            disabled={confirmMutation.isPending}
                            className="text-xs py-1 h-7 px-2.5"
                            title="Simulate atomic confirmation to subscription"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            <span>Confirm (Simulated)</span>
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          aria-label={`View ${quote.quotation_number}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedQuote(quote);
                          }}
                          className="text-xs py-1 h-7 px-2"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <QuotationCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />

      {/* Detail Modal */}
      <QuotationDetailModal
        quotation={selectedQuote}
        isOpen={!!selectedQuote}
        onClose={() => setSelectedQuote(null)}
      />
    </div>
  );
};
