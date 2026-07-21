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
  const baseStyle = "inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand disabled:opacity-50 disabled:pointer-events-none";
  
  const variants = {
    primary: "bg-gold-gradient text-slate-950 font-bold focus:ring-offset-slate-900 shadow-md hover:shadow-brand/20",
    secondary: "bg-slate-800 text-slate-100 hover:bg-slate-700 focus:ring-slate-500",
    danger: "bg-rose-500 hover:bg-rose-600 text-white focus:ring-rose-400",
    ghost: "bg-transparent hover:bg-slate-800/80 text-slate-300"
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
