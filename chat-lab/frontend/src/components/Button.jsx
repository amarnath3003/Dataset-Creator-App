import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function Button({
  className,
  variant = 'default',
  size = 'default',
  children,
  ...props
}) {
  const baseStyles =
    'neu-btn inline-flex items-center justify-center font-bold uppercase tracking-[0.18em] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    default: '',
    primary:
      'neu-btn-primary bg-neu-base text-neu-accent border border-white/5 shadow-[6px_6px_14px_#111315,-6px_-6px_14px_#2e343b] hover:shadow-[8px_8px_18px_#111315,-8px_-8px_18px_#2e343b,0_0_14px_rgba(255,107,0,0.16)] active:bg-neu-dark active:shadow-[inset_4px_4px_10px_#0e1012,inset_-4px_-4px_10px_#272d33] active:border-black/40 active:scale-[0.98]',
    outline:
      'bg-neu-base text-neu-text border border-white/5 shadow-[6px_6px_14px_#111315,-6px_-6px_14px_#2e343b] hover:text-neu-accent hover:shadow-[8px_8px_18px_#111315,-8px_-8px_18px_#2e343b] active:bg-neu-dark active:shadow-[inset_4px_4px_10px_#0e1012,inset_-4px_-4px_10px_#272d33] active:border-black/40 active:scale-[0.98]',
  };

  const sizes = {
    default: 'min-h-[44px] px-5 py-2.5 rounded-[16px] text-[11px]',
    sm: 'text-sm px-3 py-1.5',
    lg: 'min-h-[56px] px-8 py-3 rounded-[18px] text-sm',
  };

  return (
    <button
      className={twMerge(
        clsx(
          size === 'sm' ? 'neu-btn-sm' : baseStyles,
          variants[variant],
          size !== 'sm' && sizes[size],
          className
        )
      )}
      {...props}
    >
      {children}
    </button>
  );
}
