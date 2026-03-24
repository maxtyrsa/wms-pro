'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { format, startOfDay, endOfDay } from 'date-fns';
import { ru } from 'date-fns/locale';
import { 
  Package, Search, XCircle, Truck, 
  CheckCircle2, Loader2, BarChart3,
  TrendingUp, Layers, Calendar, Filter
} from 'lucide-react';
import { showToast } from '@/components/Toast';
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

export function ShippedOrdersList() {
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCarrier, setSelectedCarrier] = useState<string>('all');
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [showCreateModal, setShowCreateModal] = useState(false);
  
  // Фильтр по дате
  const [dateFilter, setDateFilter] = useState<{ start: string; end: string }>({
    start: format(startOfDay(new Date()), 'yyyy-MM-dd'),
    end: format(endOfDay(new Date()), 'yyyy-MM-dd'),
  });
  const [showDateFilter, setShowDateFilter] = useState(false);

  useEffect(() => {
    fetchShippedOrders();
  }, []);

  const fetchShippedOrders = async () => {
    setLoading(true);
    try {
      console.log('📦 Загрузка заказов со статусом "Оформлен"...');
      
      // Упрощенный запрос - без orderBy, только where
      const q = query(
        collection(db, 'orders'),
        where('status', '==', 'Оформлен')
      );
      
      const snapshot = await getDocs(q);
      console.log(`✅ Найдено заказов со статусом "Оформлен": ${snapshot.docs.length}`);
      
      const data = snapshot.docs.map(doc => {
        const orderData = doc.data();
        return { 
          id: doc.id, 
          orderNumber: orderData.orderNumber,
          carrier: orderData.carrier,
          status: orderData.status,
          createdAt: orderData.createdAt,
          createdBy: orderData.createdBy,
          totalWeight: orderData.totalWeight,
          totalVolume: orderData.totalVolume,
          profit: orderData.profit,
          quantity: orderData.quantity || 1,
          payment_sum: orderData.payment_sum || 0
        } as Order;
      });
      
      setAllOrders(data);
    } catch (error) {
      console.error('❌ Ошибка загрузки заказов:', error);
      showToast('Ошибка при загрузке заказов', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Фильтруем на клиенте
  const filteredOrders = useMemo(() => {
    let filtered = allOrders.filter(order => order.carrier !== 'Самовывоз');
    
    // Поиск по номеру
    if (searchQuery.trim()) {
      const queryLower = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(order => 
        order.orderNumber?.toLowerCase().includes(queryLower)
      );
    }

    // Фильтр по ТК
    if (selectedCarrier !== 'all') {
      filtered = filtered.filter(order => order.carrier === selectedCarrier);
    }

    // Фильтр по дате
    if (dateFilter.start && dateFilter.end) {
      const start = startOfDay(new Date(dateFilter.start));
      const end = endOfDay(new Date(dateFilter.end));
      filtered = filtered.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= start && orderDate <= end;
      });
    }
    
    // Сортируем на клиенте по дате (новые сверху)
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return filtered;
  }, [allOrders, searchQuery, selectedCarrier, dateFilter]);

  // Статистика
  const stats = useMemo(() => {
    const carriers: Record<string, number> = {};
    let totalWeight = 0;
    let totalVolume = 0;
    let totalProfit = 0;

    filteredOrders.forEach(order => {
      carriers[order.carrier] = (carriers[order.carrier] || 0) + 1;
      totalWeight += order.totalWeight || 0;
      totalVolume += order.totalVolume || 0;
      totalProfit += order.profit || 0;
    });

    return {
      totalOrders: filteredOrders.length,
      totalWeight,
      totalVolume,
      totalProfit,
      carriers
    };
  }, [filteredOrders]);

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
      start: format(startOfDay(new Date()), 'yyyy-MM-dd'),
      end: format(endOfDay(new Date()), 'yyyy-MM-dd'),
    });
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-slate-500">Загрузка заказов...</span>
      </div>
    );
  }

  const selectedCount = selectedOrders.size;

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
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Поиск по номеру */}
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

          {/* Фильтр по ТК */}
          <select
            value={selectedCarrier}
            onChange={(e) => setSelectedCarrier(e.target.value)}
            className="px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="all">Все ТК</option>
            {Object.keys(stats.carriers).map(carrier => (
              <option key={carrier} value={carrier}>{carrier}</option>
            ))}
          </select>

          {/* Фильтр по дате */}
          <div className="relative">
            <button
              onClick={() => setShowDateFilter(!showDateFilter)}
              className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  {dateFilter.start === dateFilter.end 
                    ? format(new Date(dateFilter.start), 'dd.MM.yyyy')
                    : `${format(new Date(dateFilter.start), 'dd.MM')} - ${format(new Date(dateFilter.end), 'dd.MM')}`}
                </span>
              </div>
              <Filter className="w-4 h-4 text-slate-400" />
            </button>
            
            {showDateFilter && (
              <div className="absolute top-full left-0 mt-2 z-10 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-4 w-full min-w-[280px]">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">От даты</label>
                    <input
                      type="date"
                      value={dateFilter.start}
                      onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">До даты</label>
                    <input
                      type="date"
                      value={dateFilter.end}
                      onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={resetDateFilter}
                      className="flex-1 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      Сбросить
                    </button>
                    <button
                      onClick={() => setShowDateFilter(false)}
                      className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                    >
                      Применить
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Пустой блок для выравнивания */}
          <div></div>
        </div>
      </div>

      {/* Если нет заказов */}
      {stats.totalOrders === 0 && !loading && (
        <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <Package className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400 dark:text-slate-500 mb-2">Нет заказов, готовых к отправке</p>
          <p className="text-xs text-slate-400">Убедитесь, что у вас есть заказы со статусом "Оформлен"</p>
        </div>
      )}

      {/* Панель выбора и создания консоли */}
      {filteredOrders.length > 0 && (
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleAllSelection}
              className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedOrders.size === filteredOrders.length && filteredOrders.length > 0}
                onChange={() => {}}
                className="w-4 h-4 rounded border-slate-300"
              />
              {selectedOrders.size === filteredOrders.length ? 'Снять все' : 'Выбрать все'}
            </button>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              Выбрано: <b className="text-slate-900 dark:text-white">{selectedCount}</b> заказов
            </span>
          </div>
          
          {selectedCount > 0 && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Layers className="w-4 h-4" />
              Создать консоль ({selectedCount})
            </button>
          )}
        </div>
      )}

      {/* Список заказов */}
      {filteredOrders.length > 0 && (
        <div className="space-y-3">
          {filteredOrders.map(order => (
            <div
              key={order.id}
              className={`p-4 rounded-2xl border shadow-sm transition-all cursor-pointer hover:shadow-md ${
                selectedOrders.has(order.id)
                  ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
              }`}
              onClick={() => toggleOrderSelection(order.id)}
            >
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedOrders.has(order.id)}
                    onChange={() => {}}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 w-4 h-4 rounded border-slate-300"
                  />
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                        Заказ №{order.orderNumber || 'Без номера'}
                      </h3>
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${getCarrierColor(order.carrier)}`}>
                        {order.carrier}
                      </span>
                      <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                        Оформлен
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500 dark:text-slate-400 text-xs">Сборщик</p>
                        <p className="font-medium text-slate-700 dark:text-slate-300">{order.createdBy?.split('@')[0] || '—'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 dark:text-slate-400 text-xs">Мест</p>
                        <p className="font-medium text-slate-700 dark:text-slate-300">{order.quantity || 1}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 dark:text-slate-400 text-xs">Вес</p>
                        <p className="font-medium text-slate-700 dark:text-slate-300">{order.totalWeight?.toFixed(1) || 0} кг</p>
                      </div>
                      <div>
                        <p className="text-slate-500 dark:text-slate-400 text-xs">Прибыль</p>
                        <p className="font-bold text-emerald-600 dark:text-emerald-400">
                          {order.profit ? `${order.profit.toLocaleString()} ₽` : '—'}
                        </p>
                      </div>
                    </div>
                    
                    {/* Дата создания для информации */}
                    <div className="mt-2 text-xs text-slate-400">
                      📅 {format(new Date(order.createdAt), 'dd.MM.yyyy HH:mm')}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Модальное окно */}
      <CreateConsolidationModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        selectedOrders={getSelectedOrdersData()}
        onSuccess={() => {
          fetchShippedOrders();
          setSelectedOrders(new Set());
        }}
      />
    </div>
  );
}

function StatsCard({ title, value, icon, color }: { title: string; value: string; icon: React.ReactNode; color: string }) {
  const colors: any = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400',
  };

  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
      <div className={`w-12 h-12 ${colors[color]} rounded-xl flex items-center justify-center mb-4`}>
        {icon}
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{title}</p>
      <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{value}</p>
    </div>
  );
}