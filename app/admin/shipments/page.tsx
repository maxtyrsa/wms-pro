// app/admin/shipments/page.tsx - полностью исправленная версия
'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Send, Shield, Package, Search, XCircle, Loader2, 
  Truck, Layers, Filter, CalendarDays, X, CheckSquare, Square,
  TrendingUp, BarChart3, CheckCircle2, RefreshCw
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { 
  collection, query, where, orderBy, getDocs,
  startAfter, limit, DocumentSnapshot
} from 'firebase/firestore';
import { format, startOfDay, endOfDay } from 'date-fns';
import { showToast } from '@/components/Toast';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { CreateConsolidationModal } from '@/components/consolidation/CreateConsolidationModal';
import { getCurrentMonthRange, formatDateRange } from '@/lib/dateUtils';

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

const PAGE_SIZE = 20;

export default function AdminShipmentsPage() {
  const router = useRouter();
  const { role, loading: authLoading, user } = useAuth();
  const currentMonth = getCurrentMonthRange();
  
  // Состояния для заказов
  const [orders, setOrders] = useState<Order[]>([]);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Фильтры
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCarrier, setSelectedCarrier] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState({ start: currentMonth.start, end: currentMonth.end });
  const [showDateFilter, setShowDateFilter] = useState(false);
  
  // Выделение заказов
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Ref для предотвращения двойной загрузки
  const isLoadingRef = useRef(false);
  const initialLoadRef = useRef(false);

  // Загрузка заказов
  const loadOrders = useCallback(async (loadMore = false) => {
    // Предотвращаем параллельные загрузки
    if (isLoadingRef.current) return;
    if (loadMore && !hasMore) return;
    
    isLoadingRef.current = true;
    
    if (loadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setError(null);
    }

    try {
      // Базовые ограничения
      const constraints = [
        where('status', '==', 'Оформлен'),
        where('carrier', '!=', 'Самовывоз'),
        orderBy('createdAt', 'desc')
      ];
      
      // Фильтр по ТК
      if (selectedCarrier !== 'all') {
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

  // Первоначальная загрузка
  useEffect(() => {
    if (!authLoading && role === 'admin') {
      loadOrders();
    }
  }, [authLoading, role, selectedCarrier]);

  // Фильтрация на клиенте (поиск и дата)
  const filteredOrders = React.useMemo(() => {
    let filtered = [...orders];
    
    if (searchQuery.trim()) {
      const queryLower = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(o => 
        o.orderNumber?.toLowerCase().includes(queryLower)
      );
    }
    
    if (dateFilter.start && dateFilter.end) {
      const start = startOfDay(new Date(dateFilter.start));
      const end = endOfDay(new Date(dateFilter.end));
      filtered = filtered.filter(o => {
        const d = new Date(o.createdAt);
        return d >= start && d <= end;
      });
    }
    
    return filtered;
  }, [orders, searchQuery, dateFilter]);

  // Статистика
  const stats = React.useMemo(() => {
    let totalWeight = 0, totalVolume = 0, totalProfit = 0;
    filteredOrders.forEach(o => {
      totalWeight += o.totalWeight || 0;
      totalVolume += o.totalVolume || 0;
      totalProfit += o.profit || 0;
    });
    return { totalOrders: filteredOrders.length, totalWeight, totalVolume, totalProfit };
  }, [filteredOrders]);

  // Получение уникальных ТК
  const carriers = React.useMemo(() => {
    const unique = new Set(orders.map(o => o.carrier));
    return ['all', ...Array.from(unique).sort()];
  }, [orders]);

  const toggleOrderSelection = (id: string) => {
    const newSelection = new Set(selectedOrders);
    if (newSelection.has(id)) newSelection.delete(id);
    else newSelection.add(id);
    setSelectedOrders(newSelection);
  };

  const toggleAllSelection = () => {
    if (selectedOrders.size === filteredOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filteredOrders.map(o => o.id)));
    }
  };

  const getSelectedOrdersData = () => {
    return filteredOrders
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
      }));
  };

  const clearSearch = () => setSearchQuery('');
  const resetDateFilter = () => setDateFilter(getCurrentMonthRange());
  const handleRefresh = () => {
    setOrders([]);
    setLastDoc(null);
    setHasMore(true);
    setSelectedOrders(new Set());
    loadOrders();
    showToast('Данные обновлены', 'info');
  };

  const loadMoreOrders = () => {
    if (hasMore && !loadingMore && !loading) {
      loadOrders(true);
    }
  };

  const handleConsolidationSuccess = () => {
    // Обновляем список заказов
    setOrders([]);
    setLastDoc(null);
    setHasMore(true);
    setSelectedOrders(new Set());
    loadOrders();
    setShowCreateModal(false);
    showToast('Консоль успешно создана', 'success');
  };

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

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (role !== 'admin') {
    router.push('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white border-b px-4 py-4 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full">
            <ArrowLeft className="w-6 h-6 text-slate-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Send className="w-5 h-5 text-blue-600" />
              Консолидация отправок
            </h1>
            <p className="text-sm text-slate-500">Выберите заказы для отправки в транспортную компанию</p>
          </div>
          <div className="bg-blue-50 px-3 py-1 rounded-lg text-xs font-semibold text-blue-600">
            <Shield className="w-3 h-3 inline" /> Администратор
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRefresh} disabled={loading} className="p-2 hover:bg-slate-100 rounded-full">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Статистика */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-2xl border">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-4">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-sm text-slate-500">Готовы к отправке</p>
            <p className="text-2xl font-black">{stats.totalOrders}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border">
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mb-4">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-sm text-slate-500">Общий вес</p>
            <p className="text-2xl font-black">{stats.totalWeight.toFixed(1)} кг</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border">
            <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center mb-4">
              <BarChart3 className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-sm text-slate-500">Общий объем</p>
            <p className="text-2xl font-black">{stats.totalVolume.toFixed(4)} м³</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border">
            <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center mb-4">
              <CheckCircle2 className="w-5 h-5 text-orange-600" />
            </div>
            <p className="text-sm text-slate-500">Общая прибыль</p>
            <p className="text-2xl font-black">{stats.totalProfit.toLocaleString()} ₽</p>
          </div>
        </div>

        {/* Фильтры */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Поиск по номеру заказа..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-10 py-3 rounded-2xl border bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
              />
              {searchQuery && (
                <button onClick={clearSearch} className="absolute right-4 top-1/2">
                  <XCircle className="w-5 h-5 text-slate-400" />
                </button>
              )}
            </div>

            <select
              value={selectedCarrier}
              onChange={(e) => setSelectedCarrier(e.target.value)}
              className="px-4 py-3 rounded-2xl border bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {carriers.map(c => (
                <option key={c} value={c}>{c === 'all' ? 'Все ТК' : c}</option>
              ))}
            </select>

            <div className="relative">
              <button
                onClick={() => setShowDateFilter(!showDateFilter)}
                className="w-full px-4 py-3 rounded-2xl border bg-slate-50 flex justify-between items-center"
              >
                <div className="flex gap-2">
                  <CalendarDays className="w-4 h-4 text-slate-400" />
                  <span>{formatDateRange(dateFilter.start, dateFilter.end)}</span>
                </div>
                <Filter className="w-4 h-4 text-slate-400" />
              </button>
              {showDateFilter && (
                <div className="absolute top-full left-0 mt-2 z-10 bg-white rounded-2xl shadow-xl border p-4 w-full">
                  <div className="space-y-3">
                    <input type="date" value={dateFilter.start} onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })} className="w-full p-2 border rounded-xl" />
                    <input type="date" value={dateFilter.end} onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })} className="w-full p-2 border rounded-xl" />
                    <button onClick={() => { setDateFilter(getCurrentMonthRange()); setShowDateFilter(false); }} className="w-full py-2 text-sm bg-blue-50 text-blue-600 rounded-xl">Текущий месяц</button>
                    <div className="flex gap-2">
                      <button onClick={resetDateFilter} className="flex-1 p-2 border rounded-xl">Сброс</button>
                      <button onClick={() => setShowDateFilter(false)} className="flex-1 p-2 bg-blue-600 text-white rounded-xl">Применить</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div></div>
          </div>
        </div>

        {/* Ошибка */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-700">Ошибка: {error}</p>
            <button onClick={() => loadOrders()} className="mt-2 px-4 py-2 bg-red-100 rounded-lg text-sm">Повторить</button>
          </div>
        )}

        {/* Панель выбора */}
        {!loading && filteredOrders.length > 0 && (
          <div className="bg-white p-4 rounded-2xl border flex justify-between items-center">
            <div className="flex gap-4">
              <button onClick={toggleAllSelection} className="flex items-center gap-2 text-sm">
                {selectedOrders.size === filteredOrders.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                Выбрать все
              </button>
              <span className="text-sm">Выбрано: <b>{selectedOrders.size}</b></span>
            </div>
            {selectedOrders.size > 0 && (
              <button onClick={() => setShowCreateModal(true)} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl flex items-center gap-2">
                <Layers className="w-4 h-4" /> Создать консоль ({selectedOrders.size})
              </button>
            )}
          </div>
        )}

        {/* Список заказов */}
        {loading && filteredOrders.length === 0 ? (
          <div className="flex justify-center py-12 bg-white rounded-2xl border">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-2">Загрузка заказов...</span>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p>Нет заказов, готовых к отправке</p>
            <p className="text-xs text-slate-400 mt-1">Убедитесь, что есть заказы со статусом "Оформлен" и ТК не "Самовывоз"</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {filteredOrders.map(order => (
                <div
                  key={order.id}
                  onClick={() => toggleOrderSelection(order.id)}
                  className={`p-4 rounded-2xl border cursor-pointer hover:shadow-md transition-all ${
                    selectedOrders.has(order.id) ? 'bg-blue-50 border-blue-200' : 'bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input type="checkbox" checked={selectedOrders.has(order.id)} onChange={() => {}} onClick={(e) => e.stopPropagation()} className="mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-bold">Заказ №{order.orderNumber || 'Без номера'}</h3>
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${getCarrierColor(order.carrier)}`}>{order.carrier}</span>
                        <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-100">Оформлен</span>
                      </div>
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div><p className="text-slate-500 text-xs">Сборщик</p><p>{order.createdBy?.split('@')[0] || '—'}</p></div>
                        <div><p className="text-slate-500 text-xs">Мест</p><p>{order.quantity || 1}</p></div>
                        <div><p className="text-slate-500 text-xs">Вес</p><p>{order.totalWeight?.toFixed(1) || 0} кг</p></div>
                        <div><p className="text-slate-500 text-xs">Прибыль</p><p className="font-bold text-emerald-600">{order.profit?.toLocaleString() || '—'} ₽</p></div>
                      </div>
                      <div className="mt-2 text-xs text-slate-400">📅 {format(new Date(order.createdAt), 'dd.MM.yyyy HH:mm')}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center pt-4">
                <button onClick={loadMoreOrders} disabled={loadingMore} className="px-6 py-3 bg-blue-600 text-white rounded-xl flex items-center gap-2 disabled:opacity-50">
                  {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                  {loadingMore ? 'Загрузка...' : 'Загрузить еще'}
                </button>
              </div>
            )}
          </>
        )}
      </main>

      <CreateConsolidationModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        selectedOrders={getSelectedOrdersData()}
        onSuccess={handleConsolidationSuccess}
        userEmail={user?.email || ''}
      />
    </div>
  );
}