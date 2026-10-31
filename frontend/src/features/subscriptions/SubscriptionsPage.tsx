import React from 'react';
import { ModulePlaceholder } from '../placeholders/ModulePlaceholder';

export const SubscriptionsPage: React.FC = () => {
  return (
    <ModulePlaceholder
      title="Subscriptions Lifecycle Management"
      badge="Step 3 of Core Journey"
      description="Manage active, paused, and renewed contracts with explicit server-side state transitions (Draft → Quotation → Confirmed → Active → Closed)."
      contractsRef="API_CONTRACTS.md"
      targetEndpoints={[
        { method: 'GET', path: '/api/v1/subscriptions', purpose: 'List subscriptions filtered by role & status' },
        { method: 'POST', path: '/api/v1/subscriptions', purpose: 'Direct subscription creation' },
        { method: 'GET', path: '/api/v1/subscriptions/{id}', purpose: 'Subscription contract breakdown' },
        { method: 'POST', path: '/api/v1/subscriptions/{id}/pause', purpose: 'Pause subscription for operational review' },
        { method: 'POST', path: '/api/v1/subscriptions/{id}/resume', purpose: 'Resume paused subscription' },
        { method: 'POST', path: '/api/v1/subscriptions/{id}/renew', purpose: 'Renew subscription contract' },
        { method: 'POST', path: '/api/v1/subscriptions/{id}/close', purpose: 'Early termination / close contract' },
      ]}
      plannedFeatures={[
        'Full lifecycle state progression visualization',
        'Next billing cycle date and recurring invoice preview',
        'Customer self-service pause/resume request actions',
        'Audit trail integration for every contract state transition',
      ]}
    />
  );
};

