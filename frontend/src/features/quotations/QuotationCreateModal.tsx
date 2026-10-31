import React from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { X, Plus, Trash2, ShieldAlert, Sparkles, Layers, Package, AlertCircle, AlertTriangle } from 'lucide-react';
import { useCreateQuotation } from './useQuotations';
import { useProducts } from '../products/useProducts';
import { usePlans } from '../plans/usePlans';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { mockPlans, mockProducts } from '../../api/mocks';
import { ApiError } from '../../api/client';
import {
  SupportedCurrency,
  CURRENCY_SYMBOLS,
  convertMonetaryAmount,
} from '../../utils/currency';

const quotationSchema = z.object({
  customer_name: z.string().min(2, 'Customer name must be at least 2 characters'),
  customer_email: z.string().email('Please enter a valid email address'),
  customer_company: z.string().optional(),
  currency: z.enum(['USD', 'INR', 'EUR']),
  plan_id: z.string().min(1, 'Please select a base subscription plan'),
  validity_days: z.coerce.number().min(1, 'Validity must be at least 1 day').max(180, 'Maximum 180 days'),
  notes: z.string().optional(),
  lines: z
    .array(
      z.object({
        product_id: z.string().min(1, 'Product is required'),
        quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
      })
    )
    .min(1, 'Please add at least one product line item to the quotation'),
});

type QuotationFormData = z.infer<typeof quotationSchema>;

interface QuotationCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuotationCreateModal: React.FC<QuotationCreateModalProps> = ({ isOpen, onClose }) => {
  const createQuotationMutation = useCreateQuotation();
  const { data: productsData, isLoading: isProductsLoading, error: productsError } = useProducts();
  const { data: plansData, isLoading: isPlansLoading, error: plansError } = usePlans();

  const products = (productsData?.items && productsData.items.length > 0)
    ? productsData.items
    : (mockProducts || []);
  const plans = (plansData?.items && plansData.items.length > 0)
    ? plansData.items
    : (mockPlans || []);

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<QuotationFormData>({
    resolver: zodResolver(quotationSchema),
    defaultValues: {
      customer_name: '',
      customer_email: '',
      customer_company: '',
      currency: 'USD',
      plan_id: '',
      validity_days: 30,
      notes: '',
      lines: [{ product_id: '', quantity: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lines',
  });

  const watchedLines = watch('lines');
  const watchedPlanId = watch('plan_id');
  const watchedCurrency = (watch('currency') as SupportedCurrency) || 'USD';
  const currencySymbol = CURRENCY_SYMBOLS[watchedCurrency] || '$';

  // Compute estimated pricing client-side for UX guidance
  const selectedPlan = plans.find((p) => p.id === watchedPlanId);
  const basePlanPrice = selectedPlan ? parseFloat(selectedPlan.price || '0') : 0;
  const basePlanCurrency = selectedPlan?.currency || 'USD';

  const planConverted = convertMonetaryAmount(basePlanPrice, basePlanCurrency, watchedCurrency);

  // Check and convert each line item
  let linesConvertedTotal = 0;
  let allLinesAvailable = true;

  const convertedLines = (watchedLines || []).map((line) => {
    const prod = products.find((p) => p.id === line.product_id);
    const qty = Number(line.quantity) || 1;
    if (!prod) return { converted: null, total: 0, isAvailable: true };

    const unitPrice = parseFloat(prod.sales_price || '0');
    const prodCurrency = prod.currency || 'USD';
    const converted = convertMonetaryAmount(unitPrice * qty, prodCurrency, watchedCurrency);

    if (converted.isAvailable && converted.amount !== null) {
      linesConvertedTotal += converted.amount;
    } else {
      allLinesAvailable = false;
    }

    return { converted, total: unitPrice * qty, isAvailable: converted.isAvailable };
  });

  const isFxAvailable = (selectedPlan ? planConverted.isAvailable : true) && allLinesAvailable;

  const estimatedSubtotal = isFxAvailable ? (planConverted.amount || 0) + linesConvertedTotal : null;
  const estimatedTax = estimatedSubtotal !== null ? estimatedSubtotal * 0.10 : null;
  const estimatedTotal = (estimatedSubtotal !== null && estimatedTax !== null) ? estimatedSubtotal + estimatedTax : null;

  const onSubmit = (data: QuotationFormData) => {
    createQuotationMutation.mutate(
      {
        customer_id: null,
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        customer_company: data.customer_company,
        plan_id: data.plan_id,
        validity_days: data.validity_days,
        currency: data.currency,
        notes: data.notes,
        // Send clean lines without mutating authoritative backend price
        lines: data.lines.map((l) => ({
          product_id: l.product_id,
          quantity: l.quantity,
        })),
      },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      }
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="2xl"
      ariaLabel="Create Customer Quotation"
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-surface-border bg-forest-950/60">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-xl font-bold text-surface-text flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <span>Create Customer Quotation</span>
              </h2>
              <Badge variant="warning" className="text-[10px]">
                Simulated Client-Side Action
              </Badge>
            </div>
            <p className="text-xs text-surface-textMuted mt-1">
              Step 2 of Subscription Journey: Assemble customer terms, base recurring plan, and product add-ons.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-surface-textMuted hover:text-surface-text hover:bg-forest-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          {/* Customer Details & Quotation Terms Section */}
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                1. Unregistered Contact Details
              </h3>
              <p className="text-[11px] text-surface-textMuted mt-0.5">
                Manual lead/contact entry for quote simulation. No persistent backend customer record is created.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Customer Contact Name *"
                placeholder="e.g. Sarah Connor"
                error={errors.customer_name?.message}
                {...register('customer_name')}
              />
              <Input
                label="Customer Email Address *"
                type="email"
                placeholder="sarah@skynet-research.org"
                error={errors.customer_email?.message}
                {...register('customer_email')}
              />
              <Input
                label="Company / Organization"
                placeholder="e.g. Cyberdyne Systems"
                error={errors.customer_company?.message}
                {...register('customer_company')}
              />

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-surface-textMuted mb-1.5">
                    Validity (Days) *
                  </label>
                  <select
                    {...register('validity_days')}
                    className="w-full h-10 px-3 rounded-lg bg-forest-950 border border-surface-border text-surface-text text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value={15}>15 Days</option>
                    <option value={30}>30 Days (Standard)</option>
                    <option value={60}>60 Days</option>
                    <option value={90}>90 Days</option>
                  </select>
                  {errors.validity_days && (
                    <p className="text-xs text-red-400 mt-1">{errors.validity_days.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-surface-textMuted mb-1.5">
                    Currency *
                  </label>
                  <select
                    {...register('currency')}
                    aria-label="Quotation Currency"
                    className="w-full h-10 px-3 rounded-lg bg-forest-950 border border-surface-border text-surface-text text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 font-medium"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="INR">INR (₹)</option>
                  </select>
                  {errors.currency && (
                    <p className="text-xs text-red-400 mt-1">{errors.currency.message}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Subscription Plan Selection */}
          <div className="space-y-3 pt-2 border-t border-surface-border/60">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Layers className="w-4 h-4" />
              <span>2. Select Recurring Base Plan *</span>
            </h3>
            <div>
              <select
                {...register('plan_id')}
                disabled={isPlansLoading && plans.length === 0}
                className="w-full h-10 px-3.5 rounded-lg bg-forest-950 border border-surface-border text-surface-text text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
              >
                {isPlansLoading && plans.length === 0 ? (
                  <option value="" disabled>Loading subscription plans...</option>
                ) : plansError && plans.length === 0 ? (
                  <option value="" disabled>Failed to load subscription plans</option>
                ) : plans.length === 0 ? (
                  <option value="" disabled>No subscription plans available</option>
                ) : (
                  <>
                    <option value="">-- Choose a recurring plan --</option>
                    {plans.map((p) => {
                      const intervalLabel = p.billing_interval && p.billing_interval > 1
                        ? `every ${p.billing_interval} ${p.billing_frequency}s`
                        : p.billing_frequency;
                      const converted = convertMonetaryAmount(
                        parseFloat(p.price || '0'),
                        p.currency || 'USD',
                        watchedCurrency
                      );
                      const priceText = converted.isAvailable
                        ? converted.formatted
                        : `$${p.price} ${p.currency || 'USD'} (${watchedCurrency} FX unavailable)`;
                      return (
                        <option key={p.id} value={p.id}>
                          {p.name}{p.code ? ` (${p.code})` : ''} — {priceText} / {intervalLabel}
                        </option>
                      );
                    })}
                  </>
                )}
              </select>
              {errors.plan_id && (
                <p className="text-xs text-red-400 mt-1">{errors.plan_id.message}</p>
              )}
            </div>
          </div>

          {/* Product Line Items */}
          <div className="space-y-3 pt-2 border-t border-surface-border/60">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Package className="w-4 h-4" />
                <span>3. Product Line Items &amp; Add-ons *</span>
              </h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ product_id: '', quantity: 1 })}
                className="text-xs py-1 h-8"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Line</span>
              </Button>
            </div>

            {errors.lines?.root && (
              <p className="text-xs text-red-400">{errors.lines.root.message}</p>
            )}

            <div className="space-y-2.5">
              {fields.map((field, idx) => {
                const lineInfo = convertedLines[idx];
                const currentProdId = watchedLines?.[idx]?.product_id;
                const prod = products.find((p) => p.id === currentProdId);

                return (
                  <div
                    key={field.id}
                    className="p-3 rounded-xl bg-forest-950/70 border border-surface-border flex flex-col sm:flex-row items-center gap-3"
                  >
                    <div className="flex-1 w-full sm:w-auto">
                      <select
                        {...register(`lines.${idx}.product_id` as const)}
                        disabled={isProductsLoading && products.length === 0}
                        className="w-full h-9 px-3 rounded-lg bg-forest-900 border border-surface-border text-surface-text text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:opacity-50"
                      >
                        {isProductsLoading && products.length === 0 ? (
                          <option value="" disabled>Loading catalog products...</option>
                        ) : productsError && products.length === 0 ? (
                          <option value="" disabled>Failed to load products</option>
                        ) : products.length === 0 ? (
                          <option value="" disabled>No products available</option>
                        ) : (
                          <>
                            <option value="">-- Choose catalog product --</option>
                            {products.map((p) => {
                              const converted = convertMonetaryAmount(
                                parseFloat(p.sales_price || '0'),
                                p.currency || 'USD',
                                watchedCurrency
                              );
                              const priceDisplay = converted.isAvailable
                                ? converted.formatted
                                : `$${p.sales_price} ${p.currency || 'USD'}`;
                              return (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({priceDisplay}) [{p.type}]
                                </option>
                              );
                            })}
                          </>
                        )}
                      </select>
                    </div>

                    <div className="w-24">
                      <input
                        type="number"
                        min="1"
                        placeholder="Qty"
                        {...register(`lines.${idx}.quantity` as const, { valueAsNumber: true })}
                        className="w-full h-9 px-2 text-center rounded-lg bg-forest-900 border border-surface-border text-surface-text text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="text-xs font-mono text-emerald-400 font-semibold min-w-[100px] text-right">
                      {prod ? (
                        lineInfo?.isAvailable && lineInfo.converted ? (
                          lineInfo.converted.formatted
                        ) : (
                          <span className="text-amber-400/80 text-[11px]">FX Unavailable</span>
                        )
                      ) : (
                        `${currencySymbol}0.00 ${watchedCurrency}`
                      )}
                    </div>

                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remove(idx)}
                        className="p-1.5 rounded-lg text-surface-textMuted hover:text-red-400 hover:bg-forest-800 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Notes / Special Terms */}
          <div className="space-y-1.5 pt-2 border-t border-surface-border/60">
            <label className="block text-xs font-medium text-surface-textMuted">
              Contract Terms / Internal Notes
            </label>
            <textarea
              {...register('notes')}
              rows={2}
              placeholder="e.g. Standard 30-day payment terms, includes tier-1 SLA support..."
              className="w-full px-3.5 py-2 rounded-lg bg-forest-950 border border-surface-border text-surface-text text-xs placeholder:text-surface-subtle focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Authoritative Pricing Notice & Estimate Preview */}
          <div className="p-4 rounded-xl bg-forest-950/80 border border-emerald-900/40 space-y-2">
            <div className="flex items-start gap-2 text-xs text-amber-300">
              <ShieldAlert className="w-4 h-4 flex-shrink-0 text-amber-400 mt-0.5" />
              <p className="leading-relaxed">
                <strong>Illustrative Client Estimate:</strong> The 10% demo tax calculation and projected totals
                are non-authoritative client estimates. Official tax jurisdictions, plan line items, and definitive
                contract amounts are determined strictly by the FastAPI backend upon confirmation.
              </p>
            </div>

            {!isFxAvailable && (
              <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-800/50 text-amber-300 text-xs flex items-start gap-2 mt-2">
                <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Conversion Unavailable:</strong> No exchange rate source is configured for {watchedCurrency}.
                  To prevent misleading financial totals, numeric estimates are paused until an authoritative FX rate
                  is established.
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-surface-border/60 flex items-center justify-between text-xs">
              <span className="text-surface-textMuted">Estimated Subtotal:</span>
              <span className="font-mono text-surface-text font-semibold">
                {estimatedSubtotal !== null
                  ? `${currencySymbol}${estimatedSubtotal.toFixed(2)} ${watchedCurrency}`
                  : `Unavailable (No ${watchedCurrency} FX rate)`}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-surface-textMuted">Est. Tax (10% Illustrative Demo Rate):</span>
              <span className="font-mono text-surface-textMuted">
                {estimatedTax !== null
                  ? `${currencySymbol}${estimatedTax.toFixed(2)} ${watchedCurrency}`
                  : `Unavailable (No ${watchedCurrency} FX rate)`}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm font-bold text-surface-text pt-1 border-t border-surface-border/60">
              <span className="text-emerald-400">Total Projected Amount (Illustrative Estimate):</span>
              <span className="font-mono text-emerald-400">
                {estimatedTotal !== null
                  ? `${currencySymbol}${estimatedTotal.toFixed(2)} ${watchedCurrency}`
                  : `Unavailable (No ${watchedCurrency} FX rate)`}
              </span>
            </div>
          </div>

          {createQuotationMutation.isError && (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-900/60 text-xs text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>
                {(createQuotationMutation.error as ApiError)?.message ||
                  (createQuotationMutation.error as Error)?.message ||
                  'Failed to generate quotation. Check backend connection and plan selection.'}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-border">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={createQuotationMutation.isPending}
            >
              {createQuotationMutation.isPending ? 'Generating Quotation...' : 'Create Quotation (Simulated)'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};
