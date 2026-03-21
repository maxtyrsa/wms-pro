'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Truck, Shield } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { PickupOrdersList } from '@/components/orders/PickupOrdersList';

export default function AdminPickupOrdersPage() {
  const router = useRouter();
  const { role, loading } = useAuth();

  if (loading) return null;
  if (role !== 'admin') {
    router.push('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10 flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-slate-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Truck className="w-5 h-5 text-emerald-600" />
            Заказы Самовывоз
          </h1>
          <p className="text-sm text-slate-500">Управление выдачей заказов</p>
        </div>
        <div className="ml-auto bg-blue-50 px-3 py-1 rounded-lg text-xs font-semibold text-blue-600 flex items-center gap-1">
          <Shield className="w-3 h-3" />
          Администратор
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4">
        <PickupOrdersList isAdmin={true} />
      </main>
    </div>
  );
}
