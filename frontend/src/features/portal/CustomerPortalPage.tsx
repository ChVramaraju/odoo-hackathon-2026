import React from 'react';
import { ModulePlaceholder } from '../placeholders/ModulePlaceholder';

export const CustomerPortalPage: React.FC = () => {
  return (
    <ModulePlaceholder
      title="Customer Self-Service Portal"
      badge="Customer Scoped"
      description="Dedicated self-service area allowing customers to view active subscriptions, download invoices, check renewal dates, and view billing history."
      contractsRef="API_CONTRACTS.md"
      targetEndpoints={[
        { method: 'GET', path: '/api/v1/auth/me', purpose: 'Resolve authenticated customer profile' },
        { method: 'GET', path: '/api/v1/subscriptions', purpose: 'Restricted by RLS to own subscriptions only' },
        { method: 'GET', path: '/api/v1/invoices', purpose: 'Restricted by RLS to own invoices only' },
      ]}
      plannedFeatures={[
        'Customer dashboard with active plan status and renewal dates',
        'Invoice history table with one-click PDF receipt export',
        'Self-service plan upgrade / add-on quotation requests',
        'Zero cross-customer record leakage (enforced server-side via Supabase RLS & FastAPI)',
      ]}
    />
  );
};

