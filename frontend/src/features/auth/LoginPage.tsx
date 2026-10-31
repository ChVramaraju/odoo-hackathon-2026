import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Hexagon,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  ArrowRight,
  Shield,
  HelpCircle,
  X,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { UserRole } from '../../types/auth';

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email address is required')
    .email('Please enter a valid business email address'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  const { login, switchRole, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development' || import.meta.env.MODE === 'test';
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/';

  // If already authenticated, redirect
  React.useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setLoginError(null);
    const result = await login(data.email, data.password);
    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setLoginError(result.error || 'Authentication failed. Please verify your credentials.');
    }
  };

  const handleEvaluatorAccess = (role: UserRole) => {
    switchRole(role);
    navigate(from, { replace: true });
  };

  const handleResetSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail || !resetEmail.includes('@')) return;
    setResetSent(true);
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-72 h-72 bg-mint-500/5 rounded-full blur-2xl pointer-events-none" />

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center z-10 space-y-3">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-600/20 border border-emerald-500/40 shadow-glow-emerald text-emerald-400 mx-auto">
          <Hexagon className="w-8 h-8 fill-emerald-500/20 text-emerald-400 animate-pulse" />
        </div>
        <div>
          <h1 className="font-heading text-3xl font-extrabold text-surface-text tracking-tight">
            Brightloop
          </h1>
          <p className="text-xs uppercase tracking-widest font-semibold text-emerald-400/90 mt-1">
            Revenue in Motion • FinOps Platform
          </p>
        </div>
        <p className="text-xs text-surface-textMuted max-w-sm mx-auto">
          Sign in with your enterprise credentials to access subscription governance, revenue radar, and billing reconciliation.
        </p>
      </div>

      {/* Main Login Card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4 sm:px-0">
        <div className="bg-forest-950/80 backdrop-blur-xl py-8 px-6 sm:px-10 shadow-2xl rounded-2xl border border-surface-border space-y-6">
          {/* Security status badge */}
          <div className="flex items-center justify-between pb-4 border-b border-surface-border/60">
            <div className="flex items-center gap-1.5 text-xs text-surface-textMuted">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Identity Provider</span>
            </div>
            <Badge variant="emerald" className="text-[10px] py-0.5">
              Supabase Auth v2
            </Badge>
          </div>

          {/* Authentication Error Banner */}
          {loginError && (
            <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-900/60 text-xs text-rose-300 flex items-start gap-2.5 animate-shake">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold block">Authentication Failed</span>
                <span className="text-rose-300/90 leading-relaxed block">{loginError}</span>
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-surface-textMuted uppercase tracking-wider mb-1.5">
                Business Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-textMuted pointer-events-none" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@company.com"
                  {...register('email')}
                  className={`w-full h-10 pl-9 pr-3 rounded-lg bg-forest-900/70 border text-sm text-surface-text placeholder:text-surface-subtle focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all ${
                    errors.email ? 'border-rose-500 focus:ring-rose-500' : 'border-surface-border'
                  }`}
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-rose-400">{errors.email.message}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-xs font-medium text-surface-textMuted uppercase tracking-wider">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setIsForgotPasswordOpen(true)}
                  className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-textMuted pointer-events-none" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  {...register('password')}
                  className={`w-full h-10 pl-9 pr-10 rounded-lg bg-forest-900/70 border text-sm text-surface-text placeholder:text-surface-subtle focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all ${
                    errors.password ? 'border-rose-500 focus:ring-rose-500' : 'border-surface-border'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-textMuted hover:text-surface-text transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-rose-400">{errors.password.message}</p>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              isLoading={isSubmitting}
              className="w-full h-10 mt-2 shadow-lg shadow-emerald-950/50 justify-center"
            >
              <span>Sign In to Brightloop</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </form>
        </div>

        {/* Development Preview — Visually Separate Section (Dev Only) */}
        {isDev && (
          <div className="mt-5 p-5 bg-amber-950/20 backdrop-blur-xl rounded-2xl border border-amber-500/40 shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-amber-500/20">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-amber-300">
                  Development Preview — Not Real Authentication
                </h2>
              </div>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                Dev Only
              </span>
            </div>

            <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-900/60 text-xs text-amber-200/90 leading-relaxed">
              <strong className="text-amber-300 font-semibold block mb-0.5">⚠️ Simulation Notice:</strong>
              Preview mode only simulates frontend UI perspectives for evaluators. It does not authenticate with Supabase, does not create a session token, and cannot perform authorized backend actions.
            </div>

            <p className="text-[11px] text-surface-textMuted">
              Select a simulated persona to inspect role-specific UI layouts:
            </p>

            <div className="grid grid-cols-3 gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => handleEvaluatorAccess('admin')}
                className="py-2 px-2 rounded-lg bg-forest-900 hover:bg-forest-850 border border-surface-border text-xs text-surface-text font-medium flex items-center justify-center gap-1.5 transition-all hover:border-amber-500/50"
              >
                <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Admin</span>
              </button>
              <button
                type="button"
                onClick={() => handleEvaluatorAccess('staff')}
                className="py-2 px-2 rounded-lg bg-forest-900 hover:bg-forest-850 border border-surface-border text-xs text-surface-text font-medium flex items-center justify-center gap-1.5 transition-all hover:border-amber-500/50"
              >
                <UserCheck className="w-3.5 h-3.5 text-mint-400" />
                <span>Staff</span>
              </button>
              <button
                type="button"
                onClick={() => handleEvaluatorAccess('customer')}
                className="py-2 px-2 rounded-lg bg-forest-900 hover:bg-forest-850 border border-surface-border text-xs text-surface-text font-medium flex items-center justify-center gap-1.5 transition-all hover:border-amber-500/50"
              >
                <UserCheck className="w-3.5 h-3.5 text-blue-400" />
                <span>Customer</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer Security Notice */}
        <div className="mt-4 text-center text-xs text-surface-textMuted flex items-center justify-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-emerald-500/80" />
          <span>Protected by enterprise session tokens & Supabase PostgreSQL RLS</span>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <Modal
        isOpen={isForgotPasswordOpen}
        onClose={() => {
          setIsForgotPasswordOpen(false);
          setResetSent(false);
        }}
        maxWidth="md"
        ariaLabel="Password Reset Recovery"
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-surface-border/60">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-emerald-400" />
              <h3 className="font-heading text-lg font-bold text-surface-text">
                Password Recovery
              </h3>
            </div>
            <button
              onClick={() => {
                setIsForgotPasswordOpen(false);
                setResetSent(false);
              }}
              className="p-1 rounded-lg text-surface-textMuted hover:text-surface-text hover:bg-forest-850"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {resetSent ? (
            <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-300 space-y-2 text-center">
              <p className="font-semibold text-sm">Reset Request Registered</p>
              <p className="text-surface-textMuted">
                If an account matches <strong>{resetEmail}</strong>, password reset instructions will be delivered to your inbox via Supabase Auth email triggers.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsForgotPasswordOpen(false);
                  setResetSent(false);
                }}
                className="mt-3 text-xs"
              >
                Return to Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleResetSubmit} className="space-y-4">
              <p className="text-xs text-surface-textMuted leading-relaxed">
                Enter your registered corporate email address to receive password reset instructions.
              </p>
              <div>
                <label className="block text-xs font-medium text-surface-textMuted mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full h-9 px-3 rounded-lg bg-forest-900 border border-surface-border text-xs text-surface-text focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-border/60">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsForgotPasswordOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm">
                  Send Reset Link
                </Button>
              </div>
            </form>
          )}
        </div>
      </Modal>
    </div>
  );
};
