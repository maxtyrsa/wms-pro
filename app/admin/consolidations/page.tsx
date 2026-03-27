// app/admin/consolidations/page.tsx - исправленная версия

'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, Package, Truck, Eye, X, Loader2, Layers, 
  Shield, Printer, CalendarDays, Filter, RefreshCw, Search,
  CheckCircle2, XCircle, Clock, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  getDocs, 
  updateDoc, 
  doc, 
  writeBatch, 
  where, 
  orderBy, 
  limit, 
  startAfter, 
  DocumentSnapshot,
  Timestamp
} from 'firebase/firestore';
import { format, startOfDay, endOfDay, isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';
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
const STATUS_CONFIG = {
  pending: {
    label: 'Ожидает отправки',
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    icon: Clock,
    nextStatus: 'shipped',
    nextLabel: 'Отправить'
  },
  shipped: {
    label: 'Отправлена',
    color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    icon: CheckCircle2,
    nextStatus: null,
    nextLabel: null
  },
  cancelled: {
    label: 'Отменена',
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    icon: XCircle,
    nextStatus: null,
    nextLabel: null
  }
};

export default function ConsolidationsPage() {
  const router = useRouter();
  const { role, loading: authLoading } = useAuth();
  
  // Состояния для данных
  const [consolidations, setConsolidations] = useState<Consolidation[]>([]);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedForPrint, setSelectedForPrint] = useState<Consolidation | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [availableOrders, setAvailableOrders] = useState<any[]>([]);
  
  // Фильтры
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<{ start: string; end: string }>(() => ({
    start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
  }));
  const [showDateFilter, setShowDateFilter] = useState(false);
  
  // Refs для предотвращения бесконечных циклов
  const isInitialLoadRef = useRef(true);
  const isLoadingRef = useRef(false);

  // Проверка авторизации
  useEffect(() => {
    if (!authLoading && role !== 'admin') {
      router.push('/');
    }
  }, [authLoading, role, router]);

  // Загрузка консолей
  const loadConsolidations = useCallback(async (loadMore = false) => {
    // Предотвращаем одновременную загрузку
    if (isLoadingRef.current) return;
    if (loadMore && !hasMore) return;
    
    isLoadingRef.current = true;
    
    if (loadMore) {
      setLoadingMore(true);
    } else {
      setLoadingData(true);
    }

    try {
      const constraints: any[] = [orderBy('createdAt', 'desc')];
      
      if (statusFilter !== 'all') {
        constraints.unshift(where('status', '==', statusFilter));
      }
      
      let q = query(collection(db, 'consolidations'), ...constraints, limit(PAGE_SIZE));
      
      if (loadMore && lastDoc) {
        q = query(q, startAfter(lastDoc));
      }
      
      const snapshot = await getDocs(q);
      const newConsolidations = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as Consolidation));
      
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
      isLoadingRef.current = false;
    }
  }, [statusFilter, lastDoc, hasMore]);

  // Загрузка доступных заказов
  const fetchAvailableOrders = useCallback(async () => {
    try {
      const q = query(
        collection(db, 'orders'), 
        where('status', '==', 'Оформлен')
      );
      const snapshot = await getDocs(q);
      const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAvailableOrders(orders);
    } catch (error) {
      console.error('Error fetching available orders:', error);
    }
  }, []);

  // Загрузка при монтировании и смене статус-фильтра
  useEffect(() => {
    if (role === 'admin') {
      loadConsolidations();
      fetchAvailableOrders();
    }
  }, [role, statusFilter, loadConsolidations, fetchAvailableOrders]); // Добавлены зависимости

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

  // Отметить консоль как отправленную
  const handleMarkAsShipped = async (consolidation: Consolidation) => {
    if (!confirm(`Подтвердить отправку консоли ${consolidation.consolidationNumber}?`)) return;
    
    setUpdatingId(consolidation.id);
    
    try {
      const consolidationRef = doc(db, 'consolidations', consolidation.id);
      const now = new Date().toISOString();
      
      await updateDoc(consolidationRef, {
        status: 'shipped',
        actualShipmentDate: now,
        updatedAt: now
      });
      
      const batch = writeBatch(db);
      consolidation.orders.forEach((order: any) => {
        const orderRef = doc(db, 'orders', order.id);
        batch.update(orderRef, { 
          status: 'Отправлен',
          shippedAt: Timestamp.now()
        });
      });
      await batch.commit();
      
      showToast(`✅ Консоль ${consolidation.consolidationNumber} отправлена`, 'success');
      
      // Обновляем локальное состояние
      setConsolidations(prev => prev.map(c => 
        c.id === consolidation.id 
          ? { ...c, status: 'shipped', actualShipmentDate: now }
          : c
      ));
      
      fetchAvailableOrders();
      
    } catch (error) {
      console.error('Error marking consolidation as shipped:', error);
      showToast('❌ Ошибка при отправке консоли', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  // Отменить консоль
  const handleCancelConsolidation = async (consolidation: Consolidation) => {
    if (!confirm(`Отменить консоль ${consolidation.consolidationNumber}?`)) return;
    
    setUpdatingId(consolidation.id);
    
    try {
      const consolidationRef = doc(db, 'consolidations', consolidation.id);
      await updateDoc(consolidationRef, {
        status: 'cancelled',
        cancelledAt: new Date().toISOString()
      });
      
      const batch = writeBatch(db);
      consolidation.orders.forEach((order: any) => {
        const orderRef = doc(db, 'orders', order.id);
        batch.update(orderRef, { 
          status: 'Оформлен',
          consolidationId: null
        });
      });
      await batch.commit();
      
      showToast(`🔄 Консоль ${consolidation.consolidationNumber} отменена`, 'warning');
      
      setConsolidations(prev => prev.map(c => 
        c.id === consolidation.id 
          ? { ...c, status: 'cancelled' }
          : c
      ));
      
      fetchAvailableOrders();
      
    } catch (error) {
      console.error('Error cancelling consolidation:', error);
      showToast('❌ Ошибка при отмене консоли', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleRefresh = () => {
    setConsolidations([]);
    setLastDoc(null);
    setHasMore(true);
    loadConsolidations();
    fetchAvailableOrders();
    showToast('Данные обновлены', 'info');
  };

  const clearSearch = () => setSearchQuery('');
  const resetDateFilter = () => {
    setDateFilter({
      start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    });
  };

  const loadMoreConsolidations = () => {
    if (hasMore && !loadingMore && !loadingData) {
      loadConsolidations(true);
    }
  };

  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (role !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 transition-colors duration-200">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-4 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.back()} 
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
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
            disabled={loadingData}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            title="Обновить"
          >
            <RefreshCw className={`w-5 h-5 text-slate-600 dark:text-slate-400 ${loadingData ? 'animate-spin' : ''}`} />
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
            
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setConsolidations([]);
                setLastDoc(null);
                setHasMore(true);
              }}
              className="px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="all">Все статусы</option>
              <option value="pending">Ожидает отправки</option>
              <option value="shipped">Отправлена</option>
              <option value="cancelled">Отменена</option>
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
            
            <div></div>
          </div>
          
          <div className="flex items-center justify-between mt-4 text-xs text-slate-500">
            <span>
              Найдено: <b className="text-slate-900 dark:text-white">{filteredConsolidations.length}</b> консолей
            </span>
            {hasMore && consolidations.length > 0 && !loadingData && (
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

        {/* Список консолей */}
        {loadingData && consolidations.length === 0 ? (
          <div className="flex items-center justify-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-3 text-slate-500">Загрузка консолей...</span>
          </div>
        ) : filteredConsolidations.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <Package className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 dark:text-slate-500">
              {consolidations.length === 0 
                ? 'Нет созданных консолей' 
                : 'Консоли не найдены по выбранным фильтрам'}
            </p>
            {consolidations.length === 0 && (
              <button 
                onClick={() => router.push('/admin/shipments')} 
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Создать первую консоль →
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredConsolidations.map(cons => {
              const statusConfig = getStatusConfig(cons.status);
              const StatusIcon = statusConfig.icon;
              const isUpdating = updatingId === cons.id;
              
              return (
                <div 
                  key={cons.id} 
                  className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all overflow-hidden"
                >
                  <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${statusConfig.color}`}>
                          <StatusIcon className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                              {cons.consolidationNumber}
                            </h2>
                            <span className={`px-3 py-1 rounded-lg text-xs font-bold ${statusConfig.color}`}>
                              {statusConfig.label}
                            </span>
                          </div>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {cons.carrier} • {format(new Date(cons.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex gap-2">
                        {cons.status === 'pending' && (
                          <>
                            <button 
                              onClick={() => handleMarkAsShipped(cons)}
                              disabled={isUpdating}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                            >
                              {isUpdating ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Truck className="w-4 h-4" />
                              )}
                              {isUpdating ? 'Отправка...' : 'Отправить'}
                            </button>
                            <button 
                              onClick={() => handleCancelConsolidation(cons)}
                              disabled={isUpdating}
                              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
                            >
                              <XCircle className="w-4 h-4" />
                              Отменить
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => {
                            setSelectedForPrint(cons);
                            setShowPrintModal(true);
                          }}
                          className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          Просмотр
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-5">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-slate-500 text-xs">Заказов</p>
                        <p className="font-bold text-lg">{cons.totalOrders}</p>
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
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm border-t border-slate-100 dark:border-slate-800 pt-4">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">Ответственный:</span>
                        <span className="font-medium text-slate-900 dark:text-white">{cons.responsiblePerson}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">Плановая отправка:</span>
                        <span className="font-medium">{format(new Date(cons.plannedShipmentDate), 'dd.MM.yyyy')}</span>
                      </div>
                      {cons.actualShipmentDate && (
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">Фактическая отправка:</span>
                          <span className="font-medium text-emerald-600">
                            {format(new Date(cons.actualShipmentDate), 'dd.MM.yyyy HH:mm')}
                          </span>
                        </div>
                      )}
                      {cons.notes && (
                        <div className="col-span-2 flex items-start gap-2">
                          <span className="text-slate-500">Примечания:</span>
                          <span className="text-slate-600 dark:text-slate-400">{cons.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {loadingMore && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                <span className="ml-2 text-slate-500">Загрузка...</span>
              </div>
            )}
          </div>
        )}
      </main>

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
                availableOrders={availableOrders.filter(o => o.carrier === selectedForPrint.carrier && o.status === 'Оформлен')}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}