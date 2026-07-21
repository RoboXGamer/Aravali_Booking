import React from 'react';

export const Spinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizes = {
    sm: "w-5 h-5",
    md: "w-10 h-10",
    lg: "w-16 h-16"
  };
  return (
    <div className="flex items-center justify-center">
      <div className={`${sizes[size]} border-4 border-slate-800 border-t-brand rounded-full animate-spin`} />
    </div>
  );
};
