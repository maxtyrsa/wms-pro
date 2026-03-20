'use client';

import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastProvider, setGlobalToast, useToast } from '@/components/Toast';
import { useEffect } from 'react';

// Компонент для регистрации глобального тоста
function ToastRegistrar() {
  const { showToast } = useToast();
  
  useEffect(() => {
    setGlobalToast(showToast);
  }, [showToast]);
  
  return null;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body suppressHydrationWarning>
        <ErrorBoundary>
          <ToastProvider>
            <ToastRegistrar />
            <AuthProvider>
              {children}
            </AuthProvider>
          </ToastProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}