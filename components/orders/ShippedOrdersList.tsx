// components/orders/ShippedOrdersList.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, getDocs } from 'firebase/firestore';
import { format, isValid, startOfDay, endOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Package, Search, XCircle, Loader2, CalendarDays, Truck, Layers, ChevronDown } from 'lucide-react';
import { showToast } from '@/components/Toast';

interface ShippedOrder {
  id: string;
  orderNumber?: string;
  carrier: string;
  status: string;
  shippedAt: any; // Firestore Timestamp or string
  shippedBy: string;
  consolidationNumber?: string;
}

const TK_CARRIERS = [
  'Все',
  'CDEK',
  'DPD',
  'Деловые линии',
  'Почта России',
  'ПЭК',
  'Образцы',
  'OZON_FBS',
  'Ярмарка Мастеров',
  'Yandex Market',
  'WB_FBS',
  'AliExpress',
  'Бийск',
  'OZON_FBO',
  'WB_FBO',
];

export function ShippedOrdersList() {
  const [allOrders, setAllOrders] = useState<ShippedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedCarrier, setSelectedCarrier] = useState<string>('Все');

  useEffect(() => {
    fetchShippedOrders();
  }, []);

  const fetchShippedOrders = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'orders'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShippedOrder));
      const filteredData = data.filter(order => 
        order.status === 'Отправлен' && order.shippedAt
      );
      
      filteredData.sort((a, b) => {
        const timeA = a.shippedAt ? new Date(a.shippedAt.seconds ? a.shippedAt.seconds * 1000 : a.shippedAt).getTime() : 0;
        const timeB = b.shippedAt ? new Date(b.shippedAt.seconds ? b.shippedAt.seconds * 1000 : b.shippedAt).getTime() : 0;
        return timeB - timeA;
      });
      
      setAllOrders(filteredData);
    } catch (error) {
      console.error('Error fetching shipped orders:', error);
      showToast('Ошибка при загрузке отправленных заказов', 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = useMemo(() => {
    let filtered = allOrders;

    if (selectedCarrier !== 'Все') {
      filtered = filtered.filter(order => order.carrier === selectedCarrier);
    }

    if (selectedDate) {
        const filterDateStart = startOfDay(new Date(selectedDate));
        const filterDateEnd = endOfDay(new Date(selectedDate));

        filtered = filtered.filter(order => {
            if (!order.shippedAt) return false;
            const shippedDate = new Date(order.shippedAt.seconds ? order.shippedAt.seconds * 1000 : order.shippedAt);
            return isValid(shippedDate) && shippedDate >= filterDateStart && shippedDate <= filterDateEnd;
        });
    }

    if (searchQuery.trim()) {
      const queryLower = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(order =>
        order.orderNumber?.toLowerCase().includes(queryLower)
      );
    }

    return filtered;
  }, [allOrders, searchQuery, selectedDate, selectedCarrier]);

  const clearSearch = () => setSearchQuery('');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-500">Загрузка отправленных заказов...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-grow">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
            type="text"
            placeholder="Поиск по номеру заказа..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-10 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            {searchQuery && (
            <button onClick={clearSearch} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
            </button>
            )}
        </div>
        <div className="relative">
            <CalendarDays className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
                type="date"
                value={selectedDate || ''}
                onChange={(e) => setSelectedDate(e.target.value || null)}
                className="w-full pl-12 pr-10 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            {selectedDate && (
                <button onClick={() => setSelectedDate(null)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <XCircle className="w-5 h-5" />
                </button>
            )}
        </div>
        <div className="relative min-w-[200px]">
            <Truck className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <select
                value={selectedCarrier}
                onChange={(e) => setSelectedCarrier(e.target.value)}
                className="w-full pl-12 pr-10 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none appearance-none cursor-pointer"
            >
                {TK_CARRIERS.map(carrier => (
                    <option key={carrier} value={carrier}>{carrier}</option>
                ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Package className="w-4 h-4" />
          <span>Отправлено: <b className="text-slate-900 dark:text-white">{filteredOrders.length}</b></span>
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <Package className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 dark:text-slate-500">{ selectedDate ? 'Нет отправленных заказов за эту дату' : 'Нет отправленных заказов'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map(order => {
            const shippedAtDate = order.shippedAt ? new Date(order.shippedAt.seconds ? order.shippedAt.seconds * 1000 : order.shippedAt) : null;
            return (
              <div
                key={order.id}
                className={`p-4 rounded-2xl border shadow-sm transition-all bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800`}
              >
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                        Заказ №{order.orderNumber || 'Без номера'}
                      </h3>
                      <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                        Отправлен
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                            <CalendarDays className="w-4 h-4 text-slate-400" />
                            <div>
                                <p className="text-slate-500 dark:text-slate-400 text-xs">Дата отправки</p>
                                <p className="font-medium text-slate-700 dark:text-slate-300">
                                    {shippedAtDate && isValid(shippedAtDate)
                                    ? format(shippedAtDate, 'dd.MM.yyyy HH:mm', { locale: ru })
                                    : '—'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Truck className="w-4 h-4 text-slate-400" />
                            <div>
                                <p className="text-slate-500 dark:text-slate-400 text-xs">Транспортная компания</p>
                                <p className="font-medium text-slate-700 dark:text-slate-300">
                                    {order.carrier || '—'}
                                </p>
                            </div>
                        </div>
                        {order.consolidationNumber && (
                            <div className="flex items-center gap-2">
                                <Layers className="w-4 h-4 text-slate-400" />
                                <div>
                                    <p className="text-slate-500 dark:text-slate-400 text-xs">Номер консолидации</p>
                                    <p className="font-medium text-slate-700 dark:text-slate-300">
                                        {order.consolidationNumber}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          )}
        </div>
      )}
    </div>
  );
}
