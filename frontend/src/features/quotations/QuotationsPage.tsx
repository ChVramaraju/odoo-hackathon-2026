import React from 'react';
import { ModulePlaceholder } from '../placeholders/ModulePlaceholder';

export const QuotationsPage: React.FC = () => {
  return (
    <ModulePlaceholder
      title="Customer Quotations"
      badge="Step 2 of Core Journey"
      description="Assemble customer-specific quotes with selected plans, product add-ons, contract validity days, and confirmation workflow."
      contractsRef="API_CONTRACTS.md"
      targetEndpoints={[
        { method: 'GET', path: '/api/v1/quotations', purpose: 'List role-scoped quotations with filters' },
        { method: 'POST', path: '/api/v1/quotations', purpose: 'Create quotation with product/plan lines' },
        { method: 'GET', path: '/api/v1/quotations/{id}', purpose: 'Retrieve quotation details and calculated totals' },
        { method: 'POST', path: '/api/v1/quotations/{id}/confirm', purpose: 'Confirm quotation into active subscription' },
      ]}
      plannedFeatures={[
        'Interactive Quotation Builder with customer picker',
        'Line item selection directly linked to Live Products & Plans',
        'Server-calculated tax, discount, and validity expiration dates',
        'One-click "Confirm Quotation" triggering atomic subscription activation',
      ]}
    />
  );
};

