'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  writeBatch, 
  doc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  limit,
  startAfter,
  getDocs,
  where,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import { 
  CheckSquare, Square, X, ChevronDown, Package, 
  Clock, Hash, CheckCircle2, ArrowLeft, Trash2,
  ChevronRight, Loader2, Search, XCircle
} from 'lucide-react';
import { showToast } from '@/components/Toast';

const CARRIERS = ['Все', 'CDEK', 'DPD', 'Деловые линии', 'Почта России', 'ПЭК', 'Самовывоз', 'Образцы', 'OZON_FBS', 'Ярмарка Мастеров', 'Yandex Market', 'WB_FBS', 'AliExpress', 'Бийск', 'OZON_FBO', 'WB_FBO'];
const STATUSES = ['Все', 'Новый', 'Комплектация', 'Ожидает оформления', 'Готов к выдаче', 'Оформлен', 'Завершен'];

const PAGE_SIZE = 20;

export default function AdminOrdersPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [totalLoaded, setTotalLoaded] = useState(0);
  
  // States for loading indicators
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [savingFinance, setSavingFinance] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: format(new Date(), 'yyyy-MM-dd'),
    end: format(new Date(), 'yyyy-MM-dd'),
  });
  const [selectedCarrier, setSelectedCarrier] = useState('Все');
  const [selectedStatus, setSelectedStatus] = useState('Все');

  // Selection
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());

  // Modal
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any | null>(null);
  const [massStatusMenuOpen, setMassStatusMenuOpen] = useState(false);
  
  // Ref for initial load flag
  const initialLoadDone = useRef(false);

  // Загрузка первой страницы
  const loadFirstPage = useCallback(async () => {
    setLoading(true);
    setOrders([]);
    setLastDoc(null);
    setHasMore(true);
    setTotalLoaded(0);

    try {
      let conditions = [];
      
      if (selectedCarrier !== 'Все') {
        conditions.push(where('carrier', '==', selectedCarrier));
      }
      if (selectedStatus !== 'Все') {
        conditions.push(where('status', '==', selectedStatus));
      }
      
      let q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(PAGE_SIZE));
      
      for (const condition of conditions) {
        q = query(q, condition);
      }
      
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(data);
      setTotalLoaded(data.length);
      
      if (snapshot.docs.length > 0) {
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      }
      setHasMore(snapshot.docs.length === PAGE_SIZE);
    } catch (error) {
      console.error('Error loading orders:', error);
      showToast('Ошибка при загрузке заказов', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedCarrier, selectedStatus]);

  const loadMore = async () => {
    if (!hasMore || loadingMore || !lastDoc) return;
    
    setLoadingMore(true);
    
    try {
      let conditions = [];
      
      if (selectedCarrier !== 'Все') {
        conditions.push(where('carrier', '==', selectedCarrier));
      }
      if (selectedStatus !== 'Все') {
        conditions.push(where('status', '==', selectedStatus));
      }
      
      let q = query(
        collection(db, 'orders'),
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(PAGE_SIZE)
      );
      
      for (const condition of conditions) {
        q = query(q, condition);
      }
      
      const snapshot = await getDocs(q);
      const newOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      setOrders(prev => [...prev, ...newOrders]);
      setTotalLoaded(prev => prev + newOrders.length);
      
      if (snapshot.docs.length > 0) {
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      }
      setHasMore(snapshot.docs.length === PAGE_SIZE);
    } catch (error) {
      console.error('Error loading more orders:', error);
      showToast('Ошибка при загрузке дополнительных заказов', 'error');
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (initialLoadDone.current) {
      loadFirstPage();
    } else {
      loadFirstPage();
      initialLoadDone.current = true;
    }
  }, [loadFirstPage, selectedCarrier, selectedStatus, dateRange]);

  // Фильтрация на клиенте для дат и поиска
  const filteredOrders = useMemo(() => {
    let result = orders;
    
    result = result.filter(order => {
      const orderDate = order.createdAt?.seconds ? new Date(order.createdAt.seconds * 1000) : new Date(order.createdAt);
      if (isNaN(orderDate.getTime())) return false;
      const start = startOfDay(new Date(dateRange.start));
      const end = endOfDay(new Date(dateRange.end));
      return isWithinInterval(orderDate, { start, end });
    });
    
    if (searchQuery.trim()) {
      const queryLower = searchQuery.trim().toLowerCase();
      result = result.filter(order => 
        order.orderNumber?.toLowerCase().includes(queryLower)
      );
    }
    
    return result;
  }, [orders, dateRange, searchQuery]);

  const handleDeleteOrder = async (id: string) => {
    if (!window.confirm('Вы уверены, что хотите безвозвратно удалить этот заказ?')) return;
    
    setDeletingOrderId(id);
    try {
      await deleteDoc(doc(db, 'orders', id));
      setSelectedOrderDetails(null);
      showToast('Заказ успешно удален', 'success');
      loadFirstPage();
    } catch (error) {
      console.error('Error deleting order:', error);
      showToast('Ошибка при удалении заказа', 'error');
    } finally {
      setDeletingOrderId(null);
    }
  };

  const toggleOrderSelection = (id: string) => {
    const newSelection = new Set(selectedOrders);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
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

  const handleMassStatusChange = async (newStatus: string) => {
    if (selectedOrders.size === 0) return;
    
    setBulkUpdating(true);
    try {
      const batch = writeBatch(db);
      selectedOrders.forEach(id => {
        const orderRef = doc(db, 'orders', id);
        const updateData: any = {
          status: newStatus,
          lastUpdated: serverTimestamp()
        };
        if (newStatus === 'Завершен') updateData.shippedAt = serverTimestamp();
        batch.update(orderRef, updateData);
      });
      await batch.commit();
      
      setMassStatusMenuOpen(false);
      setSelectedOrders(new Set());
      showToast(`Статус ${selectedOrders.size} заказов изменен на "${newStatus}"`, 'success');
      loadFirstPage();
    } catch (error) {
      console.error('Error bulk updating status:', error);
      showToast('Ошибка при массовом изменении статусов', 'error');
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleSingleStatusChange = async (id: string, newStatus: string) => {
    setUpdatingStatusId(id);
    try {
      const orderRef = doc(db, 'orders', id);
      const updateData: any = { status: newStatus };
      if (newStatus === 'Завершен') updateData.shippedAt = serverTimestamp();
      await updateDoc(orderRef, updateData);
      
      if (selectedOrderDetails?.id === id) {
        setSelectedOrderDetails({ ...selectedOrderDetails, status: newStatus });
      }
      
      showToast(`Статус заказа изменен на "${newStatus}"`, 'success');
      loadFirstPage();
    } catch (error) {
      console.error('Error updating status:', error);
      showToast('Ошибка при изменении статуса', 'error');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleSaveFinance = async () => {
    if (!selectedOrderDetails) return;
    
    setSavingFinance(true);
    try {
      const orderRef = doc(db, 'orders', selectedOrderDetails.id);
      const paymentSum = selectedOrderDetails.payment_sum || 0;
      const deliveryCost = selectedOrderDetails.delivery_cost || 0;
      const profit = paymentSum - deliveryCost;
      
      await updateDoc(orderRef, {
        payment_sum: paymentSum,
        delivery_cost: deliveryCost,
        profit: profit
      });
      
      showToast('Финансовая информация сохранена', 'success');
    } catch (error) {
      console.error('Error saving finance:', error);
      showToast('Ошибка при сохранении финансовой информации', 'error');
    } finally {
      setSavingFinance(false);
    }
  };

  const formatAssemblyTime = (start: any, end: any) => {
    if (!start || !end) return '-';
    const s = start.seconds ? start.seconds : new Date(start).getTime() / 1000;
    const e = end.seconds ? end.seconds : new Date(end).getTime() / 1000;
    const diff = Math.floor(e - s);
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Новый': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Комплектация': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Ожидает оформления': return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Готов к выдаче': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'Оформлен': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Завершен': return 'bg-slate-200 text-slate-800 border-slate-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.back()} 
              className="p-2 hover:bg-slate-100 rounded-full transition-colors"
            >
              <ArrowLeft size={24} className="text-slate-700" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Управление заказами</h1>
              <p className="text-xs text-slate-500 font-medium">
                Загружено: {totalLoaded} заказов • Отфильтровано: {filteredOrders.length}
                {hasMore && <span className="ml-2 text-blue-500">(есть еще заказы)</span>}
              </p>
            </div>
          </div>
          <div className="hidden md:block text-sm font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">
            Панель администратора
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {/* Поиск и фильтры */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Поиск по номеру заказа..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-10 py-3 rounded-2xl border border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">От даты</label>
              <input type="date" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="block w-full rounded-2xl border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">До даты</label>
              <input type="date" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="block w-full rounded-2xl border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Компания</label>
              <select value={selectedCarrier} onChange={(e) => setSelectedCarrier(e.target.value)}
                className="block w-full rounded-2xl border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none cursor-pointer">
                {CARRIERS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Статус</label>
              <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}
                className="block w-full rounded-2xl border-slate-200 bg-slate-50 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none cursor-pointer">
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between bg-white p-4 rounded-3xl shadow-sm border border-slate-200 gap-4">
          <div className="flex items-center gap-3">
            <button onClick={toggleAllSelection} className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-slate-50 text-sm font-bold text-slate-700 transition-all border border-transparent hover:border-slate-200">
              {selectedOrders.size === filteredOrders.length && filteredOrders.length > 0 ? 
                <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5 text-slate-300" />}
              Выбрать все
            </button>
            <div className="h-6 w-[1px] bg-slate-200 hidden md:block" />
            <span className="text-sm font-medium text-slate-500">Найдено: <b className="text-slate-900">{filteredOrders.length}</b></span>
          </div>

          <div className="relative w-full md:w-auto">
            <button 
              onClick={() => setMassStatusMenuOpen(!massStatusMenuOpen)} 
              disabled={selectedOrders.size === 0 || bulkUpdating}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl text-sm font-bold hover:bg-black disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-slate-200"
            >
              {bulkUpdating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Обновление...
                </>
              ) : (
                <>
                  Массовое изменение ({selectedOrders.size})
                  <ChevronDown className="w-4 h-4" />
                </>
              )}
            </button>
            
            <AnimatePresence>
              {massStatusMenuOpen && !bulkUpdating && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                  className="absolute right-0 mt-3 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-40 p-1">
                  {STATUSES.filter(s => s !== 'Все').map(status => (
                    <button key={status} onClick={() => handleMassStatusChange(status)}
                      className="w-full text-left px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 rounded-xl transition-all">
                      {status}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Main Table */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 text-slate-400 text-[11px] font-bold uppercase tracking-widest border-b border-slate-100">
                  <th className="p-5 w-14"></th>
                  <th className="p-5">Дата</th>
                  <th className="p-5">Заказ</th>
                  <th className="p-5">ТК</th>
                  <th className="p-5">Статус</th>
                  <th className="p-5">Сборщик</th>
                  <th className="p-5 text-center">Время</th>
                  <th className="p-5 text-right">Вес</th>
                  <th className="p-5 text-right">Прибыль</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="p-20 text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
                      <p className="text-slate-400 font-medium mt-2">Загрузка заказов...</p>
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-20 text-center text-slate-400 font-medium">
                      {searchQuery ? 'Заказы не найдены по запросу' : 'Заказы не найдены за этот период'}
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map(order => (
                    <tr 
                      key={order.id} 
                      onClick={() => setSelectedOrderDetails(order)}
                      className={`group hover:bg-blue-50/30 transition-all cursor-pointer ${selectedOrders.has(order.id) ? 'bg-blue-50' : ''}`}
                    >
                      <td className="p-5" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => toggleOrderSelection(order.id)} className="transition-transform active:scale-90">
                          {selectedOrders.has(order.id) ? <CheckSquare className="w-6 h-6 text-blue-600" /> : <Square className="w-6 h-6 text-slate-200 group-hover:text-slate-300" />}
                        </button>
                      </td>
                      <td className="p-5 text-slate-500 text-xs font-medium whitespace-nowrap">
                        {order.createdAt ? format(order.createdAt?.seconds ? new Date(order.createdAt.seconds * 1000) : new Date(order.createdAt), 'dd.MM.yy HH:mm') : '-'}
                      </td>
                      <td className="p-5 font-bold text-slate-900">{order.orderNumber || '—'}</td>
                      <td className="p-5 text-slate-600 font-semibold text-xs uppercase">{order.carrier}</td>
                      <td className="p-5">
                        <span className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border uppercase tracking-tight ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="p-5 text-slate-600 text-xs font-medium truncate max-w-[120px]">{order.createdBy || 'Система'}</td>
                      <td className="p-5 text-center font-mono text-xs text-slate-500">{formatAssemblyTime(order.time_start, order.time_end)}</td>
                      <td className="p-5 text-right font-bold text-slate-900">{order.totalWeight ? `${Number(order.totalWeight).toFixed(1)} кг` : '—'}</td>
                      <td className="p-5 text-right font-bold text-emerald-600">
                        {order.profit ? `${order.profit.toLocaleString()} ₽` : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {!loading && filteredOrders.length > 0 && hasMore && (
            <div className="flex items-center justify-center px-6 py-4 border-t border-slate-200 bg-slate-50/30">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Загрузка...
                  </>
                ) : (
                  <>
                    <ChevronRight className="w-4 h-4" />
                    Загрузить еще заказы
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Side Modal (Drawer Style) */}
      <AnimatePresence>
        {selectedOrderDetails && (
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedOrderDetails(null)}>
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()} className="bg-white h-full w-full max-w-lg shadow-2xl flex flex-col relative">
              
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Заказ {selectedOrderDetails.orderNumber}</h2>
                  <p className="text-xs text-slate-500 font-bold uppercase mt-1 tracking-widest">{selectedOrderDetails.carrier}</p>
                </div>
                <button onClick={() => setSelectedOrderDetails(null)} className="p-3 bg-white hover:bg-slate-100 rounded-2xl shadow-sm border border-slate-200 transition-all">
                  <X size={20} className="text-slate-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Admin Action Section */}
                <div className="bg-blue-50 p-5 rounded-3xl border border-blue-100 space-y-4">
                  <div className="flex items-center gap-2 text-blue-700 mb-1">
                    <CheckCircle2 size={18} />
                    <span className="text-xs font-black uppercase tracking-wider">Управление статусом</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedOrderDetails.carrier === 'Самовывоз' && selectedOrderDetails.status === 'Готов к выдаче' && (
                      <button 
                        onClick={() => handleSingleStatusChange(selectedOrderDetails.id, 'Завершен')}
                        disabled={updatingStatusId === selectedOrderDetails.id}
                        className="px-5 py-2.5 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-md hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {updatingStatusId === selectedOrderDetails.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        ВЫДАТЬ (ЗАВЕРШИТЬ)
                      </button>
                    )}
                    {selectedOrderDetails.carrier !== 'Самовывоз' && selectedOrderDetails.status === 'Ожидает оформления' && (
                      <button 
                        onClick={() => handleSingleStatusChange(selectedOrderDetails.id, 'Оформлен')}
                        disabled={updatingStatusId === selectedOrderDetails.id}
                        className="px-5 py-2.5 bg-orange-500 text-white text-xs font-bold rounded-xl shadow-md hover:bg-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {updatingStatusId === selectedOrderDetails.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        ОФОРМИТЬ НАКЛАДНУЮ
                      </button>
                    )}
                    {selectedOrderDetails.status === 'Оформлен' && (
                      <button 
                        onClick={() => handleSingleStatusChange(selectedOrderDetails.id, 'Завершен')}
                        disabled={updatingStatusId === selectedOrderDetails.id}
                        className="px-5 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-md hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {updatingStatusId === selectedOrderDetails.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        ЗАВЕРШИТЬ ОТГРУЗКУ
                      </button>
                    )}
                  </div>
                  
                  <div className="relative">
                    <select 
                      value={selectedOrderDetails.status} 
                      onChange={(e) => handleSingleStatusChange(selectedOrderDetails.id, e.target.value)}
                      disabled={updatingStatusId === selectedOrderDetails.id}
                      className="w-full bg-white border-2 border-blue-200 text-slate-900 text-sm font-bold rounded-2xl p-3 focus:ring-0 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {STATUSES.filter(s => s !== 'Все').map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {updatingStatusId === selectedOrderDetails.id && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl">
                    <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Сборщик</span>
                    <span className="text-sm font-bold text-slate-800">{selectedOrderDetails.createdBy}</span>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl">
                    <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Время на сборку</span>
                    <span className="text-sm font-bold text-slate-800">{formatAssemblyTime(selectedOrderDetails.time_start, selectedOrderDetails.time_end)}</span>
                  </div>
                </div>

                {/* Logistics Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm text-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Объем</span>
                    <span className="text-sm font-black text-slate-900">{(Number(selectedOrderDetails.totalVolume) || 0).toFixed(4)} м³</span>
                  </div>
                  <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm text-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Общий вес</span>
                    <span className="text-sm font-black text-slate-900">{(Number(selectedOrderDetails.totalWeight) || 0).toFixed(1)} кг</span>
                  </div>
                  <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-sm text-center">
                    <span className="text-[9px] font-bold text-slate-400 uppercase block mb-1">MAX место</span>
                    <span className="text-sm font-black text-slate-900">
                      {selectedOrderDetails.places_data ? Math.max(...selectedOrderDetails.places_data.map((p:any) => Number(p.weight) || 0)) : 0} кг
                    </span>
                  </div>
                </div>

                {/* Places Table */}
                {selectedOrderDetails.places_data && selectedOrderDetails.places_data.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                      <Hash size={14} className="text-blue-500" />
                      Габариты мест
                    </h3>
                    <div className="space-y-2">
                      {selectedOrderDetails.places_data.map((place: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-black text-blue-500 bg-blue-50 w-6 h-6 flex items-center justify-center rounded-lg">{idx + 1}</span>
                            <span className="text-sm font-bold text-slate-700">
                              {Number(place.d || 0)} × {Number(place.w || 0)} × {Number(place.h || 0)} см
                            </span>
                          </div>
                          <span className="text-sm font-black text-slate-900">{place.weight} кг</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Финансовая информация */}
                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <span className="text-sm">💰 Финансовая информация</span>
                  </h3>
                  
                  {/* Сумма заказа без доставки */}
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
                    <span className="text-blue-800 font-medium">Сумма заказа (без доставки):</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={selectedOrderDetails.payment_sum || ''}
                        onChange={(e) => {
                          const newPaymentSum = Number(e.target.value);
                          const newProfit = newPaymentSum - (selectedOrderDetails.delivery_cost || 0);
                          setSelectedOrderDetails({
                            ...selectedOrderDetails,
                            payment_sum: newPaymentSum,
                            profit: newProfit
                          });
                        }}
                        className="w-32 px-3 py-1 text-right font-bold text-slate-900 bg-white border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="0"
                      />
                      <span className="text-blue-900 font-bold">₽</span>
                    </div>
                  </div>
                  
                  {/* Стоимость доставки */}
                  <div className="flex items-center justify-between p-3 bg-orange-50 rounded-xl">
                    <span className="text-orange-800 font-medium">Стоимость доставки:</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={selectedOrderDetails.delivery_cost || ''}
                        onChange={(e) => {
                          const newDeliveryCost = Number(e.target.value);
                          const newProfit = (selectedOrderDetails.payment_sum || 0) - newDeliveryCost;
                          setSelectedOrderDetails({
                            ...selectedOrderDetails,
                            delivery_cost: newDeliveryCost,
                            profit: newProfit
                          });
                        }}
                        className="w-32 px-3 py-1 text-right font-bold text-slate-900 bg-white border border-orange-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="0"
                      />
                      <span className="text-orange-900 font-bold">₽</span>
                    </div>
                  </div>
                  
                  {/* Чистая прибыль */}
                  <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl">
                    <span className="text-emerald-800 font-medium">Чистая прибыль:</span>
                    <span className="text-emerald-900 font-bold text-lg">
                      {((selectedOrderDetails.payment_sum || 0) - (selectedOrderDetails.delivery_cost || 0)).toLocaleString()} ₽
                    </span>
                  </div>
                  
                  {/* Кнопка сохранения финансов */}
                  <button
                    onClick={handleSaveFinance}
                    disabled={savingFinance}
                    className="w-full mt-2 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {savingFinance ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Сохранение...
                      </>
                    ) : (
                      'Сохранить финансы'
                    )}
                  </button>
                </div>

                {/* Danger Zone */}
                {user?.role === 'admin' && (
                  <div className="pt-6 border-t border-slate-100">
                    <button 
                      onClick={() => handleDeleteOrder(selectedOrderDetails.id)}
                      disabled={deletingOrderId === selectedOrderDetails.id}
                      className="w-full flex items-center justify-center gap-2 p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-black uppercase hover:bg-red-100 transition-all border border-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deletingOrderId === selectedOrderDetails.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Удаление...
                        </>
                      ) : (
                        <>
                          <Trash2 size={16} />
                          Удалить заказ навсегда
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}