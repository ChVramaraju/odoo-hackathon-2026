import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth, defaultAdminUser, defaultCustomerUser } from '../../context/AuthContext';
import { LoginPage } from './LoginPage';
import { ProtectedRoute } from '../../components/layout/ProtectedRoute';
import { AppLayout } from '../../components/layout/AppLayout';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { apiClient } from '../../api/client';

describe('Supabase Authentication & AuthContext', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    sessionStorage.clear();
    localStorage.clear();
    apiClient.setToken(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('detects Supabase configuration correctly from environment variables', () => {
    expect(isSupabaseConfigured()).toBe(true);
    expect(supabase).not.toBeNull();
  });

  it('renders login page with email/password as primary and visually separated development preview section', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialUser={null}>
          <MemoryRouter initialEntries={['/login']}>
            <LoginPage />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    expect(screen.getByRole('heading', { name: /Brightloop/i })).toBeInTheDocument();
    expect(screen.getByText(/Revenue in Motion • FinOps Platform/i)).toBeInTheDocument();
    expect(screen.getByText(/Business Email Address/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('name@company.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••••••')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In to Brightloop/i })).toBeInTheDocument();

    // Visually separated development preview section with explicit warning
    expect(screen.getByRole('heading', { name: /Development Preview — Not Real Authentication/i })).toBeInTheDocument();
    expect(screen.getByText(/Simulation Notice:/i)).toBeInTheDocument();
    expect(screen.getByText(/Preview mode only simulates frontend UI perspectives for evaluators/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Admin/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Staff/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Customer/i })).toBeInTheDocument();
  });

  it('toggles password visibility between masked and plain text', async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialUser={null}>
          <MemoryRouter initialEntries={['/login']}>
            <LoginPage />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    const passwordInput = screen.getByPlaceholderText('••••••••••••');
    expect(passwordInput).toHaveAttribute('type', 'password');

    const toggleButton = screen.getByLabelText(/Toggle password visibility/i);
    await user.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'text');

    await user.click(toggleButton);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('validates required email and password fields before submission', async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialUser={null}>
          <MemoryRouter initialEntries={['/login']}>
            <LoginPage />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    const submitBtn = screen.getByRole('button', { name: /Sign In to Brightloop/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Email address is required/i)).toBeInTheDocument();
      expect(screen.getByText(/Password must be at least 6 characters/i)).toBeInTheDocument();
    });
  });

  it('displays authentication error banner when Supabase returns an error for invalid credentials', async () => {
    if (supabase) {
      vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValueOnce({
        data: { user: null, session: null },
        error: {
          name: 'AuthApiError',
          message: 'Invalid login credentials',
          status: 400,
        } as any,
      });
    }

    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialUser={null}>
          <MemoryRouter initialEntries={['/login']}>
            <LoginPage />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    const emailInput = screen.getByPlaceholderText('name@company.com');
    const passwordInput = screen.getByPlaceholderText('••••••••••••');
    const submitBtn = screen.getByRole('button', { name: /Sign In to Brightloop/i });

    await user.type(emailInput, 'unknown@brightloop.io');
    await user.type(passwordInput, 'wrongpassword123');
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Authentication Failed')).toBeInTheDocument();
      expect(screen.getByText('Invalid login credentials')).toBeInTheDocument();
    });
  });

  it('authenticates successfully against Supabase and navigates to target route', async () => {
    const mockSbUser = {
      id: 'supabase-user-uuid-123',
      email: 'verified@brightloop.io',
      app_metadata: { role: 'admin' },
      user_metadata: { name: 'Verified Admin' },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    };

    const mockSession = {
      access_token: 'valid-jwt-access-token-12345',
      token_type: 'bearer',
      user: mockSbUser,
      expires_in: 3600,
      refresh_token: 'valid-refresh-token',
    };

    if (supabase) {
      vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValueOnce({
        data: { user: mockSbUser as any, session: mockSession as any },
        error: null,
      });
    }

    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialUser={null}>
          <MemoryRouter initialEntries={['/login']}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<div data-testid="dashboard-destination">Welcome to FinOps</div>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    await user.type(screen.getByPlaceholderText('name@company.com'), 'verified@brightloop.io');
    await user.type(screen.getByPlaceholderText('••••••••••••'), 'correctpassword');
    await user.click(screen.getByRole('button', { name: /Sign In to Brightloop/i }));

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-destination')).toBeInTheDocument();
    });
  });

  it('allows evaluator quick access buttons to switch persona and enter application', async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialUser={null}>
          <MemoryRouter initialEntries={['/login']}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<div data-testid="evaluator-destination">Evaluator Active</div>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    const adminPreviewBtn = screen.getByRole('button', { name: /Admin/i });
    await user.click(adminPreviewBtn);

    await waitFor(() => {
      expect(screen.getByTestId('evaluator-destination')).toBeInTheDocument();
    });
  });

  it('displays a persistent DEMO PREVIEW indicator throughout the application when preview mode is active', async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialUser={null}>
          <MemoryRouter initialEntries={['/login']}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<AppLayout />}>
                <Route index element={<div data-testid="demo-content">App Page Content</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    // Click preview mode
    await user.click(screen.getByRole('button', { name: /Admin/i }));

    await waitFor(() => {
      // Must display persistent DEMO PREVIEW banner
      expect(screen.getByRole('status', { name: /Demo Preview Active/i })).toBeInTheDocument();
      expect(screen.getAllByText(/DEMO PREVIEW/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/Simulated UI Mode Active — Not Authenticated with Supabase/i)).toBeInTheDocument();
    });
  });

  it('ensures preview mode cannot attach or fabricate privileged authorization tokens on live requests', () => {
    // In preview mode, token is explicitly prefixed with preview-mode-
    apiClient.setToken('preview-mode-admin');

    // Headers generated by apiClient must NOT include Authorization: Bearer
    const headers = (apiClient as any).getHeaders();
    expect(headers['Authorization']).toBeUndefined();

    // In contrast, a real JWT access token is attached
    apiClient.setToken('real-supabase-jwt-token-xyz');
    const realHeaders = (apiClient as any).getHeaders();
    expect(realHeaders['Authorization']).toBe('Bearer real-supabase-jwt-token-xyz');
  });

  it('prevents evaluator preview controls from overriding identity or role when a real Supabase user is logged in', async () => {
    const mockSbUser = {
      id: 'supabase-user-uuid-999',
      email: 'real.admin@brightloop.io',
      app_metadata: { role: 'admin' },
      user_metadata: { name: 'Real Admin' },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    };

    const mockSession = {
      access_token: 'valid-jwt-real-999',
      token_type: 'bearer',
      user: mockSbUser,
      expires_in: 3600,
      refresh_token: 'valid-refresh-token',
    };

    if (supabase) {
      vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValueOnce({
        data: { user: mockSbUser as any, session: mockSession as any },
        error: null,
      });
    }

    const TestOverrideComponent = () => {
      const { user, role, switchRole, isRealAuth, isEvaluatorMode } = useAuth();
      return (
        <div>
          <span data-testid="user-email">{user?.email}</span>
          <span data-testid="user-role">{role}</span>
          <span data-testid="is-real-auth">{String(isRealAuth)}</span>
          <span data-testid="is-evaluator">{String(isEvaluatorMode)}</span>
          <button onClick={() => switchRole('customer')}>Attempt Customer Override</button>
        </div>
      );
    };

    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialUser={null}>
          <MemoryRouter initialEntries={['/login']}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/" element={<TestOverrideComponent />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    // Perform real login
    await user.type(screen.getByPlaceholderText('name@company.com'), 'real.admin@brightloop.io');
    await user.type(screen.getByPlaceholderText('••••••••••••'), 'password123');
    await user.click(screen.getByRole('button', { name: /Sign In to Brightloop/i }));

    await waitFor(() => {
      expect(screen.getByTestId('user-email')).toHaveTextContent('real.admin@brightloop.io');
      expect(screen.getByTestId('is-real-auth')).toHaveTextContent('true');
      expect(screen.getByTestId('is-evaluator')).toHaveTextContent('false');
    });

    // Attempt to override role via switchRole
    await user.click(screen.getByRole('button', { name: /Attempt Customer Override/i }));

    // User must remain the real Supabase user!
    expect(screen.getByTestId('user-email')).toHaveTextContent('real.admin@brightloop.io');
    expect(screen.getByTestId('user-role')).toHaveTextContent('admin');
    expect(screen.getByTestId('is-real-auth')).toHaveTextContent('true');
    expect(screen.getByTestId('is-evaluator')).toHaveTextContent('false');
  });

  it('opens and submits password recovery modal safely', async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialUser={null}>
          <MemoryRouter initialEntries={['/login']}>
            <LoginPage />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    await user.click(screen.getByText(/Forgot password\?/i));
    expect(screen.getByRole('heading', { name: /Password Recovery/i })).toBeInTheDocument();

    const resetInputs = screen.getAllByPlaceholderText('name@company.com');
    const resetInput = resetInputs[resetInputs.length - 1];
    await user.type(resetInput, 'test@brightloop.io');
    await user.click(screen.getByRole('button', { name: /Send Reset Link/i }));

    await waitFor(() => {
      expect(screen.getByText(/Reset Request Registered/i)).toBeInTheDocument();
    });
  });

  it('redirects unauthenticated user accessing ProtectedRoute to /login', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialUser={null}>
          <MemoryRouter initialEntries={['/protected-area']}>
            <Routes>
              <Route element={<ProtectedRoute />}>
                <Route path="/protected-area" element={<div data-testid="protected-content">Secret Data</div>} />
              </Route>
              <Route path="/login" element={<div data-testid="login-page">Login Page Destination</div>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  it('renders protected content when user is authenticated', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialUser={defaultAdminUser}>
          <MemoryRouter initialEntries={['/protected-area']}>
            <Routes>
              <Route element={<ProtectedRoute />}>
                <Route path="/protected-area" element={<div data-testid="protected-content">Secret Data</div>} />
              </Route>
              <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });

  it('signs out user cleanly via logout() and synchronizes apiClient token', async () => {
    if (supabase) {
      vi.spyOn(supabase.auth, 'signOut').mockResolvedValueOnce({ error: null });
    }

    const LogoutTestComponent = () => {
      const { user, logout } = useAuth();
      return (
        <div>
          <span data-testid="user-status">{user ? user.email : 'logged-out'}</span>
          <button onClick={() => logout()}>Trigger Sign Out</button>
        </div>
      );
    };

    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider initialUser={defaultCustomerUser}>
          <MemoryRouter>
            <LogoutTestComponent />
          </MemoryRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('user-status')).toHaveTextContent('schen@acmecloud.com');
    await user.click(screen.getByRole('button', { name: /Trigger Sign Out/i }));

    await waitFor(() => {
      expect(screen.getByTestId('user-status')).toHaveTextContent('logged-out');
    });
  });
});
