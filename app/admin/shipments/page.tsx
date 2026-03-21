'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Send, Shield } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { ShippedOrdersList } from '@/components/shipments/ShippedOrdersList';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

export default function AdminShipmentsPage() {
  const router = useRouter();
  const { role, loading } = useAuth();

  if (loading) return null;
  if (role !== 'admin') {
    router.push('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 transition-colors duration-200">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-4 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-400" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Send className="w-5 h-5 text-blue-600" />
              Консолидация отправок
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Выберите заказы для отправки в транспортную компанию
            </p>
          </div>
          <div className="ml-4 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
            <Shield className="w-3 h-3" />
            Администратор
          </div>
        </div>
        <ThemeToggle />
      </header>

      <main className="max-w-6xl mx-auto p-4">
        <ShippedOrdersList />
      </main>
    </div>
  );
}