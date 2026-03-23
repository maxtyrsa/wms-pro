'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, updateDoc, doc } from 'firebase/firestore';
import { format, differenceInDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Package, Search, XCircle, CheckCircle2, Loader2, AlertTriangle, Clock, User, Calendar, Handshake } from 'lucide-react';
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
      console.log('📦 Загрузка заказов Самовывоз со статусом "Готов к выдаче"...');
      
      // Упрощенный запрос - только по статусу
      const q = query(
        collection(db, 'orders'),
        where('status', '==', 'Готов к выдаче')
      );
      
      const snapshot = await getDocs(q);
      console.log(`✅ Найдено заказов: ${snapshot.docs.length}`);
      
      // Фильтруем "Самовывоз" на клиенте
      const allOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PickupOrder));
      const filteredData = allOrders.filter(order => order.carrier === 'Самовывоз');
      console.log(`✅ После фильтрации "Самовывоз": ${filteredData.length} заказов`);
      
      // Сортируем на клиенте по дате создания (новые сверху)
      filteredData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setOrders(filteredData);
    } catch (error) {
      console.error('Error fetching pickup orders:', error);
      showToast('Ошибка при загрузке заказов', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsIssued = async (orderId: string) => {
    if (!confirm('Подтвердите выдачу заказа клиенту?')) return;
    
    setUpdatingOrderId(orderId);
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        status: 'Выдан',
        issuedAt: new Date().toISOString(),
        issuedBy: isAdmin ? 'admin' : 'employee'
      });
      showToast('Заказ выдан клиенту', 'success');
      fetchPickupOrders();
    } catch (error) {
      console.error('Error marking order as issued:', error);
      showToast('Ошибка при выдаче заказа', 'error');
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
    if (days > 30) return 'bg-red-100 border-red-300 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300';
    if (days > 14) return 'bg-orange-100 border-orange-300 text-orange-800 dark:bg-orange-900/30 dark:border-orange-800 dark:text-orange-300';
    return 'bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800';
  };

  const getStorageBgColor = (days: number) => {
    if (days > 30) return 'bg-red-50 dark:bg-red-950/30';
    if (days > 14) return 'bg-orange-50 dark:bg-orange-950/30';
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
        <span className="ml-2 text-slate-500">Загрузка заказов...</span>
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
          className="w-full pl-12 pr-10 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
        />
        {searchQuery && (
          <button onClick={clearSearch} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <XCircle className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Статистика */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Package className="w-4 h-4" />
          <span>Готово к выдаче: <b className="text-slate-900 dark:text-white">{filteredOrders.length}</b></span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-orange-200 dark:bg-orange-800 border border-orange-300 dark:border-orange-700"></div> &gt;14 дней</span>
          <span className="flex items-center gap-1"><div className="w-3 h-3 rounded-full bg-red-200 dark:bg-red-800 border border-red-300 dark:border-red-700"></div> &gt;30 дней</span>
        </div>
      </div>

      {/* Список заказов */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <Package className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 dark:text-slate-500">Нет заказов, готовых к выдаче</p>
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
                      <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                        Заказ №{order.orderNumber || 'Без номера'}
                      </h3>
                      <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                        Готов к выдаче
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <div>
                          <p className="text-slate-500 dark:text-slate-400 text-xs">Сборщик</p>
                          <p className="font-medium text-slate-700 dark:text-slate-300">{order.createdBy?.split('@')[0] || '—'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <div>
                          <p className="text-slate-500 dark:text-slate-400 text-xs">Дата создания</p>
                          <p className="font-medium text-slate-700 dark:text-slate-300">
                            {format(new Date(order.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <div>
                          <p className="text-slate-500 dark:text-slate-400 text-xs">Время хранения</p>
                          <p className={`font-bold ${storageDays > 30 ? 'text-red-600 dark:text-red-400' : storageDays > 14 ? 'text-orange-600 dark:text-orange-400' : 'text-slate-700 dark:text-slate-300'}`}>
                            {storageDays} {getDaysWord(storageDays)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Кнопка выдачи (только для администратора) */}
                  {isAdmin && (
                    <button
                      onClick={() => handleMarkAsIssued(order.id)}
                      disabled={updatingOrderId === order.id}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2 whitespace-nowrap self-center"
                    >
                      {updatingOrderId === order.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Handshake className="w-4 h-4" />
                      )}
                      Выдать клиенту
                    </button>
                  )}
                </div>
                
                {/* Предупреждение о длительном хранении */}
                {storageDays > 14 && (
                  <div className={`mt-4 pt-3 border-t flex items-center gap-2 text-xs ${storageDays > 30 ? 'text-red-600 dark:text-red-400' : 'text-orange-600 dark:text-orange-400'}`}>
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