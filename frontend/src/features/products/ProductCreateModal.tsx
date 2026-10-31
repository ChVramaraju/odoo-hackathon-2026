import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { X, AlertTriangle } from 'lucide-react';
import { useCreateProduct } from './useProducts';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ApiError } from '../../api/client';

const productSchema = z.object({
  name: z.string().min(2, 'Product name must be at least 2 characters'),
  type: z.enum(['service', 'consumable', 'storable']),
  sales_price: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid price (e.g. 99.00)'),
  cost_price: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Enter a valid cost price (e.g. 25.00)'),
  currency: z.string().length(3, 'Currency must be 3-letter code'),
  description: z.string().optional(),
  notes: z.string().optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProductCreateModal: React.FC<ProductCreateModalProps> = ({ isOpen, onClose }) => {
  const createProductMutation = useCreateProduct();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      type: 'service',
      sales_price: '99.00',
      cost_price: '20.00',
      currency: 'USD',
      description: '',
      notes: '',
    },
  });

  if (!isOpen) return null;

  const onSubmit = (data: ProductFormData) => {
    createProductMutation.mutate(
      {
        name: data.name,
        type: data.type,
        sales_price: data.sales_price,
        cost_price: data.cost_price,
        currency: data.currency,
        description: data.description,
        notes: data.notes,
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
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="lg" ariaLabel="Add New Product">
      <div>
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border/60 bg-forest-950/60">
          <div>
            <h3 className="font-heading text-lg font-bold text-surface-text">Add New Product</h3>
            <p className="text-xs text-surface-textMuted">Configure catalog item and price baseline</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-surface-textMuted hover:text-surface-text hover:bg-forest-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <Input
            label="Product Title"
            placeholder="e.g. Real-time Ingestion Engine"
            error={errors.name?.message}
            {...register('name')}
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-surface-textMuted uppercase tracking-wider mb-1.5">
                Product Type
              </label>
              <select
                {...register('type')}
                className="w-full h-10 px-3.5 rounded-lg bg-forest-850/70 border border-surface-border text-sm text-surface-text focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="service">Service (SaaS Subscription)</option>
                <option value="consumable">Consumable (Metered)</option>
                <option value="storable">Storable (Hardware / License Token)</option>
              </select>
            </div>

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
              label="Sales Price"
              placeholder="0.00"
              error={errors.sales_price?.message}
              {...register('sales_price')}
            />
            <Input
              label="Internal Cost Price"
              placeholder="0.00"
              error={errors.cost_price?.message}
              {...register('cost_price')}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-textMuted uppercase tracking-wider mb-1.5">
              Customer Description
            </label>
            <textarea
              {...register('description')}
              rows={2}
              placeholder="Features and capability overview..."
              className="w-full p-3 rounded-lg bg-forest-850/70 border border-surface-border text-sm text-surface-text placeholder:text-surface-subtle focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-surface-textMuted uppercase tracking-wider mb-1.5">
              Internal Admin Notes
            </label>
            <textarea
              {...register('notes')}
              rows={2}
              placeholder="Private procurement notes or integration constraints..."
              className="w-full p-3 rounded-lg bg-forest-850/70 border border-surface-border text-sm text-surface-text placeholder:text-surface-subtle focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
            />
          </div>

          {createProductMutation.isError && (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-900/60 text-xs text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>
                {(createProductMutation.error as ApiError)?.message ||
                  (createProductMutation.error as Error)?.message ||
                  'Failed to create product on backend. Verify admin permissions and required fields.'}
              </span>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-border/60">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={createProductMutation.isPending}>
              Create Product
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
};

