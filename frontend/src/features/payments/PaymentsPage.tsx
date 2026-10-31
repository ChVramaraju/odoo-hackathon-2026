import React from 'react';
import { ModulePlaceholder } from '../placeholders/ModulePlaceholder';

export const PaymentsPage: React.FC = () => {
  return (
    <ModulePlaceholder
      title="Payments & Account Balances"
      badge="Step 5 of Core Journey"
      description="Record customer payments, track payment methods, compute outstanding invoice balances, and update cash flow KPIs."
      contractsRef="API_CONTRACTS.md"
      targetEndpoints={[
        { method: 'GET', path: '/api/v1/payments', purpose: 'List recorded payments and references' },
        { method: 'POST', path: '/api/v1/payments', purpose: 'Record payment against specific invoice' },
      ]}
      plannedFeatures={[
        'Record Payment modal with payment method picker (Card, Bank Transfer, ACH, Wire)',
        'Automatic balance recalculation (Total Invoiced - Total Paid = Balance Due)',
        'Overdue invoice alerts and grace period tracker',
        'Customer payment receipt history',
      ]}
    />
  );
};

