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
  const baseStyles = 'neu-btn';

  const variants = {
    default: '',
    primary: 'neu-btn-primary',
    outline: 'border border-neu-border bg-transparent',
  };

  const sizes = {
    default: 'px-5 py-2.5',
    sm: 'text-sm px-3 py-1.5',
    lg: 'text-lg px-8 py-3',
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
