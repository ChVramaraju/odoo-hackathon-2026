import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, UserRole, LoginResult } from '../types/auth';
import { apiClient } from '../api/client';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { User as SupabaseUser } from '@supabase/supabase-js';

export interface AuthContextType {
  user: User | null;
  role: UserRole;
  accessToken: string | null;
  isLoading: boolean;
  authError: string | null;
  isEvaluatorMode: boolean;
  isRealAuth: boolean;
  switchRole: (role: UserRole) => void;
  login: (email: string, password?: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  updateProfile: (data: { name?: string; company?: string }) => void;
}

export const defaultAdminUser: User = {
  id: 'usr-admin-001',
  email: 'elena.vance@brightloop.io',
  name: 'Elena Vance (VP Finance)',
  role: 'admin',
  is_active: true,
};

export const defaultStaffUser: User = {
  id: 'usr-staff-002',
  email: 'marcus.finops@brightloop.io',
  name: 'Marcus Chen (FinOps Lead)',
  role: 'staff',
  is_active: true,
};

export const defaultCustomerUser: User = {
  id: 'usr-cust-001',
  customerId: 'cust-001',
  email: 'schen@acmecloud.com',
  name: 'Sarah Chen',
  company: 'Acme Cloud Corp',
  role: 'customer',
  is_active: true,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapSupabaseUser(sbUser: SupabaseUser): User {
  // Read role from app_metadata first (set by backend/admin), then user_metadata as fallback, defaulting to 'customer'
  const rawRole = (sbUser.app_metadata?.role || sbUser.user_metadata?.role) as string | undefined;
  const role: UserRole =
    rawRole === 'admin' || rawRole === 'staff' || rawRole === 'customer'
      ? rawRole
      : 'customer';

  const name =
    sbUser.user_metadata?.name ||
    sbUser.user_metadata?.full_name ||
    (sbUser.email ? sbUser.email.split('@')[0] : 'User');

  const company = sbUser.user_metadata?.company as string | undefined;
  const customerId = (sbUser.user_metadata?.customerId || sbUser.user_metadata?.customer_id) as string | undefined;

  return {
    id: sbUser.id,
    email: sbUser.email || '',
    name,
    role,
    company,
    customerId,
    is_active: true,
  };
}

export interface AuthProviderProps {
  children: React.ReactNode;
  initialUser?: User | null;
  initialRole?: UserRole;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  initialUser,
  initialRole = 'admin',
}) => {
  const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development' || import.meta.env.MODE === 'test';
  const [user, setUser] = useState<User | null>(initialUser !== undefined ? initialUser : null);
  const [role, setRole] = useState<UserRole>(initialUser?.role || initialRole);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(initialUser === undefined);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isEvaluatorMode, setIsEvaluatorMode] = useState<boolean>(false);
  const [isRealAuth, setIsRealAuth] = useState<boolean>(false);

  useEffect(() => {
    // Notify apiClient of current auth token
    apiClient.setToken(accessToken);
  }, [accessToken]);

  useEffect(() => {
    let isMounted = true;

    // If initialUser was explicitly provided (e.g. in test harness), skip session restoration
    if (initialUser !== undefined) {
      setUser(initialUser);
      if (initialUser) {
        setRole(initialUser.role);
      }
      setIsLoading(false);
      return;
    }

    // Only restore evaluator preview if running in development mode
    if (isDev) {
      let savedEvaluatorRole: UserRole | null = null;
      try {
        savedEvaluatorRole = sessionStorage.getItem('brightloop_preview_role') as UserRole | null;
      } catch {
        // ignore storage access errors
      }

      if (savedEvaluatorRole && ['admin', 'staff', 'customer'].includes(savedEvaluatorRole)) {
        applyEvaluatorPersona(savedEvaluatorRole);
        setIsLoading(false);
        return;
      }
    }

    // If Supabase client is not available or configured
    if (!supabase || !isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    // Restore real Supabase session
    setIsLoading(true);
    supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        if (!isMounted) return;
        if (error) {
          console.warn('Supabase session restoration warning:', error.message);
          setIsLoading(false);
          return;
        }

        if (session?.user) {
          const mapped = mapSupabaseUser(session.user);
          setUser(mapped);
          setRole(mapped.role);
          setAccessToken(session.access_token);
          apiClient.setToken(session.access_token);
          setIsEvaluatorMode(false);
          setIsRealAuth(true);
          apiClient.setMockMode(false);
          try {
            sessionStorage.removeItem('brightloop_preview_role');
          } catch {
            // ignore
          }
        } else {
          setUser(null);
          setAccessToken(null);
          apiClient.setToken(null);
          setIsEvaluatorMode(false);
          setIsRealAuth(false);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('Supabase getSession exception:', err);
        setIsLoading(false);
      });

    // Listen to real Supabase auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (session?.user) {
        const mapped = mapSupabaseUser(session.user);
        setUser(mapped);
        setRole(mapped.role);
        setAccessToken(session.access_token);
        apiClient.setToken(session.access_token);
        setIsEvaluatorMode(false);
        setIsRealAuth(true);
        apiClient.setMockMode(false);
        try {
          sessionStorage.removeItem('brightloop_preview_role');
        } catch {
          // ignore
        }
        setIsLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setAccessToken(null);
        apiClient.setToken(null);
        setIsEvaluatorMode(false);
        setIsRealAuth(false);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, [initialUser, isDev]);

  const applyEvaluatorPersona = (evalRole: UserRole) => {
    // Disabled in production builds
    if (!isDev) {
      console.warn('Evaluator preview is disabled in production builds.');
      return;
    }

    // Never override a real logged-in Supabase user!
    if (isRealAuth) {
      console.warn('Evaluator preview cannot override an authenticated Supabase user identity or role.');
      return;
    }

    setIsEvaluatorMode(true);
    setIsRealAuth(false);
    apiClient.setMockMode(true);
    setRole(evalRole);
    try {
      sessionStorage.setItem('brightloop_preview_role', evalRole);
    } catch {
      // ignore
    }

    // Evaluator mode sets simulated client token marker, NEVER a real Supabase JWT
    const previewToken = `preview-mode-${evalRole}`;
    setAccessToken(previewToken);
    apiClient.setToken(previewToken);

    if (evalRole === 'admin') {
      setUser(defaultAdminUser);
    } else if (evalRole === 'staff') {
      setUser(defaultStaffUser);
    } else {
      setUser(defaultCustomerUser);
      apiClient.setActiveCustomerId('cust-001');
    }
  };

  const switchRole = (newRole: UserRole) => {
    // Disabled in production builds
    if (!isDev) {
      console.warn('Evaluator preview is disabled in production builds.');
      return;
    }
    // Never override a real logged-in Supabase user!
    if (isRealAuth) {
      console.warn('Cannot override authenticated Supabase user identity or role with evaluator preview.');
      return;
    }
    applyEvaluatorPersona(newRole);
  };

  const updateProfile = (data: { name?: string; company?: string }) => {
    setUser((prev) => (prev ? { ...prev, ...data } : prev));
  };

  const login = async (email: string, password?: string): Promise<LoginResult> => {
    setAuthError(null);
    setIsLoading(true);

    if (!isSupabaseConfigured() || !supabase) {
      setIsLoading(false);
      const err =
        'Supabase client is not configured. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are defined in frontend/.env.';
      setAuthError(err);
      return { success: false, error: err };
    }

    if (!password) {
      setIsLoading(false);
      const err = 'Password is required for Supabase authentication.';
      setAuthError(err);
      return { success: false, error: err };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setIsLoading(false);
        setAuthError(error.message);
        return { success: false, error: error.message };
      }

      if (!data.session || !data.user) {
        setIsLoading(false);
        const err = 'Authentication succeeded but no active session was returned by Supabase.';
        setAuthError(err);
        return { success: false, error: err };
      }

      // Clear evaluator preview override on real login
      setIsEvaluatorMode(false);
      setIsRealAuth(true);
      apiClient.setMockMode(false);
      try {
        sessionStorage.removeItem('brightloop_preview_role');
      } catch {
        // ignore
      }

      const mapped = mapSupabaseUser(data.user);
      setUser(mapped);
      setRole(mapped.role);
      setAccessToken(data.session.access_token);
      apiClient.setToken(data.session.access_token);
      setIsLoading(false);

      return { success: true };
    } catch (err) {
      setIsLoading(false);
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred during login.';
      setAuthError(message);
      return { success: false, error: message };
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn('Supabase sign out error:', err);
    } finally {
      setIsEvaluatorMode(false);
      setIsRealAuth(false);
      apiClient.setMockMode(null);
      try {
        sessionStorage.removeItem('brightloop_preview_role');
      } catch {
        // ignore
      }
      setUser(null);
      setAccessToken(null);
      apiClient.setToken(null);
      setRole('customer');
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        accessToken,
        isLoading,
        authError,
        isEvaluatorMode,
        isRealAuth,
        switchRole,
        login,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
