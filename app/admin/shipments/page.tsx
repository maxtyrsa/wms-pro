// app/admin/shipments/page.tsx (обновлённая версия с оптимизированными запросами)

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  startAfter, limit, DocumentSnapshot, QueryConstraint
} from 'firebase/firestore';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { showToast } from '@/components/Toast';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { CreateConsolidationModal } from '@/components/consolidation/CreateConsolidationModal';

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
  const { role, loading: authLoading } = useAuth();
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCarrier, setSelectedCarrier] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<{ start: string; end: string }>({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  });
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Получение списка ТК из загруженных заказов
  const carriers = useMemo(() => {
    const unique = new Set(orders.map(order => order.carrier));
    return ['all', ...Array.from(unique).sort()];
  }, [orders]);

  // ОПТИМИЗИРОВАННЫЙ ЗАПРОС: убираем where('carrier', '!=', 'Самовывоз')
  // и фильтруем на клиенте, так как это неравенство + другие where требуют сложного индекса
  const loadOrders = useCallback(async (loadMore = false) => {
    if (loadMore && !hasMore) return;
    
    if (loadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setOrders([]);
      setLastDoc(null);
      setHasMore(true);
      setSelectedOrders(new Set());
    }

    try {
      // Базовый запрос: только статус = "Оформлен", сортировка по дате
      const constraints: QueryConstraint[] = [
        where('status', '==', 'Оформлен'),
        orderBy('createdAt', 'desc')
      ];
      
      let q = query(
        collection(db, 'orders'),
        ...constraints,
        limit(PAGE_SIZE)
      );
      
      if (loadMore && lastDoc) {
        q = query(q, startAfter(lastDoc));
      }
      
      const snapshot = await getDocs(q);
      let newOrders = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          orderNumber: data.orderNumber,
          carrier: data.carrier,
          status: data.status,
          createdAt: data.createdAt,
          createdBy: data.createdBy,
          totalWeight: data.totalWeight,
          totalVolume: data.totalVolume,
          profit: data.profit,
          quantity: data.quantity || 1,
          payment_sum: data.payment_sum || 0
        } as Order;
      });
      
      // Фильтруем "Самовывоз" на клиенте
      newOrders = newOrders.filter(order => order.carrier !== 'Самовывоз');
      
      // Фильтр по ТК на клиенте
      if (selectedCarrier !== 'all') {
        newOrders = newOrders.filter(order => order.carrier === selectedCarrier);
      }
      
      if (loadMore) {
        setOrders(prev => [...prev, ...newOrders]);
      } else {
        setOrders(newOrders);
      }
      
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
      
    } catch (error) {
      console.error('Error loading orders:', error);
      showToast('Ошибка при загрузке заказов', 'error');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [selectedCarrier, lastDoc, hasMore]);

  // Фильтрация по дате и поиску на клиенте
  const filteredOrders = useMemo(() => {
    let filtered = [...orders];
    
    if (searchQuery.trim()) {
      const queryLower = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(order => 
        order.orderNumber?.toLowerCase().includes(queryLower)
      );
    }

    if (dateFilter.start && dateFilter.end) {
      const start = startOfDay(new Date(dateFilter.start));
      const end = endOfDay(new Date(dateFilter.end));
      filtered = filtered.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= start && orderDate <= end;
      });
    }
    
    return filtered;
  }, [orders, searchQuery, dateFilter]);

  const stats = useMemo(() => {
    const carriersCount: Record<string, number> = {};
    let totalWeight = 0, totalVolume = 0, totalProfit = 0;

    filteredOrders.forEach(order => {
      carriersCount[order.carrier] = (carriersCount[order.carrier] || 0) + 1;
      totalWeight += order.totalWeight || 0;
      totalVolume += order.totalVolume || 0;
      totalProfit += order.profit || 0;
    });

    return {
      totalOrders: filteredOrders.length,
      totalWeight,
      totalVolume,
      totalProfit,
      carriers: carriersCount
    };
  }, [filteredOrders]);

  useEffect(() => {
    loadOrders();
  }, [selectedCarrier, loadOrders]);

  const toggleOrderSelection = (orderId: string) => {
    const newSelection = new Set(selectedOrders);
    if (newSelection.has(orderId)) newSelection.delete(orderId);
    else newSelection.add(orderId);
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
  const resetDateFilter = () => {
    setDateFilter({
      start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    });
  };

  const handleRefresh = () => {
    loadOrders();
    showToast('Данные обновлены', 'info');
  };

  const loadMoreOrders = () => {
    if (hasMore && !loadingMore) loadOrders(true);
  };

  const getCarrierColor = (carrier: string) => {
    const colors: Record<string, string> = {
      'CDEK': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      'DPD': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
      'Деловые линии': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      'Почта России': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      'ПЭК': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    };
    return colors[carrier] || 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (role !== 'admin') {
    router.push('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-4 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
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
        <div className="flex items-center gap-2">
          <button onClick={handleRefresh} disabled={loading} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
            <RefreshCw className={`w-5 h-5 text-slate-600 dark:text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 space-y-6">
        {/* Статистика */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard title="Готовы к отправке" value={stats.totalOrders.toString()} icon={<Package className="w-5 h-5" />} color="blue" />
          <StatsCard title="Общий вес" value={`${stats.totalWeight.toFixed(1)} кг`} icon={<TrendingUp className="w-5 h-5" />} color="emerald" />
          <StatsCard title="Общий объем" value={`${stats.totalVolume.toFixed(4)} м³`} icon={<BarChart3 className="w-5 h-5" />} color="purple" />
          <StatsCard title="Общая прибыль" value={`${stats.totalProfit.toLocaleString()} ₽`} icon={<CheckCircle2 className="w-5 h-5" />} color="orange" />
        </div>

        {/* Фильтры */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

            <select
              value={selectedCarrier}
              onChange={(e) => setSelectedCarrier(e.target.value)}
              className="px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {carriers.map(carrier => (
                <option key={carrier} value={carrier}>
                  {carrier === 'all' ? 'Все ТК' : carrier}
                </option>
              ))}
            </select>

            <div className="relative">
              <button
                onClick={() => setShowDateFilter(!showDateFilter)}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-slate-400" />
                  <span className="text-sm">
                    {dateFilter.start === dateFilter.end 
                      ? format(new Date(dateFilter.start), 'dd.MM.yyyy')
                      : `${format(new Date(dateFilter.start), 'dd.MM')} - ${format(new Date(dateFilter.end), 'dd.MM')}`}
                  </span>
                </div>
                <Filter className="w-4 h-4 text-slate-400" />
              </button>
              {showDateFilter && (
                <div className="absolute top-full left-0 mt-2 z-10 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border p-4 w-full">
                  <div className="space-y-3">
                    <input type="date" value={dateFilter.start} onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })} className="w-full px-3 py-2 rounded-xl border" />
                    <input type="date" value={dateFilter.end} onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })} className="w-full px-3 py-2 rounded-xl border" />
                    <div className="flex gap-2">
                      <button onClick={resetDateFilter} className="flex-1 px-3 py-2 text-sm border rounded-xl">Сбросить</button>
                      <button onClick={() => setShowDateFilter(false)} className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-xl">Применить</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div></div>
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>📅 Фильтр: {format(new Date(dateFilter.start), 'dd.MM.yyyy')} — {format(new Date(dateFilter.end), 'dd.MM.yyyy')}</span>
            <span>{loading ? <Loader2 className="w-3 h-3 animate-spin inline" /> : `Загружено: ${orders.length} заказов`}{hasMore && orders.length > 0 && ' • есть еще'}</span>
          </div>
        </div>

        {loading && orders.length === 0 ? (
          <div className="flex justify-center py-12 bg-white dark:bg-slate-900 rounded-2xl">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl">
            <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400">Нет заказов, готовых к отправке</p>
          </div>
        ) : (
          <>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <button onClick={toggleAllSelection} className="flex items-center gap-2 text-sm">
                  {selectedOrders.size === filteredOrders.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  {selectedOrders.size === filteredOrders.length ? 'Снять все' : 'Выбрать все'}
                </button>
                <span>Выбрано: <b>{selectedOrders.size}</b> заказов</span>
              </div>
              {selectedOrders.size > 0 && (
                <button onClick={() => setShowCreateModal(true)} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  Создать консоль ({selectedOrders.size})
                </button>
              )}
            </div>

            <div className="space-y-3">
              {filteredOrders.map(order => (
                <div key={order.id} onClick={() => toggleOrderSelection(order.id)} className={`p-4 rounded-2xl border cursor-pointer hover:shadow-md ${selectedOrders.has(order.id) ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200' : 'bg-white dark:bg-slate-900 border-slate-200'}`}>
                  <div className="flex items-start gap-3">
                    <input type="checkbox" checked={selectedOrders.has(order.id)} onChange={() => {}} onClick={(e) => e.stopPropagation()} className="mt-1 w-4 h-4" />
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <h3 className="font-bold">Заказ №{order.orderNumber || 'Без номера'}</h3>
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${getCarrierColor(order.carrier)}`}>{order.carrier}</span>
                        <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-800">Оформлен</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div><p className="text-slate-500 text-xs">Сборщик</p><p className="font-medium">{order.createdBy?.split('@')[0] || '—'}</p></div>
                        <div><p className="text-slate-500 text-xs">Мест</p><p className="font-medium">{order.quantity || 1}</p></div>
                        <div><p className="text-slate-500 text-xs">Вес</p><p className="font-medium">{order.totalWeight?.toFixed(1) || 0} кг</p></div>
                        <div><p className="text-slate-500 text-xs">Прибыль</p><p className="font-bold text-emerald-600">{order.profit ? `${order.profit.toLocaleString()} ₽` : '—'}</p></div>
                      </div>
                      <div className="mt-2 text-xs text-slate-400">📅 {format(new Date(order.createdAt), 'dd.MM.yyyy HH:mm')}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {hasMore && orders.length > 0 && (
              <div className="flex justify-center pt-4">
                <button onClick={loadMoreOrders} disabled={loadingMore} className="px-6 py-3 bg-blue-600 text-white rounded-xl flex items-center gap-2 disabled:opacity-50">
                  {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                  {loadingMore ? 'Загрузка...' : 'Загрузить еще заказы'}
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
        onSuccess={() => {
          loadOrders();
          setSelectedOrders(new Set());
          showToast('Консоль успешно создана', 'success');
        }}
      />
    </div>
  );
}

function StatsCard({ title, value, icon, color }: any) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20',
  };
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200">
      <div className={`w-12 h-12 ${colors[color]} rounded-xl flex items-center justify-center mb-4`}>{icon}</div>
      <p className="text-sm text-slate-500 font-medium">{title}</p>
      <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{value}</p>
    </div>
  );
}