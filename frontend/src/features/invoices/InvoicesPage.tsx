import React from 'react';
import { ModulePlaceholder } from '../placeholders/ModulePlaceholder';

export const InvoicesPage: React.FC = () => {
  return (
    <ModulePlaceholder
      title="Invoices & Recurring Billing"
      badge="Step 4 of Core Journey"
      description="Automated due-date invoice generator with idempotent billing period protection, tax snapshots, and line breakdowns."
      contractsRef="API_CONTRACTS.md"
      targetEndpoints={[
        { method: 'GET', path: '/api/v1/invoices', purpose: 'List invoices with status and overdue filters' },
        { method: 'POST', path: '/api/v1/invoices', purpose: 'Generate invoice for due subscription' },
        { method: 'GET', path: '/api/v1/invoices/{id}', purpose: 'Detailed invoice view with line items' },
        { method: 'POST', path: '/api/v1/invoices/{id}/confirm', purpose: 'Confirm draft invoice' },
        { method: 'POST', path: '/api/v1/invoices/{id}/cancel', purpose: 'Cancel unpaid invoice' },
      ]}
      plannedFeatures={[
        'Invoice ledger with status badges (Draft, Confirmed, Paid, Overdue, Canceled)',
        'Detailed line item breakdowns with immutable tax & price snapshots',
        'Backend scheduled worker trigger interface',
        'Invoice download & PDF receipt generation',
      ]}
    />
  );
};

