'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Package, ChevronRight, Loader2 } from 'lucide-react';
import { collection, query, where, orderBy, getDocs, limit, startAfter, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { startOfDay, endOfDay, format } from 'date-fns';
import { ru } from 'date-fns/locale';
import Link from 'next/link';
import { showToast } from '@/components/Toast';

const PAGE_SIZE = 20;

export default function OrdersByDatePage() {
  const router = useRouter();
  
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [totalLoaded, setTotalLoaded] = useState(0);

  const loadOrders = useCallback(async (loadMore = false) => {
    if (loadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setOrders([]);
      setLastDoc(null);
      setHasMore(true);
      setTotalLoaded(0);
    }

    try {
      // Получаем начало и конец сегодняшнего дня в ISO строке
      const todayStart = startOfDay(new Date()).toISOString();
      const todayEnd = endOfDay(new Date()).toISOString();
      
      console.log('Loading orders from:', todayStart, 'to:', todayEnd);
      
      let q = query(
        collection(db, 'orders'),
        where('createdAt', '>=', todayStart),
        where('createdAt', '<=', todayEnd),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE)
      );
      
      if (loadMore && lastDoc) {
        q = query(q, startAfter(lastDoc));
      }
      
      const snapshot = await getDocs(q);
      console.log('Found orders:', snapshot.docs.length);
      
      const newOrders = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          createdAtFormatted: data.createdAt ? format(new Date(data.createdAt), 'HH:mm') : '-'
        };
      });
      
      if (loadMore) {
        setOrders(prev => [...prev, ...newOrders]);
        setTotalLoaded(prev => prev + newOrders.length);
      } else {
        setOrders(newOrders);
        setTotalLoaded(newOrders.length);
      }
      
      if (snapshot.docs.length > 0) {
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      }
      setHasMore(snapshot.docs.length === PAGE_SIZE);
    } catch (error) {
      console.error('Error loading orders:', error);
      showToast('Ошибка при загрузке заказов', 'error');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [lastDoc]);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadMoreOrders = () => loadOrders(true);

  const getStatusColor = (status: string) => {
    if (!status) return 'bg-slate-100 text-slate-600';
    switch (status) {
      case 'Новый': return 'bg-purple-100 text-purple-800';
      case 'Комплектация': return 'bg-blue-100 text-blue-800';
      case 'В работе': return 'bg-blue-100 text-blue-800';
      case 'Ожидает оформления': return 'bg-amber-100 text-amber-800';
      case 'Готов к выдаче': return 'bg-emerald-100 text-emerald-800';
      case 'Оформлен': return 'bg-emerald-100 text-emerald-800';
      case 'Завершен': return 'bg-slate-200 text-slate-800';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  const getStatusText = (status: string) => {
    if (!status) return '—';
    switch (status) {
      case 'Готов к выдаче': return 'Готов';
      case 'Ожидает оформления': return 'Ожидает';
      default: return status;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10 flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-slate-600" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Заказы за сегодня</h1>
          <p className="text-sm text-slate-500">
            {format(new Date(), 'd MMMM yyyy', { locale: ru })}
            {totalLoaded > 0 && <span className="ml-2 text-blue-500">• {totalLoaded} заказов</span>}
          </p>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4">
        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
            <p className="text-slate-400 mt-2">Загрузка заказов...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400">Заказов за сегодня пока нет</p>
            <Link 
              href="/employee/add_order"
              className="inline-block mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Создать заказ
            </Link>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
              {orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/employee/order_details/${order.id}`}
                  className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors group"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 shrink-0">
                      <Package className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-slate-900 truncate">
                          {order.orderNumber || 'Без номера'}
                        </p>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0 ${getStatusColor(order.status)}`}>
                          {getStatusText(order.status)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {order.carrier || '—'} • {order.quantity || 0} мест
                        {order.createdAtFormatted && ` • ${order.createdAtFormatted}`}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-400 transition-colors shrink-0 ml-2" />
                </Link>
              ))}
            </div>
            
            {hasMore && orders.length >= PAGE_SIZE && (
              <div className="mt-6 text-center">
                <button
                  onClick={loadMoreOrders}
                  disabled={loadingMore}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2 mx-auto"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Загрузка...
                    </>
                  ) : (
                    'Загрузить еще заказы'
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}