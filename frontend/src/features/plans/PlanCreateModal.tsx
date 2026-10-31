import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { X } from 'lucide-react';
import { useCreatePlan } from './usePlans';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { BillingFrequency, EndOfTermBehavior } from '../../types/plan';

const planSchema = z.object({
  name: z.string().min(2, 'Plan name must be at least 2 characters'),
  code: z.string().min(2, 'Code must be at least 2 characters'),
  description: z.string().optional(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid price (e.g. 199.00)'),
  currency: z.string().length(3),
  billing_frequency: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
  billing_interval: z.coerce.number().min(1).max(365),
  minimum_quantity: z.coerce.number().min(1),
  end_of_term_behavior: z.enum(['renew', 'close', 'cancel', 'pause']),
});

type PlanFormData = z.infer<typeof planSchema>;

interface PlanCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PlanCreateModal: React.FC<PlanCreateModalProps> = ({ isOpen, onClose }) => {
  const createPlanMutation = useCreatePlan();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PlanFormData>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
      price: '199.00',
      currency: 'USD',
      billing_frequency: 'monthly',
      billing_interval: 1,
      minimum_quantity: 1,
      end_of_term_behavior: 'renew',
    },
  });

  if (!isOpen) return null;

  const onSubmit = (data: PlanFormData) => {
    createPlanMutation.mutate(
      {
        name: data.name,
        code: data.code,
        description: data.description,
        price: data.price,
        currency: data.currency,
        billing_frequency: data.billing_frequency as BillingFrequency,
        billing_interval: data.billing_interval,
        minimum_quantity: data.minimum_quantity,
        end_of_term_behavior: data.end_of_term_behavior as EndOfTermBehavior,
        status: 'active',
        is_active: true,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-forest-900 border border-surface-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border/60 bg-forest-950/60">
          <div>
            <h3 className="font-heading text-lg font-bold text-surface-text">Define Subscription Plan</h3>
            <p className="text-xs text-surface-textMuted">Configure recurring intervals, pricing tier, and renewal behavior</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-surface-textMuted hover:text-surface-text hover:bg-forest-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <Input
            label="Plan Name"
            placeholder="e.g. Enterprise Annual FinOps"
            error={errors.name?.message}
            {...register('name')}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Plan Code"
              placeholder="e.g. BL-ENT-A"
              error={errors.code?.message}
              {...register('code')}
            />
            <div>
              <label className="block text-xs font-medium text-surface-textMuted uppercase tracking-wider mb-1.5">
                Currency
              </label>
              <select
                {...register('currency')}
                className="w-full h-10 px-3.5 rounded-lg bg-forest-850/70 border border-surface-border text-sm text-surface-text focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="INR">INR (₹)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Recurring Price"
              placeholder="199.00"
              error={errors.price?.message}
              {...register('price')}
            />
            <div>
              <label className="block text-xs font-medium text-surface-textMuted uppercase tracking-wider mb-1.5">
                Billing Frequency
              </label>
              <select
                {...register('billing_frequency')}
                className="w-full h-10 px-3.5 rounded-lg bg-forest-850/70 border border-surface-border text-sm text-surface-text focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="weekly">Weekly</option>
                <option value="daily">Daily</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              type="number"
              label="Interval Multiplier"
              placeholder="1"
              error={errors.billing_interval?.message}
              {...register('billing_interval')}
            />
            <div>
              <label className="block text-xs font-medium text-surface-textMuted uppercase tracking-wider mb-1.5">
                End-of-Term Behavior
              </label>
              <select
                {...register('end_of_term_behavior')}
                className="w-full h-10 px-3.5 rounded-lg bg-forest-850/70 border border-surface-border text-sm text-surface-text focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="renew">Auto-Renew (Default)</option>
                <option value="close">Close Term</option>
                <option value="pause">Pause for Review</option>
                <option value="cancel">Cancel</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-textMuted uppercase tracking-wider mb-1.5">
              Plan Terms & Benefits
            </label>
            <textarea
              {...register('description')}
              rows={3}
              placeholder="Includes 24/7 dedicated FinOps advisor, automated reconciliation, and up to 50k subscribers..."
              className="w-full p-3 rounded-lg bg-forest-850/70 border border-surface-border text-sm text-surface-text placeholder:text-surface-subtle focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
            />
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-border/60">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={createPlanMutation.isPending}>
              Create Plan
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

