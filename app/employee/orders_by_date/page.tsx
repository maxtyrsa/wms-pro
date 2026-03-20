'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Package, ChevronRight } from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { startOfDay, endOfDay, format } from 'date-fns';
import { ru } from 'date-fns/locale';
import Link from 'next/link';

export default function OrdersByDatePage() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const todayStart = startOfDay(new Date()).toISOString();
    const todayEnd = endOfDay(new Date()).toISOString();
    const q = query(
      collection(db, 'orders'),
      where('createdAt', '>=', todayStart),
      where('createdAt', '<=', todayEnd),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10 flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-slate-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Заказы за сегодня</h1>
          <p className="text-sm text-slate-500">{format(new Date(), 'd MMMM yyyy', { locale: ru })}</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Загрузка заказов...</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-slate-400">Заказов пока нет</div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/employee/order_details/${order.id}`}
                className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{order.orderNumber || 'Без номера'}</p>
                    <p className="text-xs text-slate-500">{order.carrier} · {order.quantity} мест</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                    ['Готов к выдаче', 'Оформлен'].includes(order.status) ? 'bg-emerald-100 text-emerald-800' :
                    ['Комплектация', 'В работе'].includes(order.status) ? 'bg-blue-100 text-blue-800' :
                    order.status === 'Новый' ? 'bg-purple-100 text-purple-800' :
                    order.status === 'Ожидает оформления' ? 'bg-amber-100 text-amber-800' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {order.status}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
