import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}) => {
  const baseStyle = "inline-flex items-center justify-center rounded-lg font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand/70 focus:ring-offset-2 focus:ring-offset-background disabled:pointer-events-none disabled:opacity-50";
  
  const variants = {
    primary: "bg-[linear-gradient(110deg,rgb(var(--booking-accent-start)),rgb(var(--booking-accent-end)))] text-white font-bold shadow-[0_9px_28px_rgb(var(--booking-selected-start)/0.3)] hover:brightness-110 active:brightness-95",
    secondary: "border border-[rgb(var(--booking-border)/0.15)] bg-[rgb(var(--booking-surface))] text-slate-100 hover:border-[rgb(var(--booking-selected-end)/0.5)] hover:brightness-110",
    danger: "bg-rose-500 hover:bg-rose-600 text-white focus:ring-rose-400",
    ghost: "bg-transparent text-slate-300 hover:bg-[rgb(var(--booking-surface)/0.8)] hover:text-white"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-5 py-2.5 text-sm",
    lg: "px-7 py-3.5 text-base"
  };

  return (
    <button
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
