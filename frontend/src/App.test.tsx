import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('Brightloop Application Shell', () => {
  it('renders the brand title and navigation links', () => {
    render(<App />);
    expect(screen.getAllByText(/Brightloop/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Revenue in Motion/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Products & Variants')).toBeInTheDocument();
    expect(screen.getByText('Subscription Plans')).toBeInTheDocument();
  });

  it('renders the active role switcher and evaluator tools', () => {
    render(<App />);
    expect(screen.getByText(/Evaluator Role View:/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'admin' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'staff' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'customer' })).toBeInTheDocument();
  });

  it('renders the dashboard overview hero banner', () => {
    render(<App />);
    expect(screen.getByText(/Brightloop FinOps & Subscription Automation/i)).toBeInTheDocument();
    expect(screen.getByText(/Annual Run Rate/i)).toBeInTheDocument();
    expect(screen.getByText(/Active Subscriptions/i)).toBeInTheDocument();
  });
});
