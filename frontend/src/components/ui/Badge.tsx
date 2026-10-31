import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const badgeVariants = cva(
  'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium tracking-wide uppercase font-sans',
  {
    variants: {
      variant: {
        emerald: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
        mint: 'bg-mint-500/15 text-mint-400 border border-mint-500/30',
        forest: 'bg-forest-800 text-surface-textMuted border border-surface-border',
        warning: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
        danger: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
        outline: 'border border-surface-border text-surface-textMuted',
      },
    },
    defaultVariants: {
      variant: 'emerald',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge: React.FC<BadgeProps> = ({ className, variant, children, ...props }) => {
  return (
    <span className={twMerge(clsx(badgeVariants({ variant, className })))} {...props}>
      {children}
    </span>
  );
};

