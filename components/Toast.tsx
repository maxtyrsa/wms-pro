'use client';

import React, { useEffect, createContext, useContext, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, Info, AlertCircle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  message: string;
  type: ToastType;
  onClose: () => void;
  duration?: number;
}

const icons = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertCircle,
};

const colors = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
};

const iconColors = {
  success: 'text-emerald-500',
  error: 'text-red-500',
  info: 'text-blue-500',
  warning: 'text-amber-500',
};

function Toast({ message, type, onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const Icon = icons[type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg ${colors[type]}`}
    >
      <Icon className={`w-5 h-5 ${iconColors[type]}`} />
      <p className="text-sm font-medium">{message}</p>
      <button
        onClick={onClose}
        className="ml-2 hover:opacity-70 transition-opacity"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

interface ToastContextType {
  showToast: (message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: ToastType }>>([]);

  const showToast = (message: string, type: ToastType) => {
    console.log('[Toast]', type, message);
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        <AnimatePresence>
          {toasts.map(toast => (
            <Toast
              key={toast.id}
              message={toast.message}
              type={toast.type}
              onClose={() => removeToast(toast.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    console.warn('useToast called outside ToastProvider');
    // Возвращаем fallback функцию
    return {
      showToast: (message: string, type: ToastType) => {
        console.log(`[Toast Fallback] ${type}: ${message}`);
        alert(message);
      }
    };
  }
  return context;
}

// Экспортируем showToast как отдельную функцию для использования без хука
let globalShowToastFn: ((message: string, type: ToastType) => void) | null = null;

export function setGlobalToast(fn: (message: string, type: ToastType) => void) {
  globalShowToastFn = fn;
}

export function showToast(message: string, type: ToastType) {
  if (globalShowToastFn) {
    globalShowToastFn(message, type);
  } else {
    console.log(`[Toast] ${type}: ${message}`);
    alert(message);
  }
}