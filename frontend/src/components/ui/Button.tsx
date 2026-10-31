import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const buttonVariants = cva(
  'inline-flex items-center justify-center font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:pointer-events-none disabled:opacity-50 select-none',
  {
    variants: {
      variant: {
        primary:
          'bg-emerald-600 text-forest-950 hover:bg-emerald-500 font-semibold shadow-glow-emerald active:scale-[0.98]',
        secondary:
          'bg-surface-card hover:bg-surface-cardHover text-surface-text border border-surface-border hover:border-emerald-600/50',
        outline:
          'border border-surface-border hover:border-emerald-500/60 text-surface-text hover:bg-forest-800/50',
        ghost:
          'text-surface-textMuted hover:text-surface-text hover:bg-surface-card',
        danger:
          'bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30',
        mint:
          'bg-mint-400 text-forest-950 hover:bg-mint-300 font-semibold shadow-glow-mint',
      },
      size: {
        sm: 'h-8 px-3 text-xs rounded-md gap-1.5',
        md: 'h-9 px-4 text-sm rounded-lg gap-2',
        lg: 'h-11 px-6 text-base rounded-xl gap-2.5',
        icon: 'h-9 w-9 p-0 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={twMerge(clsx(buttonVariants({ variant, size, className })))}
        {...props}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span>Loading...</span>
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

