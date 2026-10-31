export type UserRole = 'admin' | 'staff' | 'customer';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name?: string;
  is_active?: boolean;
}

export interface AuthSession {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
}

