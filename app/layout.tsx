import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ToastProvider, setGlobalToast, useToast } from '@/components/Toast';
import { ThemeProvider } from '@/context/ThemeContext';
import { useEffect } from 'react';

function ToastRegistrar() {
  const { showToast } = useToast();
  
  useEffect(() => {
    setGlobalToast(showToast);
  }, [showToast]);
  
  return null;
}

export const metadata: Metadata = {
  title: 'WMS Pro',
  description: 'Warehouse Management System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
        <ErrorBoundary>
          <ThemeProvider>
            <ToastProvider>
              <ToastRegistrar />
              <AuthProvider>
                {children}
              </AuthProvider>
            </ToastProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}