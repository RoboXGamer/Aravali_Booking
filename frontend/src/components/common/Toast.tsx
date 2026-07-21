import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { motion } from 'framer-motion';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error';
  text: string;
}

export const Toast: React.FC<{ message: ToastMessage, onClose: () => void }> = ({ message, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl border shadow-2xl ${
        message.type === 'success' 
          ? 'bg-slate-900 border-emerald-500/30 text-emerald-400' 
          : 'bg-slate-900 border-rose-500/30 text-rose-400'
      }`}
    >
      {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
      <span className="text-sm font-medium text-slate-200">{message.text}</span>
      <button onClick={onClose} className="hover:text-white transition ml-4">
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};
