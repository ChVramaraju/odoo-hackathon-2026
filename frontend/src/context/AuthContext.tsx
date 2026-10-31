import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, UserRole } from '../types/auth';
import { apiClient } from '../api/client';

interface AuthContextType {
  user: User | null;
  role: UserRole;
  accessToken: string | null;
  isLoading: boolean;
  switchRole: (role: UserRole) => void;
  login: (email: string, role?: UserRole) => void;
  logout: () => void;
}

const defaultAdminUser: User = {
  id: 'usr-admin-001',
  email: 'elena.vance@brightloop.io',
  name: 'Elena Vance',
  role: 'admin',
  is_active: true,
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(defaultAdminUser);
  const [role, setRole] = useState<UserRole>('admin');
  const [accessToken, setAccessToken] = useState<string | null>('mock-admin-token-xyz');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    // In demo / dev mode, notify apiClient of current auth token
    apiClient.setToken(accessToken);
  }, [accessToken]);

  const switchRole = (newRole: UserRole) => {
    setRole(newRole);
    if (newRole === 'admin') {
      setUser({
        id: 'usr-admin-001',
        email: 'elena.vance@brightloop.io',
        name: 'Elena Vance (VP Finance)',
        role: 'admin',
        is_active: true,
      });
      setAccessToken('mock-admin-token-xyz');
    } else if (newRole === 'staff') {
      setUser({
        id: 'usr-staff-002',
        email: 'marcus.finops@brightloop.io',
        name: 'Marcus Chen (FinOps Lead)',
        role: 'staff',
        is_active: true,
      });
      setAccessToken('mock-staff-token-abc');
    } else {
      setUser({
        id: 'usr-cust-003',
        email: 'billing@acmeglobal.com',
        name: 'Sarah Connor (Acme Corp)',
        role: 'customer',
        is_active: true,
      });
      setAccessToken('mock-customer-token-123');
    }
  };

  const login = (email: string, selectedRole: UserRole = 'customer') => {
    setIsLoading(true);
    setTimeout(() => {
      const newUser: User = {
        id: `usr-${Date.now().toString(36)}`,
        email,
        name: email.split('@')[0],
        role: selectedRole,
        is_active: true,
      };
      setUser(newUser);
      setRole(selectedRole);
      setAccessToken(`token-${selectedRole}-${Date.now()}`);
      setIsLoading(false);
    }, 400);
  };

  const logout = () => {
    setUser(null);
    setAccessToken(null);
    apiClient.setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, role, accessToken, isLoading, switchRole, login, logout }}>
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

