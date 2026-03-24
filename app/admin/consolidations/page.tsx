'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Package, Truck, Eye, X, Loader2, Layers, Shield, Printer } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, updateDoc, doc, writeBatch } from 'firebase/firestore';
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

export default function ConsolidationsPage() {
  const router = useRouter();
  const { role, loading } = useAuth();
  const [allConsolidations, setAllConsolidations] = useState<Consolidation[]>([]);
  const [filteredConsolidations, setFilteredConsolidations] = useState<Consolidation[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedConsolidation, setSelectedConsolidation] = useState<Consolidation | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedForPrint, setSelectedForPrint] = useState<Consolidation | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Фильтр по дате
  const [dateFilter, setDateFilter] = useState<{ start: string; end: string }>({
    start: format(startOfDay(new Date()), 'yyyy-MM-dd'),
    end: format(endOfDay(new Date()), 'yyyy-MM-dd'),
  });
  const [showDateFilter, setShowDateFilter] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (role !== 'admin') {
      router.push('/');
      return;
    }
    fetchConsolidations();
  }, [role, loading]);

  useEffect(() => {
    applyFilters();
  }, [allConsolidations, searchQuery, dateFilter]);

  const fetchConsolidations = async () => {
    try {
      const q = query(collection(db, 'consolidations'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Consolidation));
      const sortedData = data.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setAllConsolidations(sortedData);
    } catch (error) {
      console.error('Error fetching consolidations:', error);
      showToast('Ошибка при загрузке консолей', 'error');
    } finally {
      setLoadingData(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...allConsolidations];
    
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
    
    setFilteredConsolidations(filtered);
  };

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
      fetchConsolidations();
    } catch (error) {
      console.error('Error marking consolidation as shipped:', error);
      showToast('Ошибка при обновлении статуса', 'error');
    }
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

  if (loading || loadingData) {
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
        <ThemeToggle />
      </header>

      <main className="max-w-6xl mx-auto p-4">
        {/* Поиск и фильтры */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2">
                <Package className="w-4 h-4 text-slate-400" />
              </div>
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
                  <Calendar className="w-4 h-4 text-slate-400" />
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
                      <label className="block text-xs font-medium text-slate-500 mb-1">От даты</label>
                      <input type="date" value={dateFilter.start} onChange={(e) => setDateFilter({ ...dateFilter, start: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">До даты</label>
                      <input type="date" value={dateFilter.end} onChange={(e) => setDateFilter({ ...dateFilter, end: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm" />
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
          <div className="text-xs text-slate-500 mt-3">
            Найдено: <span className="font-bold text-slate-900">{filteredConsolidations.length}</span> консолей
          </div>
        </div>

        {filteredConsolidations.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <Package className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 dark:text-slate-500">
              {allConsolidations.length === 0 ? 'Нет созданных консолей' : 'Консоли не найдены по выбранным фильтрам'}
            </p>
            {allConsolidations.length === 0 && (
              <button onClick={() => router.push('/admin/shipments')} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium">
                Создать консоль
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredConsolidations.map(cons => (
              <div key={cons.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all overflow-hidden">
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
                        <button onClick={() => handleMarkAsShipped(cons)} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium flex items-center gap-2">
                          <Truck className="w-4 h-4" />
                          Отметить отправленной
                        </button>
                      )}
                      <button onClick={() => setSelectedConsolidation(cons)} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        Детали
                      </button>
                      <button onClick={() => { setSelectedForPrint(cons); setShowPrintModal(true); }} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium flex items-center gap-2">
                        <Printer className="w-4 h-4" />
                        Печать
                      </button>
                    </div>
                  </div>
                </div>
                <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div><p className="text-slate-500 text-xs">Заказов</p><p className="font-bold text-slate-900 dark:text-white">{cons.totalOrders}</p></div>
                  <div><p className="text-slate-500 text-xs">Вес</p><p className="font-bold text-slate-900 dark:text-white">{cons.totalWeight.toFixed(1)} кг</p></div>
                  <div><p className="text-slate-500 text-xs">Объем</p><p className="font-bold text-slate-900 dark:text-white">{cons.totalVolume.toFixed(4)} м³</p></div>
                  <div><p className="text-slate-500 text-xs">Прибыль</p><p className="font-bold text-emerald-600 dark:text-emerald-400">{cons.totalProfit.toLocaleString()} ₽</p></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Модальное окно деталей консоли */}
      <AnimatePresence>
        {selectedConsolidation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedConsolidation(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div><h2 className="text-2xl font-bold text-slate-900 dark:text-white">{selectedConsolidation.consolidationNumber}</h2><p className="text-sm text-slate-500">{selectedConsolidation.carrier}</p></div>
                <button onClick={() => setSelectedConsolidation(null)} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-5 h-5 text-slate-400" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-50 rounded-xl"><p className="text-slate-500 text-xs">Дата создания</p><p className="font-medium">{format(new Date(selectedConsolidation.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}</p></div>
                  <div className="p-3 bg-slate-50 rounded-xl"><p className="text-slate-500 text-xs">Ответственный</p><p className="font-medium">{selectedConsolidation.responsiblePerson}</p></div>
                  <div className="p-3 bg-slate-50 rounded-xl"><p className="text-slate-500 text-xs">Планируемая отправка</p><p className="font-medium">{format(new Date(selectedConsolidation.plannedShipmentDate), 'dd.MM.yyyy')}</p></div>
                  <div className="p-3 bg-slate-50 rounded-xl"><p className="text-slate-500 text-xs">Фактическая отправка</p><p className="font-medium">{selectedConsolidation.actualShipmentDate ? format(new Date(selectedConsolidation.actualShipmentDate), 'dd.MM.yyyy HH:mm') : '—'}</p></div>
                </div>
                <div className="border-t pt-4"><h3 className="font-semibold mb-3">Заказы в консоли</h3><div className="space-y-2 max-h-64 overflow-y-auto">{selectedConsolidation.orders.map((order: any, idx: number) => (<div key={idx} className="flex justify-between p-2 bg-slate-50 rounded-lg text-sm"><span className="font-medium">{order.orderNumber}</span><span>{order.quantity} мест</span><span>{order.totalWeight} кг</span><span className="text-emerald-600">{order.profit.toLocaleString()} ₽</span></div>))}</div></div>
                {selectedConsolidation.notes && (<div className="border-t pt-4"><h3 className="font-semibold mb-2">Примечания</h3><p className="text-sm text-slate-600">{selectedConsolidation.notes}</p></div>)}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Модальное окно печати */}
      <AnimatePresence>
        {showPrintModal && selectedForPrint && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative">
              <PrintConsolidation consolidation={selectedForPrint} onClose={() => { setShowPrintModal(false); setSelectedForPrint(null); }} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}