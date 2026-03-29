// app/employee/pickup_orders/page.tsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Truck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PickupOrdersList } from '@/components/orders/PickupOrdersList';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

export default function EmployeePickupOrdersPage() {
  const router = useRouter();
  const { role, loading } = useAuth();

  if (loading) return null;
  if (role !== 'employee') {
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
              <Truck className="w-5 h-5 text-emerald-600" />
              Заказы Самовывоз
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Заказы, готовые к выдаче</p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <main className="max-w-3xl mx-auto p-4">
        {/* isAdmin={false} - но кнопка выдачи будет доступна */}
        <PickupOrdersList isAdmin={false} />
      </main>
    </div>
  );
}