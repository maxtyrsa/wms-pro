'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, updateDoc, doc } from 'firebase/firestore';
import { format, differenceInDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Package, Search, XCircle, CheckCircle2, Loader2, AlertTriangle, Clock, User, Calendar } from 'lucide-react';
import { showToast } from '@/components/Toast';

interface PickupOrder {
  id: string;
  orderNumber?: string;
  carrier: string;
  status: string;
  createdAt: string;
  createdBy: string;
  time_end?: string;
}

interface PickupOrdersListProps {
  isAdmin?: boolean;
}

export function PickupOrdersList({ isAdmin = false }: PickupOrdersListProps) {
  const [orders, setOrders] = useState<PickupOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  useEffect(() => {
    fetchPickupOrders();
  }, []);

  const fetchPickupOrders = async () => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'orders'),
        where('carrier', '==', 'Самовывоз'),
        where('status', '==', 'Готов к выдаче'),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PickupOrder));
      setOrders(data);
    } catch (error) {
      console.error('Error fetching pickup orders:', error);
      showToast('Ошибка при загрузке заказов', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteOrder = async (orderId: string) => {
    if (!confirm('Вы уверены, что хотите завершить этот заказ?')) return;
    
    setUpdatingOrderId(orderId);
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        status: 'Завершен',
        completedAt: new Date().toISOString()
      });
      showToast('Заказ завершен', 'success');
      fetchPickupOrders();
    } catch (error) {
      console.error('Error completing order:', error);
      showToast('Ошибка при завершении заказа', 'error');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const getStorageDays = (createdAt: string) => {
    const created = new Date(createdAt);
    const now = new Date();
    return differenceInDays(now, created);
  };

  const getStorageColor = (days: number) => {
    if (days > 30) return 'bg-red-100 border-red-300 text-red-800';
    if (days > 14) return 'bg-orange-100 border-orange-300 text-orange-800';
    return 'bg-white border-slate-200';
  };

  const getStorageBgColor = (days: number) => {
    if (days > 30) return 'bg-red-50';
    if (days > 14) return 'bg-orange-50';
    return '';
  };

  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return orders;
    const queryLower = searchQuery.trim().toLowerCase();
    return orders.filter(order => 
      order.orderNumber?.toLowerCase().includes(queryLower)
    );
  }, [orders, searchQuery]);

  const clearSearch = () => setSearchQuery('');

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Поиск */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          placeholder="Поиск по номеру заказа..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-10 py-3 rounded-2xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
        />
        {searchQuery && (
          <button onClick={clearSearch} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <XCircle className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Статистика */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Package className="w-4 h-4" />
          <span>Готово к выдаче: <b className="text-slate-900">{filteredOrders.length}</b></span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-orange-200 border border-orange-300"></div> &gt;14 дней</span>
          <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-200 border border-red-300"></div> &gt;30 дней</span>
        </div>
      </div>

      {/* Список заказов */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400">Нет заказов, готовых к выдаче</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map(order => {
            const storageDays = getStorageDays(order.createdAt);
            const storageColor = getStorageColor(storageDays);
            const bgColor = getStorageBgColor(storageDays);
            
            return (
              <div
                key={order.id}
                className={`p-4 rounded-2xl border shadow-sm transition-all ${storageColor} ${bgColor}`}
              >
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <h3 className="font-bold text-lg text-slate-900">
                        Заказ №{order.orderNumber || 'Без номера'}
                      </h3>
                      <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        Готов к выдаче
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <div>
                          <p className="text-slate-500 text-xs">Сборщик</p>
                          <p className="font-medium text-slate-700">{order.createdBy?.split('@')[0] || '—'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <div>
                          <p className="text-slate-500 text-xs">Дата создания</p>
                          <p className="font-medium text-slate-700">
                            {format(new Date(order.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <div>
                          <p className="text-slate-500 text-xs">Время хранения</p>
                          <p className={`font-bold ${storageDays > 30 ? 'text-red-600' : storageDays > 14 ? 'text-orange-600' : 'text-slate-700'}`}>
                            {storageDays} {getDaysWord(storageDays)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Кнопка завершения (только для администратора) */}
                  {isAdmin && (
                    <button
                      onClick={() => handleCompleteOrder(order.id)}
                      disabled={updatingOrderId === order.id}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap self-center"
                    >
                      {updatingOrderId === order.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      Завершить
                    </button>
                  )}
                </div>
                
                {/* Предупреждение о длительном хранении */}
                {storageDays > 14 && (
                  <div className={`mt-4 pt-3 border-t flex items-center gap-2 text-xs ${storageDays > 30 ? 'text-red-600' : 'text-orange-600'}`}>
                    <AlertTriangle className="w-4 h-4" />
                    <span>
                      {storageDays > 30 
                        ? `⚠️ Критически долгое хранение! Заказ ожидает выдачи более 30 дней.` 
                        : `⚠️ Заказ ожидает выдачи более 14 дней. Рекомендуется связаться с клиентом.`}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function getDaysWord(days: number): string {
  const lastDigit = days % 10;
  const lastTwoDigits = days % 100;
  
  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) return 'дней';
  if (lastDigit === 1) return 'день';
  if (lastDigit >= 2 && lastDigit <= 4) return 'дня';
  return 'дней';
}
