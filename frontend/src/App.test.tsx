import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { defaultAdminUser } from './context/AuthContext';
import { apiClient } from './api/client';

describe('Brightloop Application Shell & Authentication Flow', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    apiClient.setToken(null);
  });

  it('redirects unauthenticated visitor to the login page with credentials and evaluator tools', async () => {
    render(<App />);

    // Initially or after session check, user is presented with the login page
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Sign In to Brightloop/i })).toBeInTheDocument();
    });

    expect(screen.getAllByText(/Brightloop/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Revenue in Motion • FinOps Platform/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('name@company.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••••••')).toBeInTheDocument();
    expect(screen.getByText(/Development Preview — Not Real Authentication/i)).toBeInTheDocument();
  });

  it('allows evaluator preview access directly into the authenticated application shell', async () => {
    const { user } = await import('@testing-library/user-event').then((m) => ({
      user: m.default.setup(),
    }));
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Admin/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Admin/i }));

    await waitFor(() => {
      expect(screen.getByText('Products & Variants')).toBeInTheDocument();
      expect(screen.getByText('Subscription Plans')).toBeInTheDocument();
    });
  });

  it('renders the brand title and navigation links when authenticated', async () => {
    render(<App initialUser={defaultAdminUser} />);
    expect(screen.getAllByText(/Brightloop/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Revenue in Motion/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Products & Variants')).toBeInTheDocument();
    expect(screen.getByText('Subscription Plans')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Mock Mode Ready|FastAPI Live/i)).toBeInTheDocument();
    });
  });

  it('renders the active role switcher and evaluator tools when authenticated', async () => {
    render(<App initialUser={defaultAdminUser} />);
    expect(screen.getByText(/Evaluator Role View:/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'admin' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'staff' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'customer' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Mock Mode Ready|FastAPI Live/i)).toBeInTheDocument();
    });
  });

  it('renders the dashboard overview hero banner when authenticated', async () => {
    render(<App initialUser={defaultAdminUser} />);
    expect(screen.getByText(/Brightloop FinOps & Subscription Automation/i)).toBeInTheDocument();
    expect(screen.getByText(/Annual Run Rate/i)).toBeInTheDocument();
    expect(screen.getByText(/Active Subscriptions/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Mock Mode Ready|FastAPI Live/i)).toBeInTheDocument();
    });
  });

  it('provides accessible search input and mobile drawer toggling', async () => {
    const { user } = await import('@testing-library/user-event').then((m) => ({
      user: m.default.setup(),
    }));
    render(<App initialUser={defaultAdminUser} />);

    // Accessible search input
    const searchInput = screen.getByLabelText(/Search catalog, plans, and subscriptions/i);
    expect(searchInput).toBeInTheDocument();

    // Mobile drawer toggle
    const toggleButton = screen.getByRole('button', { name: /Open navigation menu/i });
    expect(toggleButton).toBeInTheDocument();

    // Open mobile drawer
    await user.click(toggleButton);

    const closeButton = screen.getByRole('button', { name: /Close navigation menu/i });
    expect(closeButton).toBeInTheDocument();

    // Close via close button
    await user.click(closeButton);
    expect(screen.queryByRole('button', { name: /Close navigation menu/i })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Mock Mode Ready|FastAPI Live/i)).toBeInTheDocument();
    });
  });

  it('closes mobile drawer on Escape key press', async () => {
    const { user } = await import('@testing-library/user-event').then((m) => ({
      user: m.default.setup(),
    }));
    render(<App initialUser={defaultAdminUser} />);

    const toggleButton = screen.getByRole('button', { name: /Open navigation menu/i });
    await user.click(toggleButton);

    expect(screen.getByRole('button', { name: /Close navigation menu/i })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: /Close navigation menu/i })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Mock Mode Ready|FastAPI Live/i)).toBeInTheDocument();
    });
  });

  it('signs out the user and returns to the login page when sign out is clicked', async () => {
    const { user } = await import('@testing-library/user-event').then((m) => ({
      user: m.default.setup(),
    }));
    render(<App initialUser={defaultAdminUser} />);

    const signOutBtn = screen.getByRole('button', { name: /Sign out of Brightloop/i });
    await user.click(signOutBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Sign In to Brightloop/i })).toBeInTheDocument();
    });
  });
});
