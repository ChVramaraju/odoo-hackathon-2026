import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  LayoutDashboard,
  RefreshCw,
  Receipt,
  CreditCard,
  User,
  ShieldCheck,
  Calendar,
  Building,
  Mail,
  AlertTriangle,
  RotateCcw,
  Eye,
  CheckCircle2,
  Lock,
  Save,
  Clock,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  usePortalDashboard,
  usePortalProfile,
  useUpdatePortalProfile,
  usePortalSubscriptions,
  usePortalInvoices,
  usePortalPayments,
} from './useCustomerPortal';
import { Subscription, SubscriptionStatus } from '../../types/subscription';
import { Invoice, InvoiceStatus } from '../../types/invoice';
import { Payment, PaymentMethod, PaymentStatus } from '../../types/payment';
import { SubscriptionDetailModal } from '../subscriptions/SubscriptionDetailModal';
import { InvoiceDetailModal } from '../invoices/InvoiceDetailModal';
import { PaymentDetailModal } from '../payments/PaymentDetailModal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';

export type PortalTab = 'dashboard' | 'subscriptions' | 'invoices' | 'payments' | 'profile';

export const CustomerPortalPage: React.FC = () => {
  const { user, updateProfile: updateAuthProfile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as PortalTab) || 'dashboard';

  // Detail Modal States
  const [selectedSub, setSelectedSub] = useState<Subscription | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  // Queries
  const dashboardQuery = usePortalDashboard();
  const profileQuery = usePortalProfile();
  const subscriptionsQuery = usePortalSubscriptions();
  const invoicesQuery = usePortalInvoices();
  const paymentsQuery = usePortalPayments();
  const updateProfileMutation = useUpdatePortalProfile();

  // Profile Form State
  const [nameInput, setNameInput] = useState('');
  const [companyInput, setCompanyInput] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (profileQuery.data) {
      setNameInput(profileQuery.data.name || '');
      setCompanyInput(profileQuery.data.company || '');
    }
  }, [profileQuery.data]);

  const handleTabChange = (tab: PortalTab) => {
    setSearchParams({ tab });
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccessMsg(null);
    try {
      const updated = await updateProfileMutation.mutateAsync({
        name: nameInput.trim(),
        company: companyInput.trim(),
      });
      updateAuthProfile({
        name: updated.name,
        company: updated.company || undefined,
      });
      setSaveSuccessMsg('Profile updated successfully (Persisted to in-memory portal contract).');
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch {
      // Error handled by query state
    }
  };

  const getSubStatusBadge = (status: SubscriptionStatus) => {
    switch (status) {
      case 'active':
        return <Badge variant="emerald">Active</Badge>;
      case 'paused':
        return <Badge variant="warning">Paused</Badge>;
      case 'closed':
        return <Badge variant="forest">Closed</Badge>;
      case 'expired':
        return <Badge variant="danger">Expired</Badge>;
      default:
        return <Badge variant="forest">{status}</Badge>;
    }
  };

  const getInvoiceStatusBadge = (status: InvoiceStatus) => {
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

  const getPaymentStatusBadge = (status: PaymentStatus) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" /> Settled
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
      default:
        return <Badge variant="forest">{status}</Badge>;
    }
  };

  const getMethodLabel = (method: PaymentMethod) => {
    switch (method) {
      case 'bank_transfer':
        return 'Bank Wire';
      case 'credit_card':
        return 'Credit Card';
      case 'ach':
        return 'ACH Debit';
      case 'manual':
        return 'Check / Wire';
      default:
        return method;
    }
  };

  const profile = profileQuery.data;
  const dashboard = dashboardQuery.data;
  const customerSubscriptions = subscriptionsQuery.data?.items || dashboard?.active_subscriptions || [];
  const customerInvoices = invoicesQuery.data?.items || dashboard?.recent_invoices || [];
  const customerPayments = paymentsQuery.data?.items || dashboard?.recent_payments || [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Customer Security & Ownership Banner */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald-800/40 bg-emerald-950/40 text-emerald-300 text-xs">
        <ShieldCheck className="w-4 h-4 flex-shrink-0 text-emerald-400" />
        <span>
          <strong className="text-emerald-200">Customer Scoped Area:</strong>{' '}
          This portal displays self-service records restricted strictly to your authenticated account (
          <code className="text-emerald-300 font-mono">{profile?.email || user?.email || 'authenticated'}</code>).
          Cross-customer access is denied server-side at the API contract boundary.
        </span>
      </div>

      {/* Portal Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="font-heading text-2xl font-bold text-surface-text tracking-tight">
              Customer Self-Service Portal
            </h1>
            <Badge variant="mint" className="text-xs uppercase">
              Authenticated Client
            </Badge>
          </div>
          <p className="text-sm text-surface-textMuted">
            Manage your active agreements, inspect billing statements, review cleared transactions, and maintain your account profile.
          </p>
        </div>

        {profile && (
          <div className="px-3.5 py-2 rounded-xl bg-forest-900/60 border border-surface-border text-right text-xs">
            <span className="text-surface-textMuted block">Logged in as</span>
            <span className="font-semibold text-emerald-400 block">{profile.name}</span>
            {profile.company && <span className="text-text-secondary text-[11px] block">{profile.company}</span>}
          </div>
        )}
      </div>

      {/* Tab Navigation Navigation Bar */}
      <div className="flex items-center gap-2 border-b border-surface-border pb-px overflow-x-auto">
        <button
          onClick={() => handleTabChange('dashboard')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'dashboard'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-950/20'
              : 'border-transparent text-surface-textMuted hover:text-surface-text hover:bg-forest-900/40'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          Customer Dashboard
        </button>

        <button
          onClick={() => handleTabChange('subscriptions')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'subscriptions'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-950/20'
              : 'border-transparent text-surface-textMuted hover:text-surface-text hover:bg-forest-900/40'
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          My Subscriptions
          {customerSubscriptions.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-mono">
              {customerSubscriptions.length}
            </span>
          )}
        </button>

        <button
          onClick={() => handleTabChange('invoices')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'invoices'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-950/20'
              : 'border-transparent text-surface-textMuted hover:text-surface-text hover:bg-forest-900/40'
          }`}
        >
          <Receipt className="w-4 h-4" />
          My Invoices
          {customerInvoices.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-mono">
              {customerInvoices.length}
            </span>
          )}
        </button>

        <button
          onClick={() => handleTabChange('payments')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'payments'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-950/20'
              : 'border-transparent text-surface-textMuted hover:text-surface-text hover:bg-forest-900/40'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Payment History
        </button>

        <button
          onClick={() => handleTabChange('profile')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'profile'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-950/20'
              : 'border-transparent text-surface-textMuted hover:text-surface-text hover:bg-forest-900/40'
          }`}
        >
          <User className="w-4 h-4" />
          Account & Profile
        </button>
      </div>

      {/* =========================================================================
          TAB 1: CUSTOMER DASHBOARD
         ========================================================================= */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {dashboardQuery.isLoading ? (
            <div className="p-12 text-center text-surface-textMuted bg-surface-card/40 rounded-xl border border-surface-border">
              <div className="inline-block animate-spin w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full mb-3" />
              <p className="text-sm">Loading customer dashboard metrics...</p>
            </div>
          ) : dashboardQuery.isError ? (
            <div className="p-8 text-center bg-rose-950/20 border border-rose-900/40 rounded-xl space-y-3">
              <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
              <h3 className="text-base font-semibold text-rose-200">Unable to load portal summary</h3>
              <p className="text-xs text-rose-300/80 max-w-md mx-auto">
                Failed to retrieve customer dashboard from backend or in-memory fixtures.
              </p>
              <Button variant="outline" size="sm" onClick={() => dashboardQuery.refetch()} className="mt-2">
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Retry Connection
              </Button>
            </div>
          ) : (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-forest-900/60 border-surface-border">
                  <div className="text-xs text-surface-textMuted uppercase tracking-wider font-medium">
                    Active Subscriptions
                  </div>
                  <div className="mt-2 text-2xl font-bold font-heading text-surface-text">
                    {dashboard?.active_subscriptions_count ?? 0}
                  </div>
                  <div className="mt-1 text-xs text-emerald-400 font-medium">Currently active agreement</div>
                </Card>

                <Card className="bg-forest-900/60 border-surface-border">
                  <div className="text-xs text-surface-textMuted uppercase tracking-wider font-medium">
                    Outstanding Invoices
                  </div>
                  <div className="mt-2 text-2xl font-bold font-heading text-amber-400">
                    ${Number(dashboard?.total_outstanding_balance || 0).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  <div className="mt-1 text-xs text-amber-400/80 font-medium">Awaiting payment settlement</div>
                </Card>

                <Card className="bg-forest-900/60 border-surface-border">
                  <div className="text-xs text-surface-textMuted uppercase tracking-wider font-medium">
                    Total Settled YTD
                  </div>
                  <div className="mt-2 text-2xl font-bold font-heading text-emerald-400">
                    ${Number(dashboard?.total_settled_amount || 0).toLocaleString('en-US', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  <div className="mt-1 text-xs text-emerald-400 font-medium">Cleared customer receipts</div>
                </Card>

                <Card className="bg-forest-900/60 border-surface-border">
                  <div className="text-xs text-surface-textMuted uppercase tracking-wider font-medium">
                    Next Billing Date
                  </div>
                  <div className="mt-2 text-xl font-bold font-heading text-surface-text">
                    {dashboard?.next_billing_date
                      ? new Date(dashboard.next_billing_date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : 'None Scheduled'}
                  </div>
                  <div className="mt-1 text-xs text-surface-textMuted font-medium">Automated renewal snapshot</div>
                </Card>
              </div>

              {/* Active Subscriptions Summary */}
              <div className="bg-surface-card/40 rounded-xl border border-surface-border p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-emerald-400" />
                    <h3 className="font-heading text-base font-semibold text-surface-text">
                      Active Subscriptions
                    </h3>
                  </div>
                  <button
                    onClick={() => handleTabChange('subscriptions')}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-medium underline"
                  >
                    View All Subscriptions &rarr;
                  </button>
                </div>

                {dashboard && dashboard.active_subscriptions.length === 0 ? (
                  <p className="text-xs text-surface-textMuted py-4 text-center">
                    No active subscriptions associated with your account.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {dashboard?.active_subscriptions.map((sub) => (
                      <div
                        key={sub.id}
                        className="p-4 rounded-lg bg-surface-subtle/50 border border-surface-border flex items-start justify-between"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-emerald-400">
                              {sub.subscription_number}
                            </span>
                            {getSubStatusBadge(sub.status)}
                          </div>
                          <div className="text-sm font-semibold text-text-primary">{sub.plan_name}</div>
                          <div className="text-xs text-text-muted">
                            ${sub.total_amount} {sub.currency} &bull; {sub.billing_frequency}
                          </div>
                          {sub.next_billing_date && (
                            <div className="text-xs text-emerald-400/90 flex items-center gap-1 pt-1">
                              <Calendar className="w-3 h-3" />
                              Next billing:{' '}
                              {new Date(sub.next_billing_date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </div>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedSub(sub)}
                          className="text-xs h-8 px-2"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Details
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Invoices & Payments Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Recent Invoices Card */}
                <div className="bg-surface-card/40 rounded-xl border border-surface-border p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-emerald-400" />
                      <h3 className="font-heading text-base font-semibold text-surface-text">
                        Recent Invoices
                      </h3>
                    </div>
                    <button
                      onClick={() => handleTabChange('invoices')}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-medium underline"
                    >
                      View All Invoices &rarr;
                    </button>
                  </div>

                  {dashboard && dashboard.recent_invoices.length === 0 ? (
                    <p className="text-xs text-surface-textMuted py-4 text-center">
                      No invoices issued to this account yet.
                    </p>
                  ) : (
                    <div className="divide-y divide-surface-border/50">
                      {dashboard?.recent_invoices.slice(0, 3).map((inv) => (
                        <div key={inv.id} className="py-3 flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-text-primary">
                                {inv.invoice_number}
                              </span>
                              {getInvoiceStatusBadge(inv.status)}
                            </div>
                            <div className="text-xs text-text-muted mt-0.5">
                              Due: {new Date(inv.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              {' '}&bull; Total: ${inv.total_amount} {inv.currency}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedInvoice(inv)}
                            className="text-xs h-7 px-2"
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            View
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Payments Card */}
                <div className="bg-surface-card/40 rounded-xl border border-surface-border p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-emerald-400" />
                      <h3 className="font-heading text-base font-semibold text-surface-text">
                        Recent Transactions
                      </h3>
                    </div>
                    <button
                      onClick={() => handleTabChange('payments')}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-medium underline"
                    >
                      View Payment History &rarr;
                    </button>
                  </div>

                  {dashboard && dashboard.recent_payments.length === 0 ? (
                    <p className="text-xs text-surface-textMuted py-4 text-center">
                      No payments recorded on this account yet.
                    </p>
                  ) : (
                    <div className="divide-y divide-surface-border/50">
                      {dashboard?.recent_payments.slice(0, 3).map((pay) => (
                        <div key={pay.id} className="py-3 flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-semibold text-emerald-400">
                                {pay.payment_number}
                              </span>
                              {getPaymentStatusBadge(pay.status)}
                            </div>
                            <div className="text-xs text-text-muted mt-0.5">
                              {getMethodLabel(pay.payment_method)} &bull; ${pay.amount} {pay.currency}
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedPayment(pay)}
                            className="text-xs h-7 px-2"
                          >
                            <Eye className="w-3 h-3 mr-1" />
                            Receipt
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: MY SUBSCRIPTIONS
         ========================================================================= */}
      {activeTab === 'subscriptions' && (
        <div className="space-y-4">
          <div>
            <h2 className="font-heading text-lg font-bold text-surface-text">
              My Subscription Agreements
            </h2>
            <p className="text-xs text-surface-textMuted">
              Review agreed billing terms, active subscription tiers, and recurring payment schedules.
            </p>
          </div>

          {customerSubscriptions.length === 0 ? (
            <div className="p-12 text-center bg-surface-card/30 rounded-xl border border-surface-border space-y-2">
              <RefreshCw className="w-10 h-10 text-surface-textMuted mx-auto opacity-50" />
              <h3 className="text-base font-semibold text-surface-text">No Subscriptions Found</h3>
              <p className="text-xs text-surface-textMuted max-w-sm mx-auto">
                No active or historical subscriptions are registered for your customer account.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-surface-border bg-surface-card/40">
              <table className="w-full text-left text-sm text-surface-text">
                <thead className="bg-forest-950/70 text-xs font-semibold uppercase tracking-wider text-surface-textMuted border-b border-surface-border">
                  <tr>
                    <th className="px-5 py-3.5">Subscription Ref</th>
                    <th className="px-5 py-3.5">Plan Name</th>
                    <th className="px-5 py-3.5">Frequency</th>
                    <th className="px-5 py-3.5 text-right">Recurring Total</th>
                    <th className="px-5 py-3.5">Next Billing</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border/50">
                  {customerSubscriptions.map((sub) => (
                    <tr key={sub.id} className="hover:bg-forest-900/40 transition-colors">
                      <td className="px-5 py-4 font-mono font-medium text-emerald-400">
                        {sub.subscription_number}
                      </td>
                      <td className="px-5 py-4 font-semibold text-text-primary">{sub.plan_name}</td>
                      <td className="px-5 py-4 capitalize text-text-secondary">{sub.billing_frequency}</td>
                      <td className="px-5 py-4 text-right font-mono font-medium text-emerald-400">
                        ${sub.total_amount}{' '}
                        <span className="text-xs font-normal text-text-muted">{sub.currency}</span>
                      </td>
                      <td className="px-5 py-4 text-xs text-text-muted">
                        {sub.next_billing_date
                          ? new Date(sub.next_billing_date).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : '—'}
                      </td>
                      <td className="px-5 py-4">{getSubStatusBadge(sub.status)}</td>
                      <td className="px-5 py-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedSub(sub)}
                          className="text-xs h-8 px-2.5"
                          aria-label={`View ${sub.subscription_number}`}
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
        </div>
      )}

      {/* =========================================================================
          TAB 3: MY INVOICES
         ========================================================================= */}
      {activeTab === 'invoices' && (
        <div className="space-y-4">
          <div>
            <h2 className="font-heading text-lg font-bold text-surface-text">
              My Billing Statements &amp; Invoices
            </h2>
            <p className="text-xs text-surface-textMuted">
              Review issued invoices, check due dates, and monitor current outstanding balances.
            </p>
          </div>

          {customerInvoices.length === 0 ? (
            <div className="p-12 text-center bg-surface-card/30 rounded-xl border border-surface-border space-y-2">
              <Receipt className="w-10 h-10 text-surface-textMuted mx-auto opacity-50" />
              <h3 className="text-base font-semibold text-surface-text">No Invoices Found</h3>
              <p className="text-xs text-surface-textMuted max-w-sm mx-auto">
                No billing statements have been issued to your customer account.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-surface-border bg-surface-card/40">
              <table className="w-full text-left text-sm text-surface-text">
                <thead className="bg-forest-950/70 text-xs font-semibold uppercase tracking-wider text-surface-textMuted border-b border-surface-border">
                  <tr>
                    <th className="px-5 py-3.5">Invoice #</th>
                    <th className="px-5 py-3.5">Subscription</th>
                    <th className="px-5 py-3.5">Issue Date</th>
                    <th className="px-5 py-3.5">Due Date</th>
                    <th className="px-5 py-3.5 text-right">Total Amount</th>
                    <th className="px-5 py-3.5 text-right">Balance Due</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border/50">
                  {customerInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-forest-900/40 transition-colors">
                      <td className="px-5 py-4 font-mono font-medium text-emerald-400">
                        {inv.invoice_number}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-text-secondary">
                        {inv.subscription_number || 'Direct Billing'}
                      </td>
                      <td className="px-5 py-4 text-xs text-text-muted">
                        {new Date(inv.issue_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-5 py-4 text-xs text-text-muted">
                        {new Date(inv.due_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-5 py-4 text-right font-mono font-medium text-text-primary">
                        ${inv.total_amount} <span className="text-xs text-text-muted">{inv.currency}</span>
                      </td>
                      <td className="px-5 py-4 text-right font-mono font-semibold text-amber-400">
                        ${inv.amount_due} <span className="text-xs text-text-muted">{inv.currency}</span>
                      </td>
                      <td className="px-5 py-4">{getInvoiceStatusBadge(inv.status)}</td>
                      <td className="px-5 py-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedInvoice(inv)}
                          className="text-xs h-8 px-2.5"
                          aria-label={`View ${inv.invoice_number}`}
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
        </div>
      )}

      {/* =========================================================================
          TAB 4: PAYMENT HISTORY
         ========================================================================= */}
      {activeTab === 'payments' && (
        <div className="space-y-4">
          <div>
            <h2 className="font-heading text-lg font-bold text-surface-text">
              Payment &amp; Transaction History
            </h2>
            <p className="text-xs text-surface-textMuted">
              Review settled and pending payment receipts credited towards your invoices.
            </p>
          </div>

          {customerPayments.length === 0 ? (
            <div className="p-12 text-center bg-surface-card/30 rounded-xl border border-surface-border space-y-2">
              <CreditCard className="w-10 h-10 text-surface-textMuted mx-auto opacity-50" />
              <h3 className="text-base font-semibold text-surface-text">No Payments Found</h3>
              <p className="text-xs text-surface-textMuted max-w-sm mx-auto">
                No payment transactions have been recorded for your account yet.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-surface-border bg-surface-card/40">
              <table className="w-full text-left text-sm text-surface-text">
                <thead className="bg-forest-950/70 text-xs font-semibold uppercase tracking-wider text-surface-textMuted border-b border-surface-border">
                  <tr>
                    <th className="px-5 py-3.5">Payment Ref</th>
                    <th className="px-5 py-3.5">Linked Invoice</th>
                    <th className="px-5 py-3.5">Processed Date</th>
                    <th className="px-5 py-3.5">Method</th>
                    <th className="px-5 py-3.5 text-right">Amount</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border/50">
                  {customerPayments.map((pay) => (
                    <tr key={pay.id} className="hover:bg-forest-900/40 transition-colors">
                      <td className="px-5 py-4 font-mono font-medium text-emerald-400">
                        {pay.payment_number}
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-text-primary">
                        {pay.invoice_number}
                      </td>
                      <td className="px-5 py-4 text-xs text-text-muted">
                        {new Date(pay.payment_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-5 py-4 text-xs text-text-secondary">
                        {getMethodLabel(pay.payment_method)}
                      </td>
                      <td className="px-5 py-4 text-right font-mono font-medium text-emerald-400">
                        ${pay.amount}{' '}
                        <span className="text-xs font-normal text-text-muted">{pay.currency}</span>
                      </td>
                      <td className="px-5 py-4">{getPaymentStatusBadge(pay.status)}</td>
                      <td className="px-5 py-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedPayment(pay)}
                          className="text-xs h-8 px-2.5"
                          aria-label={`View ${pay.payment_number}`}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Receipt
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 5: ACCOUNT & PROFILE
         ========================================================================= */}
      {activeTab === 'profile' && (
        <div className="space-y-6 max-w-2xl">
          <div>
            <h2 className="font-heading text-lg font-bold text-surface-text">
              Customer Account Profile
            </h2>
            <p className="text-xs text-surface-textMuted">
              Manage verified account details and organization information.
            </p>
          </div>

          {/* Security Limitation Notice */}
          <div className="bg-forest-900/60 border border-surface-border rounded-xl p-4 text-xs space-y-2">
            <div className="flex items-center gap-2 font-semibold text-emerald-400">
              <Lock className="w-4 h-4 text-emerald-400" />
              Supported Backend Profile Fields
            </div>
            <p className="text-surface-textMuted leading-relaxed">
              In accordance with Supabase Auth security policies, your primary email (
              <strong className="text-text-primary">{profile?.email}</strong>) and Customer ID are locked to
              prevent identity tampering. You may update your Contact Name and Organization Name below.
            </p>
          </div>

          {saveSuccessMsg && (
            <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          <form onSubmit={handleProfileSubmit} className="space-y-4 bg-surface-card/40 p-6 rounded-xl border border-surface-border">
            {/* Customer ID (Read-only) */}
            <div>
              <label className="block text-xs font-medium text-surface-textMuted mb-1 flex items-center justify-between">
                <span>Customer ID (Permanent Identity)</span>
                <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> System Generated
                </span>
              </label>
              <input
                type="text"
                value={profile?.id || 'cust-001'}
                disabled
                className="w-full px-3.5 py-2 rounded-lg bg-forest-950/80 border border-surface-border/60 text-xs font-mono text-surface-textMuted cursor-not-allowed"
              />
            </div>

            {/* Email Address (Read-only) */}
            <div>
              <label className="block text-xs font-medium text-surface-textMuted mb-1 flex items-center justify-between">
                <span>Registered Email</span>
                <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Supabase Verified
                </span>
              </label>
              <input
                type="email"
                value={profile?.email || 'schen@acmecloud.com'}
                disabled
                className="w-full px-3.5 py-2 rounded-lg bg-forest-950/80 border border-surface-border/60 text-xs font-mono text-surface-textMuted cursor-not-allowed"
              />
            </div>

            {/* Role (Read-only) */}
            <div>
              <label className="block text-xs font-medium text-surface-textMuted mb-1">
                Account Privilege Tier
              </label>
              <div className="flex items-center gap-2">
                <Badge variant="mint" className="text-xs">
                  customer
                </Badge>
                <span className="text-[11px] text-surface-textMuted">
                  Restricted to client-owned subscriptions &amp; billing statements
                </span>
              </div>
            </div>

            {/* Contact / Display Name (Editable) */}
            <div>
              <label className="block text-xs font-medium text-surface-text mb-1">
                Contact / Display Name <span className="text-emerald-400">*</span>
              </label>
              <input
                type="text"
                required
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Your full name"
                className="w-full px-3.5 py-2 rounded-lg bg-forest-950 border border-surface-border text-xs text-surface-text placeholder:text-surface-textMuted focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Company / Organization Name (Editable) */}
            <div>
              <label className="block text-xs font-medium text-surface-text mb-1 flex items-center gap-1">
                <Building className="w-3.5 h-3.5 text-surface-textMuted" />
                Company / Organization Name
              </label>
              <input
                type="text"
                value={companyInput}
                onChange={(e) => setCompanyInput(e.target.value)}
                placeholder="e.g. Acme Cloud Corp"
                className="w-full px-3.5 py-2 rounded-lg bg-forest-950 border border-surface-border text-xs text-surface-text placeholder:text-surface-textMuted focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-surface-border/50">
              <span className="text-[11px] text-surface-textMuted">
                Changes persist across session fixtures.
              </span>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={updateProfileMutation.isPending}
                className="h-8 text-xs"
              >
                <Save className="w-3.5 h-3.5 mr-1" />
                {updateProfileMutation.isPending ? 'Saving...' : 'Save Profile Changes'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Shared Modals */}
      <SubscriptionDetailModal
        subscription={selectedSub}
        isOpen={!!selectedSub}
        onClose={() => setSelectedSub(null)}
      />

      <InvoiceDetailModal
        invoice={selectedInvoice}
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
      />

      <PaymentDetailModal
        payment={selectedPayment}
        isOpen={!!selectedPayment}
        onClose={() => setSelectedPayment(null)}
      />
    </div>
  );
};
