import React, { useState } from 'react';
import { Package, Plus, ChevronDown, ChevronRight, Tag, Database, RefreshCw } from 'lucide-react';
import { useProducts, useProductVariants } from './useProducts';
import { ProductCreateModal } from './ProductCreateModal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Product } from '../../types/product';
import { useAuth } from '../../context/AuthContext';

const ProductVariantRow: React.FC<{ productId: string }> = ({ productId }) => {
  const { data: variants, isLoading } = useProductVariants(productId);

  if (isLoading) {
    return (
      <tr className="bg-forest-950/40">
        <td colSpan={6} className="px-6 py-3 text-xs text-surface-textMuted">
          Loading variants...
        </td>
      </tr>
    );
  }

  if (!variants || variants.length === 0) {
    return (
      <tr className="bg-forest-950/40">
        <td colSpan={6} className="px-6 py-3 text-xs text-surface-textMuted italic">
          No variants configured yet for this product.
        </td>
      </tr>
    );
  }

  return (
    <tr className="bg-forest-950/50">
      <td colSpan={6} className="px-8 py-3">
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400/90 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5" />
            Configured Variants & Seat Packs:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {variants.map((v) => (
              <div
                key={v.id}
                className="p-2.5 rounded-lg bg-forest-900 border border-surface-border flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-semibold text-surface-text">{v.name}:</span>{' '}
                  <span className="text-emerald-300">{v.value}</span>
                  {v.sku && <span className="block text-[10px] text-surface-textMuted font-mono">SKU: {v.sku}</span>}
                </div>
                <div className="text-right">
                  <span className="font-semibold text-surface-text">
                    +{v.price_adjustment}
                  </span>
                  <Badge variant={v.is_active ? 'emerald' : 'forest'} className="ml-2 text-[9px]">
                    {v.is_active ? 'Active' : 'Disabled'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </td>
    </tr>
  );
};

export const ProductsPage: React.FC = () => {
  const { role } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'service' | 'consumable' | 'storable'>('all');
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useProducts();

  const products = data?.items || [];

  const filteredProducts = products.filter((p: Product) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(search.toLowerCase()));
    const matchesType = typeFilter === 'all' || p.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const toggleExpand = (id: string) => {
    setExpandedProduct(expandedProduct === id ? null : id);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Mock-mode indicator — shown when backend is unreachable */}
      {!isLoading && !error && data && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg border border-emerald-800/40 bg-emerald-950/40 text-emerald-400 text-xs">
          <Database className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            <strong>Mock Mode Active</strong> — data is served from in-memory fixtures.
            Start the FastAPI backend on port 8000 for live catalog data.
          </span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="font-heading text-2xl font-bold text-surface-text tracking-tight">
              Products & Variants
            </h1>
            <Badge variant="emerald">Live Catalog</Badge>
          </div>
          <p className="text-sm text-surface-textMuted">
            Manage software offerings, tiered add-ons, license keys, and variant price adjustments.
          </p>
        </div>

        {role === 'admin' && (
          <Button variant="primary" onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4" />
            <span>New Product</span>
          </Button>
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-forest-900/60 border-surface-border">
          <div className="text-xs text-surface-textMuted uppercase tracking-wider font-medium">Total Catalog Items</div>
          <div className="mt-2 text-2xl font-bold font-heading text-surface-text">{products.length}</div>
          <div className="mt-1 text-xs text-emerald-400 font-medium">Active in pricing engine</div>
        </Card>
        <Card className="bg-forest-900/60 border-surface-border">
          <div className="text-xs text-surface-textMuted uppercase tracking-wider font-medium">SaaS Core Services</div>
          <div className="mt-2 text-2xl font-bold font-heading text-surface-text">
            {products.filter((p) => p.type === 'service').length}
          </div>
          <div className="mt-1 text-xs text-surface-textMuted">Recurring subscription bases</div>
        </Card>
        <Card className="bg-forest-900/60 border-surface-border">
          <div className="text-xs text-surface-textMuted uppercase tracking-wider font-medium">Add-on Modules</div>
          <div className="mt-2 text-2xl font-bold font-heading text-surface-text">
            {products.filter((p) => p.type === 'consumable' || p.type === 'storable').length}
          </div>
          <div className="mt-1 text-xs text-mint-400">Expandable revenue drivers</div>
        </Card>
        <Card className="bg-forest-900/60 border-surface-border">
          <div className="text-xs text-surface-textMuted uppercase tracking-wider font-medium">Base Currency</div>
          <div className="mt-2 text-2xl font-bold font-heading text-surface-text">USD ($)</div>
          <div className="mt-1 text-xs text-emerald-400 font-medium">Multi-currency supported</div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 bg-forest-900/40 rounded-xl border border-surface-border flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter products by title or description..."
            className="w-full h-9 px-3 rounded-lg bg-forest-850/70 border border-surface-border text-xs text-surface-text placeholder:text-surface-subtle focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {(['all', 'service', 'consumable', 'storable'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                typeFilter === t
                  ? 'bg-emerald-600 text-forest-950 font-bold shadow-sm'
                  : 'text-surface-textMuted hover:bg-forest-800'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Catalog Table */}
      <div className="bg-forest-900/50 rounded-xl border border-surface-border overflow-hidden shadow-card">
        {isLoading ? (
          <div className="p-12 text-center text-surface-textMuted">Loading catalog data...</div>
        ) : error ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-red-400 text-sm">Unable to load products.</p>
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
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center text-surface-textMuted">No products found matching filters.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-forest-950/80 border-b border-surface-border/60 text-xs uppercase text-surface-textMuted tracking-wider font-semibold">
              <tr>
                <th className="py-3.5 px-4 w-10"></th>
                <th className="py-3.5 px-4">Product Name</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Sales Price</th>
                <th className="py-3.5 px-4">Cost Price</th>
                <th className="py-3.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border/40">
              {filteredProducts.map((p) => {
                const isExpanded = expandedProduct === p.id;
                return (
                  <React.Fragment key={p.id}>
                    <tr
                      onClick={() => toggleExpand(p.id)}
                      className="hover:bg-forest-850/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4 text-surface-textMuted">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-surface-textMuted group-hover:text-surface-text" />
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-surface-text flex items-center gap-2">
                          <Package className="w-4 h-4 text-emerald-400/80" />
                          <span>{p.name}</span>
                        </div>
                        {p.description && (
                          <p className="text-xs text-surface-textMuted truncate max-w-md mt-0.5">
                            {p.description}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="forest" className="capitalize text-[10px]">
                          {p.type}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-surface-text">
                        ${p.sales_price} <span className="text-[10px] text-surface-textMuted">{p.currency}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-surface-textMuted">
                        ${p.cost_price}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={p.is_active ? 'emerald' : 'danger'}>
                          {p.is_active ? 'Active' : 'Disabled'}
                        </Badge>
                      </td>
                    </tr>
                    {isExpanded && <ProductVariantRow productId={p.id} />}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <ProductCreateModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};
