import React from 'react';

export const Card: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = '' }) => {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-[rgb(var(--booking-border)/0.13)] bg-[linear-gradient(145deg,rgb(var(--booking-surface)/0.82),rgb(var(--booking-surface-deep)/0.9))] p-6 shadow-[0_24px_70px_rgb(0_0_0/0.28)] transition-all duration-300 ${className}`}>
      {children}
    </div>
  );
};
