import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  className = '',
  id,
  ...props
}) => {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-bold">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`rounded-lg border bg-[rgb(var(--booking-control))] px-4 py-3 text-sm text-slate-100 placeholder-slate-500 transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-[rgb(var(--booking-selected-end))] ${error ? 'border-rose-500/80' : 'border-[rgb(var(--booking-control-border))] focus:border-[rgb(var(--booking-selected-end))]'} ${className}`}
        {...props}
      />
      {error && <span className="text-xs text-rose-500/90 font-medium mt-0.5">{error}</span>}
    </div>
  );
};
