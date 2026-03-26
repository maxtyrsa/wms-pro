// app/admin/consolidations/page.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Package, Truck, Eye, X, Loader2, Layers, Shield, Printer, CalendarDays, Filter, RefreshCw, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, updateDoc, doc, writeBatch, where, orderBy, limit, startAfter, DocumentSnapshot } from 'firebase/firestore';
import { format, startOfDay, endOfDay, isWithinInterval } from 'date-fns';
import { ru } from 'date-fns/locale';
import { showToast } from '@/components/Toast';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { PrintConsolidation } from '@/components/print/PrintConsolidation';

interface Consolidation {
  id: string;
  consolidationNumber: string;
  carrier: string;
  createdAt: string;
  createdBy: string;
  totalOrders: number;
  totalWeight: number;
  totalVolume: number;
  totalProfit: number;
  plannedShipmentDate: string;
  actualShipmentDate?: string;
  status: 'pending' | 'shipped' | 'cancelled';
  responsiblePerson: string;
  notes?: string;
  orders: any[];
}

const PAGE_SIZE = 15;

export default function ConsolidationsPage() {
  const router = useRouter();
  const { role, loading } = useAuth();
  
  const [consolidations, setConsolidations] = useState<Consolidation[]>([]);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedConsolidation, setSelectedConsolidation] = useState<Consolidation | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedForPrint, setSelectedForPrint] = useState<Consolidation | null>(null);
  const [availableOrders, setAvailableOrders] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Фильтры
  const [dateFilter, setDateFilter] = useState<{ start: string; end: string }>({
    start: format(startOfDay(new Date()), 'yyyy-MM-dd'),
    end: format(endOfDay(new Date()), 'yyyy-MM-dd'),
  });
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showDateFilter, setShowDateFilter] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (role !== 'admin') {
      router.push('/');
      return;
    }
    loadConsolidations();
    fetchAvailableOrders();
  }, [role, loading]);

  const loadConsolidations = async (loadMore = false) => {
    if (loadMore && !hasMore) return;
    
    if (loadMore) {
      setLoadingMore(true);
    } else {
      setLoadingData(true);
    }

    try {
      let constraints = [orderBy('createdAt', 'desc')];
      
      if (statusFilter !== 'all') {
        constraints.unshift(where('status', '==', statusFilter));
      }
      
      let q = query(collection(db, 'consolidations'), ...constraints, limit(PAGE_SIZE));
      
      if (loadMore && lastDoc) {
        q = query(q, startAfter(lastDoc));
      }
      
      const snapshot = await getDocs(q);
      const newConsolidations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Consolidation));
      
      if (loadMore) {
        setConsolidations(prev => [...prev, ...newConsolidations]);
      } else {
        setConsolidations(newConsolidations);
      }
      
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
      
    } catch (error) {
      console.error('Error fetching consolidations:', error);
      showToast('Ошибка при загрузке консолей', 'error');
    } finally {
      setLoadingData(false);
      setLoadingMore(false);
    }
  };

  const fetchAvailableOrders = async () => {
    try {
      const q = query(collection(db, 'orders'), where('status', '==', 'Оформлен'));
      const snapshot = await getDocs(q);
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAvailableOrders(orders);
    } catch (error) {
      console.error('Error fetching available orders:', error);
    }
  };

  // Фильтрация на клиенте (поиск и дата)
  const filteredConsolidations = useMemo(() => {
    let filtered = [...consolidations];
    
    if (searchQuery.trim()) {
      const queryLower = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(cons => 
        cons.consolidationNumber?.toLowerCase().includes(queryLower)
      );
    }
    
    if (dateFilter.start && dateFilter.end) {
      const start = startOfDay(new Date(dateFilter.start));
      const end = endOfDay(new Date(dateFilter.end));
      filtered = filtered.filter(cons => {
        const consDate = new Date(cons.createdAt);
        return isWithinInterval(consDate, { start, end });
      });
    }
    
    return filtered;
  }, [consolidations, searchQuery, dateFilter]);

  const handleMarkAsShipped = async (consolidation: Consolidation) => {
    if (!confirm(`Подтвердить отправку консоли ${consolidation.consolidationNumber}?`)) return;
    
    try {
      const consolidationRef = doc(db, 'consolidations', consolidation.id);
      await updateDoc(consolidationRef, {
        status: 'shipped',
        actualShipmentDate: new Date().toISOString()
      });
      
      const batch = writeBatch(db);
      consolidation.orders.forEach((order: any) => {
        const orderRef = doc(db, 'orders', order.id);
        batch.update(orderRef, { status: 'Отправлен' });
      });
      await batch.commit();
      
      showToast(`Консоль ${consolidation.consolidationNumber} отмечена как отправленная`, 'success');
      loadConsolidations();
      fetchAvailableOrders();
    } catch (error) {
      console.error('Error marking consolidation as shipped:', error);
      showToast('Ошибка при обновлении статуса', 'error');
    }
  };

  const handleRefresh = () => {
    loadConsolidations();
    fetchAvailableOrders();
    showToast('Данные обновлены', 'info');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">Ожидает отправки</span>;
      case 'shipped':
        return <span className="px-2 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">Отправлена</span>;
      case 'cancelled':
        return <span className="px-2 py-1 rounded-lg text-xs font-bold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">Отменена</span>;
      default:
        return null;
    }
  };

  const clearSearch = () => setSearchQuery('');
  const resetDateFilter = () => {
    setDateFilter({
      start: format(startOfDay(new Date()), 'yyyy-MM-dd'),
      end: format(endOfDay(new Date()), 'yyyy-MM-dd'),
    });
  };

  const loadMoreConsolidations = () => {
    if (hasMore && !loadingMore) {
      loadConsolidations(true);
    }
  };

  if (loading || (loadingData && consolidations.length === 0)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 transition-colors duration-200">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-4 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-400" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              Консоли отправки
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Управление партиями отправленных заказов
            </p>
          </div>
          <div className="ml-4 bg-blue-50 dark:bg-blue-900/30 px-3 py-1 rounded-lg text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
            <Shield className="w-3 h-3" />
            Администратор
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            title="Обновить"
          >
            <RefreshCw className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4">
        {/* Фильтры */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Поиск по номеру консоли..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
              />
              {searchQuery && (
                <button onClick={clearSearch} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            
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
                <div className="absolute top-full left-0 mt-2 z-10 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-4 w-full">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">От даты</label>
                      <input 
                        type="date" 
                        value={dateFilter.start} 
                        onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })} 
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm" 
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">До даты</label>
                      <input 
                        type="date" 
                        value={dateFilter.end} 
                        onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })} 
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm" 
                      />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button onClick={resetDateFilter} className="flex-1 px-3 py-2 text-sm border rounded-xl hover:bg-slate-50">Сбросить</button>
                      <button onClick={() => setShowDateFilter(false)} className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700">Применить</button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setConsolidations([]);
                setLastDoc(null);
                setHasMore(true);
                loadConsolidations();
              }}
              className="px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">Все статусы</option>
              <option value="pending">Ожидает отправки</option>
              <option value="shipped">Отправлена</option>
              <option value="cancelled">Отменена</option>
            </select>
            
            <div></div>
          </div>
          
          <div className="flex items-center justify-between mt-4 text-xs text-slate-500">
            <span>
              Найдено: <b className="text-slate-900 dark:text-white">{filteredConsolidations.length}</b> консолей
              {consolidations.length < filteredConsolidations.length && ' (отфильтровано)'}
            </span>
            {hasMore && consolidations.length > 0 && (
              <button
                onClick={loadMoreConsolidations}
                disabled={loadingMore}
                className="text-blue-600 hover:underline flex items-center gap-1"
              >
                {loadingMore ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  'Загрузить еще'
                )}
              </button>
            )}
          </div>
        </div>

        {filteredConsolidations.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <Package className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 dark:text-slate-500">
              {consolidations.length === 0 ? 'Нет созданных консолей' : 'Консоли не найдены по выбранным фильтрам'}
            </p>
            {consolidations.length === 0 && (
              <button 
                onClick={() => router.push('/admin/shipments')} 
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Создать консоль
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredConsolidations.map(cons => (
              <div 
                key={cons.id} 
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all overflow-hidden"
              >
                <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{cons.consolidationNumber}</h2>
                        {getStatusBadge(cons.status)}
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {cons.carrier} • {format(new Date(cons.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {cons.status === 'pending' && (
                        <button 
                          onClick={() => handleMarkAsShipped(cons)} 
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium flex items-center gap-2"
                        >
                          <Truck className="w-4 h-4" />
                          Отметить отправленной
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setSelectedForPrint(cons);
                          setShowPrintModal(true);
                        }}
                        className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium flex items-center gap-2"
                      >
                        <Eye className="w-4 h-4" />
                        Редактировать
                      </button>
                    </div>
                  </div>
                </div>
                <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-slate-500 text-xs">Заказов</p>
                    <p className="font-bold">{cons.totalOrders}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Вес</p>
                    <p className="font-bold">{cons.totalWeight.toFixed(1)} кг</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Объем</p>
                    <p className="font-bold">{cons.totalVolume.toFixed(4)} м³</p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs">Прибыль</p>
                    <p className="font-bold text-emerald-600">{cons.totalProfit.toLocaleString()} ₽</p>
                  </div>
                </div>
                {cons.responsiblePerson && (
                  <div className="px-5 pb-5">
                    <p className="text-xs text-slate-500">
                      Ответственный: <span className="font-medium text-slate-700 dark:text-slate-300">{cons.responsiblePerson}</span>
                    </p>
                    {cons.plannedShipmentDate && (
                      <p className="text-xs text-slate-500 mt-1">
                        Плановая отправка: {format(new Date(cons.plannedShipmentDate), 'dd.MM.yyyy')}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
            
            {/* Индикатор загрузки дополнительных консолей */}
            {loadingMore && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span className="ml-2 text-slate-500">Загрузка...</span>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Модальное окно редактирования консоли */}
      <AnimatePresence>
        {showPrintModal && selectedForPrint && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative"
            >
              <PrintConsolidation
                consolidation={selectedForPrint}
                onClose={() => {
                  setShowPrintModal(false);
                  setSelectedForPrint(null);
                }}
                onUpdate={() => {
                  loadConsolidations();
                  fetchAvailableOrders();
                }}
                availableOrders={availableOrders.filter(o => o.carrier === selectedForPrint.carrier)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}