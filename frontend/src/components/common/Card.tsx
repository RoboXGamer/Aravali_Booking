import React from 'react';

export const Card: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = '' }) => {
  return (
    <div className={`bg-cinema-card rounded-2xl p-6 shadow-xl relative overflow-hidden transition-all duration-300 ${className}`}>
      {children}
    </div>
  );
};
