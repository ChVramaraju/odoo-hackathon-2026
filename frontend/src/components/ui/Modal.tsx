import React, { useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

let activeModalCount = 0;
let originalOverflow = '';

function lockBodyScroll() {
  if (activeModalCount === 0) {
    originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  activeModalCount++;
}

function unlockBodyScroll() {
  activeModalCount = Math.max(0, activeModalCount - 1);
  if (activeModalCount === 0) {
    document.body.style.overflow = originalOverflow;
  }
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  className?: string;
  ariaLabel?: string;
}

const maxWidthMap: Record<NonNullable<ModalProps['maxWidth']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  children,
  maxWidth = '2xl',
  className,
  ariaLabel,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Background scroll lock
  useEffect(() => {
    if (!isOpen) return;
    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [isOpen]);

  // Escape key listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      data-testid="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={(e) => {
        // Clicking outside the modal content closes the modal
        if (e.target === overlayRef.current) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-950/75 backdrop-blur-[8px] animate-fade-in overflow-y-auto"
    >
      <div
        data-testid="modal-content"
        onClick={(e) => {
          // Clicking inside the modal must NOT close it
          e.stopPropagation();
        }}
        className={twMerge(
          clsx(
            'relative w-full bg-forest-900 border border-surface-border rounded-2xl shadow-2xl overflow-hidden my-auto text-surface-text',
            maxWidthMap[maxWidth],
            className
          )
        )}
      >
        {children}
      </div>
    </div>
  );
};

