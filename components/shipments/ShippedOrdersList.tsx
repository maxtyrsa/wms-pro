// components/shipments/ShippedOrdersList.tsx - исправленная версия
'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { 
  Package, Search, XCircle, Layers, Loader2, CheckSquare, Square, 
  Truck, TrendingUp, BarChart3, CheckCircle2 
} from 'lucide-react';
import { collection, query, where, orderBy, getDocs, limit, startAfter, DocumentSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { CreateConsolidationModal } from '@/components/consolidation/CreateConsolidationModal';
import { showToast } from '@/components/Toast';
import { useAuth } from '@/context/AuthContext';

const PAGE_SIZE = 20;

interface Order {
  id: string;
  orderNumber?: string;
  carrier: string;
  status: string;
  createdAt: string;
  createdBy: string;
  totalWeight?: number;
  totalVolume?: number;
  profit?: number;
  quantity?: number;
  payment_sum?: number;
}

export function ShippedOrdersList() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCarrier, setSelectedCarrier] = useState<string>('Все');
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Состояния для пагинации
  const [orders, setOrders] = useState<Order[]>([]);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Ref для предотвращения двойной загрузки
  const initialLoadDone = useRef(false);
  const isLoadingRef = useRef(false);

  // Загрузка заказов
  const loadOrders = useCallback(async (loadMore = false) => {
    if (isLoadingRef.current) return;
    if (loadMore && !hasMore) return;
    
    isLoadingRef.current = true;
    
    if (loadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setOrders([]);
      setLastDoc(null);
      setHasMore(true);
      setError(null);
    }

    try {
      // Базовый запрос
      let constraints = [
        where('status', '==', 'Оформлен'),
        where('carrier', '!=', 'Самовывоз'),
        orderBy('createdAt', 'desc')
      ];
      
      // Фильтр по ТК
      if (selectedCarrier !== 'Все') {
        constraints.push(where('carrier', '==', selectedCarrier));
      }
      
      let q = query(collection(db, 'orders'), ...constraints, limit(PAGE_SIZE));
      
      if (loadMore && lastDoc) {
        q = query(q, startAfter(lastDoc));
      }
      
      const snapshot = await getDocs(q);
      const newOrders = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as Order));
      
      if (loadMore) {
        setOrders(prev => [...prev, ...newOrders]);
      } else {
        setOrders(newOrders);
      }
      
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
      
    } catch (err: any) {
      console.error('Error loading orders:', err);
      setError(err.message || 'Ошибка при загрузке заказов');
      showToast('Ошибка при загрузке заказов', 'error');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      isLoadingRef.current = false;
    }
  }, [selectedCarrier, lastDoc, hasMore]);

  // Загрузка при монтировании и изменении фильтра
  useEffect(() => {
    loadOrders();
  }, [selectedCarrier]); // Только при изменении ТК

  // Поиск и фильтрация по дате на клиенте
  const displayOrders = useMemo(() => {
    let filtered = [...orders];
    
    if (searchQuery.trim()) {
      const queryLower = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(order => 
        order.orderNumber?.toLowerCase().includes(queryLower)
      );
    }
    
    return filtered;
  }, [orders, searchQuery]);

  // Получение уникальных ТК
  const carriersOnPage = useMemo(() => {
    const uniqueCarriers = new Set(orders.map(o => o.carrier).filter(c => c && c !== 'Самовывоз'));
    return ['Все', ...Array.from(uniqueCarriers)];
  }, [orders]);

  // Статистика
  const stats = useMemo(() => {
    let totalWeight = 0, totalVolume = 0, totalProfit = 0;
    displayOrders.forEach(order => {
      totalWeight += order.totalWeight || 0;
      totalVolume += order.totalVolume || 0;
      totalProfit += order.profit || 0;
    });
    return {
      totalOrders: displayOrders.length,
      totalWeight,
      totalVolume,
      totalProfit
    };
  }, [displayOrders]);

  const toggleOrderSelection = (orderId: string) => {
    const newSelection = new Set(selectedOrders);
    if (newSelection.has(orderId)) {
      newSelection.delete(orderId);
    } else {
      newSelection.add(orderId);
    }
    setSelectedOrders(newSelection);
  };

  const toggleAllSelection = () => {
    if (selectedOrders.size === displayOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(displayOrders.map(o => o.id)));
    }
  };

  const handleConsolidationSuccess = useCallback(() => {
    loadOrders();
    setSelectedOrders(new Set());
    setShowCreateModal(false);
    showToast('Консоль успешно создана', 'success');
  }, [loadOrders]);

  const getCarrierColor = (carrier: string) => {
    const colors: Record<string, string> = {
      'CDEK': 'bg-blue-100 text-blue-800',
      'DPD': 'bg-orange-100 text-orange-800',
      'Деловые линии': 'bg-green-100 text-green-800',
      'Почта России': 'bg-red-100 text-red-800',
      'ПЭК': 'bg-purple-100 text-purple-800',
    };
    return colors[carrier] || 'bg-slate-100 text-slate-800';
  };

  const loadMoreOrders = () => {
    if (hasMore && !loadingMore && !loading) {
      loadOrders(true);
    }
  };

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
        <p className="text-red-700 font-medium">Ошибка: {error}</p>
        <button onClick={() => loadOrders()} className="mt-2 px-4 py-2 bg-red-100 rounded-lg text-sm">
          Повторить
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Статистика */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard title="Готовы к отправке" value={stats.totalOrders.toString()} icon={<Package className="w-5 h-5" />} color="blue" />
        <StatsCard title="Общий вес" value={`${stats.totalWeight.toFixed(1)} кг`} icon={<TrendingUp className="w-5 h-5" />} color="emerald" />
        <StatsCard title="Общий объем" value={`${stats.totalVolume.toFixed(4)} м³`} icon={<BarChart3 className="w-5 h-5" />} color="purple" />
        <StatsCard title="Общая прибыль" value={`${stats.totalProfit.toLocaleString()} ₽`} icon={<CheckCircle2 className="w-5 h-5" />} color="orange" />
      </div>

      {/* Фильтры */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2">
                <XCircle className="w-5 h-5 text-slate-400" />
              </button>
            )}
          </div>

          <select
            value={selectedCarrier}
            onChange={(e) => setSelectedCarrier(e.target.value)}
            className="px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {carriersOnPage.map(carrier => (
              <option key={carrier} value={carrier}>
                {carrier === 'Все' ? 'Все ТК' : carrier}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Панель выбора */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <button onClick={toggleAllSelection} className="flex items-center gap-2 text-sm text-slate-600 hover:text-blue-600">
            {selectedOrders.size === displayOrders.length && displayOrders.length > 0 ? (
              <CheckSquare className="w-4 h-4" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            {selectedOrders.size === displayOrders.length ? 'Снять все' : 'Выбрать все'}
          </button>
          <span className="text-sm text-slate-500">
            Выбрано: <b className="text-slate-900">{selectedOrders.size}</b> заказов
          </span>
        </div>

        {selectedOrders.size > 0 && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium flex items-center gap-2"
          >
            <Layers className="w-4 h-4" />
            Создать консоль ({selectedOrders.size})
          </button>
        )}
      </div>

      {/* Список заказов */}
      {loading && displayOrders.length === 0 ? (
        <div className="flex items-center justify-center py-12 bg-white rounded-2xl border">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-2 text-slate-500">Загрузка заказов...</span>
        </div>
      ) : displayOrders.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400 mb-2">
            {searchQuery || selectedCarrier !== 'Все'
              ? 'Заказы не найдены по выбранным фильтрам'
              : 'Нет заказов, готовых к отправке'}
          </p>
          <p className="text-xs text-slate-400">
            Убедитесь, что есть заказы со статусом &quot;Оформлен&quot; и ТК не &quot;Самовывоз&quot;
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {displayOrders.map(order => (
              <div
                key={order.id}
                onClick={() => toggleOrderSelection(order.id)}
                className={`p-4 rounded-2xl border shadow-sm transition-all cursor-pointer hover:shadow-md ${
                  selectedOrders.has(order.id)
                    ? 'bg-blue-50 border-blue-200'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedOrders.has(order.id)}
                    onChange={() => {}}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 w-4 h-4 rounded"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <h3 className="font-bold text-lg">
                        Заказ №{order.orderNumber || 'Без номера'}
                      </h3>
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${getCarrierColor(order.carrier)}`}>
                        {order.carrier}
                      </span>
                      <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-800">
                        Оформлен
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500 text-xs">Сборщик</p>
                        <p className="font-medium">{order.createdBy?.split('@')[0] || '—'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs">Мест</p>
                        <p className="font-medium">{order.quantity || 1}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs">Вес</p>
                        <p className="font-medium">{order.totalWeight?.toFixed(1) || 0} кг</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs">Прибыль</p>
                        <p className="font-bold text-emerald-600">
                          {order.profit ? `${order.profit.toLocaleString()} ₽` : '—'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-2 text-xs text-slate-400">
                      📅 {format(new Date(order.createdAt), 'dd.MM.yyyy HH:mm')}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Кнопка загрузки еще */}
          {hasMore && displayOrders.length > 0 && (
            <div className="flex justify-center pt-4">
              <button
                onClick={loadMoreOrders}
                disabled={loadingMore}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Загрузка...
                  </>
                ) : (
                  <>
                    <Truck className="w-4 h-4" />
                    Загрузить еще заказы
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}

      {/* Модальное окно */}
      <CreateConsolidationModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        selectedOrders={displayOrders
          .filter(o => selectedOrders.has(o.id))
          .map(o => ({
            id: o.id,
            orderNumber: o.orderNumber || 'Без номера',
            carrier: o.carrier,
            quantity: o.quantity || 1,
            totalWeight: o.totalWeight || 0,
            totalVolume: o.totalVolume || 0,
            createdBy: o.createdBy,
            payment_sum: o.payment_sum || 0,
            profit: o.profit || 0
          }))}
        onSuccess={handleConsolidationSuccess}
        userEmail={user?.email || ''}
      />
    </div>
  );
}

function StatsCard({ title, value, icon, color }: any) {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border">
      <div className={`w-12 h-12 ${colors[color]} rounded-xl flex items-center justify-center mb-4`}>
        {icon}
      </div>
      <p className="text-sm text-slate-500 font-medium">{title}</p>
      <p className="text-2xl font-black text-slate-900 mt-1">{value}</p>
    </div>
  );
}