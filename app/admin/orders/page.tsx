'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  getDocs
} from 'firebase/firestore';
import { format, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import { 
  CheckSquare, Square, X, ChevronDown, Package, 
  Clock, Hash, CheckCircle2, ArrowLeft, Trash2,
  ChevronRight, Loader2, Search, XCircle, User, Truck, Weight, Box, Calendar, DollarSign,
  Edit2, Save, Plus, Minus, Copy
} from 'lucide-react';
import { showToast } from '@/components/Toast';
import { ReturnManagement } from '@/components/returns/ReturnManagement';

const CARRIERS = ['Все', 'CDEK', 'DPD', 'Деловые линии', 'Почта России', 'ПЭК', 'Самовывоз', 'Образцы', 'OZON_FBS', 'Ярмарка Мастеров', 'Yandex Market', 'WB_FBS', 'AliExpress', 'Бийск', 'OZON_FBO', 'WB_FBO'];
const STATUSES = ['Все', 'Новый', 'Комплектация', 'Ожидает оформления', 'Готов к выдаче', 'Оформлен', 'Отправлен', 'Завершен', 'Выдан', 'Запрошен возврат', 'Возврат одобрен', 'Возврат получен', 'На повторной обработке', 'Повторная отправка'];

const PAGE_SIZE = 20;

// Интерфейс для места
interface Place {
  d: number;
  w: number;
  h: number;
  weight: number;
}

export default function AdminOrdersPage() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayLimit, setDisplayLimit] = useState(PAGE_SIZE);
  
  // States for loading indicators
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [savingFinance, setSavingFinance] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

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
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<any>(null);
  const [massStatusMenuOpen, setMassStatusMenuOpen] = useState(false);
  
  // Редактирование мест
  const [editingPlaces, setEditingPlaces] = useState<Place[]>([]);
  const [groupInput, setGroupInput] = useState('');
  const [groupD, setGroupD] = useState('');
  const [groupW, setGroupW] = useState('');
  const [groupH, setGroupH] = useState('');
  const [groupWeight, setGroupWeight] = useState('');

  // Загрузка всех заказов
  const loadAllOrders = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllOrders(data);
    } catch (error) {
      console.error('Error loading orders:', error);
      showToast('Ошибка при загрузке заказов', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllOrders();
  }, []);

  // Фильтрация на клиенте
  const filteredOrders = useMemo(() => {
    let filtered = [...allOrders];
    
    if (dateRange.start && dateRange.end) {
      const start = startOfDay(new Date(dateRange.start));
      const end = endOfDay(new Date(dateRange.end));
      filtered = filtered.filter(order => {
        const orderDate = order.createdAt?.seconds ? new Date(order.createdAt.seconds * 1000) : new Date(order.createdAt);
        if (isNaN(orderDate.getTime())) return false;
        return isWithinInterval(orderDate, { start, end });
      });
    }
    
    if (selectedCarrier !== 'Все') {
      filtered = filtered.filter(order => order.carrier === selectedCarrier);
    }
    
    if (selectedStatus !== 'Все') {
      filtered = filtered.filter(order => order.status === selectedStatus);
    }
    
    if (searchQuery.trim()) {
      const queryLower = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(order => 
        order.orderNumber?.toLowerCase().includes(queryLower)
      );
    }
    
    return filtered;
  }, [allOrders, dateRange, selectedCarrier, selectedStatus, searchQuery]);

  const displayedOrders = useMemo(() => {
    return filteredOrders.slice(0, displayLimit);
  }, [filteredOrders, displayLimit]);

  const hasMoreOrders = displayLimit < filteredOrders.length;

  const loadMore = () => {
    setDisplayLimit(prev => prev + PAGE_SIZE);
  };

  // Открытие редактирования
  const openEditMode = () => {
    if (!selectedOrderDetails) return;
    setEditFormData({
      orderNumber: selectedOrderDetails.orderNumber || '',
      carrier: selectedOrderDetails.carrier || '',
      quantity: selectedOrderDetails.quantity || 1,
      status: selectedOrderDetails.status || '',
      createdBy: selectedOrderDetails.createdBy || '',
      payment_sum: selectedOrderDetails.payment_sum || 0,
      delivery_cost: selectedOrderDetails.delivery_cost || 0,
      totalWeight: selectedOrderDetails.totalWeight || 0,
      totalVolume: selectedOrderDetails.totalVolume || 0
    });
    setEditingPlaces(selectedOrderDetails.places_data || []);
    setIsEditing(true);
  };

  // Закрытие редактирования
  const closeEditMode = () => {
    setIsEditing(false);
    setEditFormData(null);
    setEditingPlaces([]);
    setGroupInput('');
    setGroupD('');
    setGroupW('');
    setGroupH('');
    setGroupWeight('');
  };

  // Сохранение редактирования
  const handleSaveEdit = async () => {
    if (!selectedOrderDetails) return;
    
    setSavingEdit(true);
    try {
      const orderRef = doc(db, 'orders', selectedOrderDetails.id);
      
      const updateData: any = {
        orderNumber: editFormData.orderNumber || null,
        carrier: editFormData.carrier,
        quantity: Number(editFormData.quantity),
        status: editFormData.status,
        createdBy: editFormData.createdBy,
        payment_sum: Number(editFormData.payment_sum) || 0,
        delivery_cost: Number(editFormData.delivery_cost) || 0,
        profit: (Number(editFormData.payment_sum) || 0) - (Number(editFormData.delivery_cost) || 0),
        lastEdited: serverTimestamp(),
        lastEditedBy: user?.email
      };
      
      // Обновляем места
      if (editingPlaces.length > 0) {
        updateData.places_data = editingPlaces;
        
        // Пересчитываем вес и объем
        let totalWeight = 0;
        let totalVolume = 0;
        editingPlaces.forEach(place => {
          totalWeight += place.weight || 0;
          const volume = (place.d * place.w * place.h) / 1000000;
          totalVolume += volume;
        });
        updateData.totalWeight = totalWeight;
        updateData.totalVolume = totalVolume;
      } else {
        updateData.totalWeight = editFormData.totalWeight;
        updateData.totalVolume = editFormData.totalVolume;
      }
      
      await updateDoc(orderRef, updateData);
      
      setSelectedOrderDetails({
        ...selectedOrderDetails,
        ...updateData,
        places_data: editingPlaces
      });
      
      showToast('Заказ успешно обновлен', 'success');
      closeEditMode();
      loadAllOrders();
    } catch (error) {
      console.error('Error saving edit:', error);
      showToast('Ошибка при сохранении изменений', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  // Функции для редактирования мест
  const addPlace = () => {
    setEditingPlaces([...editingPlaces, { d: 0, w: 0, h: 0, weight: 0 }]);
  };

  const removePlace = (index: number) => {
    const newPlaces = [...editingPlaces];
    newPlaces.splice(index, 1);
    setEditingPlaces(newPlaces);
  };

  const updatePlace = (index: number, field: keyof Place, value: number) => {
    const newPlaces = [...editingPlaces];
    newPlaces[index] = { ...newPlaces[index], [field]: value };
    setEditingPlaces(newPlaces);
  };

  const applyToGroup = () => {
    if (!groupInput.trim()) return;
    
    const indices: number[] = [];
    const parts = groupInput.split(',').map(p => p.trim());
    
    parts.forEach(part => {
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(n => parseInt(n.trim()));
        if (!isNaN(start) && !isNaN(end)) {
          for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
            if (i >= 1 && i <= editingPlaces.length) indices.push(i - 1);
          }
        }
      } else {
        const n = parseInt(part);
        if (!isNaN(n) && n >= 1 && n <= editingPlaces.length) {
          indices.push(n - 1);
        }
      }
    });

    const newPlaces = [...editingPlaces];
    indices.forEach(idx => {
      if (groupD !== '') newPlaces[idx].d = parseFloat(groupD);
      if (groupW !== '') newPlaces[idx].w = parseFloat(groupW);
      if (groupH !== '') newPlaces[idx].h = parseFloat(groupH);
      if (groupWeight !== '') newPlaces[idx].weight = parseFloat(groupWeight);
    });
    setEditingPlaces(newPlaces);
  };

  const applyToAll = () => {
    if (editingPlaces.length === 0) return;
    const first = editingPlaces[0];
    const newPlaces = editingPlaces.map(() => ({ ...first }));
    setEditingPlaces(newPlaces);
  };

  const handleDeleteOrder = async (id: string) => {
    if (!window.confirm('Вы уверены, что хотите безвозвратно удалить этот заказ?')) return;
    
    setDeletingOrderId(id);
    try {
      await deleteDoc(doc(db, 'orders', id));
      setSelectedOrderDetails(null);
      showToast('Заказ успешно удален', 'success');
      loadAllOrders();
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
    if (selectedOrders.size === displayedOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(displayedOrders.map(o => o.id)));
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
        if (newStatus === 'Отправлен') updateData.shippedAt = serverTimestamp();
        if (newStatus === 'Выдан') updateData.issuedAt = serverTimestamp();
        batch.update(orderRef, updateData);
      });
      await batch.commit();
      
      setMassStatusMenuOpen(false);
      setSelectedOrders(new Set());
      showToast(`Статус ${selectedOrders.size} заказов изменен на "${newStatus}"`, 'success');
      loadAllOrders();
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
      if (newStatus === 'Отправлен') updateData.shippedAt = serverTimestamp();
      if (newStatus === 'Выдан') updateData.issuedAt = serverTimestamp();
      await updateDoc(orderRef, updateData);
      
      if (selectedOrderDetails?.id === id) {
        setSelectedOrderDetails({ ...selectedOrderDetails, status: newStatus });
      }
      
      showToast(`Статус заказа изменен на "${newStatus}"`, 'success');
      loadAllOrders();
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
      
      setSelectedOrderDetails({ ...selectedOrderDetails, payment_sum: paymentSum, delivery_cost: deliveryCost, profit });
      showToast('Финансовая информация сохранена', 'success');
      loadAllOrders();
    } catch (error) {
      console.error('Error saving finance:', error);
      showToast('Ошибка при сохранении финансов', 'error');
    } finally {
      setSavingFinance(false);
    }
  };

  const formatAssemblyTime = (start: any, end: any) => {
    if (!start || !end) return '-';
    const getTime = (t: any) => {
      if (typeof t.toDate === 'function') return t.toDate().getTime() / 1000;
      return new Date(t).getTime() / 1000;
    };
    const s = getTime(start);
    const e = getTime(end);
    const diff = Math.floor(e - s);
    if (diff < 0) return '-';
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Новый': return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300';
      case 'Комплектация': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300';
      case 'В работе': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300';
      case 'Ожидает оформления': return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300';
      case 'Готов к выдаче': return 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300';
      case 'Оформлен': return 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300';
      case 'Отправлен': return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300';
      case 'Выдан': return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300';
      case 'Завершен': return 'bg-slate-200 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300';
      case 'Запрошен возврат': return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300';
      case 'Возврат одобрен': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300';
      case 'Возврат получен': return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300';
      case 'На повторной обработке': return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300';
      case 'Повторная отправка': return 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  const clearSearch = () => setSearchQuery('');

  // Расчет общего веса и объема
  const getTotalVolume = (order: any) => {
    if (order.totalVolume) return order.totalVolume;
    if (order.places_data) {
      return order.places_data.reduce((acc: number, p: any) => {
        const v = (Number(p.d || 0) * Number(p.w || 0) * Number(p.h || 0)) / 1000000;
        return acc + (isNaN(v) ? 0 : v);
      }, 0);
    }
    return 0;
  };

  const getTotalWeight = (order: any) => {
    if (order.totalWeight) return order.totalWeight;
    if (order.places_data) {
      return order.places_data.reduce((acc: number, p: any) => acc + (Number(p.weight) || 0), 0);
    }
    return 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => router.back()} 
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <ArrowLeft size={24} className="text-slate-700 dark:text-slate-300" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Управление заказами</h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Всего: {allOrders.length} заказов • Отфильтровано: {filteredOrders.length}
                {filteredOrders.length > displayLimit && <span className="ml-2 text-blue-500">(показано {displayLimit})</span>}
              </p>
            </div>
          </div>
          <div className="hidden md:block text-sm font-semibold text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400 px-3 py-1 rounded-lg">
            Панель администратора
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {/* Поиск и фильтры */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
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
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">От даты</label>
              <input type="date" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">До даты</label>
              <input type="date" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Компания</label>
              <select value={selectedCarrier} onChange={(e) => setSelectedCarrier(e.target.value)}
                className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none cursor-pointer">
                {CARRIERS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Статус</label>
              <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}
                className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none cursor-pointer">
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 gap-4">
          <div className="flex items-center gap-3">
            <button onClick={toggleAllSelection} className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-300 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700">
              {selectedOrders.size === displayedOrders.length && displayedOrders.length > 0 ? 
                <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5 text-slate-300" />}
              Выбрать все
            </button>
            <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-700 hidden md:block" />
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Найдено: <b className="text-slate-900 dark:text-white">{filteredOrders.length}</b></span>
          </div>

          <div className="relative w-full md:w-auto">
            <button 
              onClick={() => setMassStatusMenuOpen(!massStatusMenuOpen)} 
              disabled={selectedOrders.size === 0 || bulkUpdating}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 dark:bg-slate-800 text-white rounded-2xl text-sm font-bold hover:bg-black disabled:opacity-30 transition-all shadow-lg shadow-slate-200 dark:shadow-slate-800"
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
                  className="absolute right-0 mt-3 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden z-40 p-1">
                  {STATUSES.filter(s => s !== 'Все').map(status => (
                    <button key={status} onClick={() => handleMassStatusChange(status)}
                      className="w-full text-left px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-700 dark:hover:text-blue-400 rounded-xl transition-all">
                      {status}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Main Table */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-slate-400 text-[11px] font-bold uppercase tracking-widest border-b border-slate-100 dark:border-slate-700">
                  <th className="p-5 w-14"></th>
                  <th className="p-5">Дата</th>
                  <th className="p-5">Заказ</th>
                  <th className="p-5">ТК</th>
                  <th className="p-5">Статус</th>
                  <th className="p-5">Сборщик</th>
                  <th className="p-5 text-center">Время</th>
                  <th className="p-5 text-right">Вес</th>
                  <th className="p-5 text-right">Прибыль</th>
                  <th className="p-5 text-right w-12"></th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {displayedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-20 text-center text-slate-400 dark:text-slate-500 font-medium">
                      {searchQuery ? 'Заказы не найдены по запросу' : 'Заказы не найдены за этот период'}
                    </td>
                  </tr>
                ) : (
                  displayedOrders.map(order => (
                    <tr key={order.id} onClick={() => setSelectedOrderDetails(order)}
                      className={`group hover:bg-blue-50/30 dark:hover:bg-blue-950/30 transition-all cursor-pointer ${selectedOrders.has(order.id) ? 'bg-blue-50 dark:bg-blue-950/20' : ''}`}>
                      <td className="p-5" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => toggleOrderSelection(order.id)} className="transition-transform active:scale-90">
                          {selectedOrders.has(order.id) ? <CheckSquare className="w-6 h-6 text-blue-600" /> : <Square className="w-6 h-6 text-slate-200 group-hover:text-slate-300" />}
                        </button>
                      </td>
                      <td className="p-5 text-slate-500 dark:text-slate-400 text-xs font-medium whitespace-nowrap">
                        {order.createdAt ? format(order.createdAt?.seconds ? new Date(order.createdAt.seconds * 1000) : new Date(order.createdAt), 'dd.MM.yy HH:mm') : '-'}
                      </td>
                      <td className="p-5 font-bold text-slate-900 dark:text-white">{order.orderNumber || '—'}</td>
                      <td className="p-5 text-slate-600 dark:text-slate-400 font-semibold text-xs uppercase">{order.carrier}</td>
                      <td className="p-5">
                        <span className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border uppercase tracking-tight ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="p-5 text-slate-600 dark:text-slate-400 text-xs font-medium truncate max-w-[120px]">{order.createdBy?.split('@')[0] || order.createdBy || 'Система'}</td>
                      <td className="p-5 text-center font-mono text-xs text-slate-500 dark:text-slate-400">{formatAssemblyTime(order.time_start, order.time_end)}</td>
                      <td className="p-5 text-right font-bold text-slate-900 dark:text-white">{order.totalWeight ? `${Number(order.totalWeight).toFixed(1)} кг` : '—'}</td>
                      <td className="p-5 text-right font-bold text-emerald-600 dark:text-emerald-400">{order.profit ? `${order.profit.toLocaleString()} ₽` : '—'}</td>
                      <td className="p-5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrderDetails(order);
                            openEditMode();
                          }}
                          className="p-2 text-slate-400 hover:text-blue-600 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
          {/* Pagination Controls */}
          {!loading && filteredOrders.length > 0 && hasMoreOrders && (
            <div className="flex items-center justify-center px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30">
              <button
                onClick={loadMore}
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-all"
              >
                <ChevronRight className="w-4 h-4" />
                Показать еще {Math.min(PAGE_SIZE, filteredOrders.length - displayLimit)} заказов
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Модальное окно деталей заказа */}
      <AnimatePresence>
        {selectedOrderDetails && (
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={() => { setSelectedOrderDetails(null); closeEditMode(); }}>
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()} className="bg-white dark:bg-slate-900 h-full w-full max-w-2xl shadow-2xl flex flex-col relative">
              
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                    {isEditing ? 'Редактирование заказа' : `Заказ ${selectedOrderDetails.orderNumber}`}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{selectedOrderDetails.carrier}</p>
                </div>
                <div className="flex gap-2">
                  {!isEditing && (
                    <button onClick={openEditMode} className="p-2 bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-xl transition-colors" title="Редактировать">
                      <Edit2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </button>
                  )}
                  <button onClick={() => { setSelectedOrderDetails(null); closeEditMode(); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {isEditing ? (
                  // Режим редактирования
                  <div className="space-y-6">
                    {/* Основные поля */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Номер заказа</label>
                        <input type="text" value={editFormData?.orderNumber || ''} onChange={(e) => setEditFormData({ ...editFormData, orderNumber: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Транспортная компания</label>
                        <select value={editFormData?.carrier || ''} onChange={(e) => setEditFormData({ ...editFormData, carrier: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                          {CARRIERS.filter(c => c !== 'Все').map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Количество мест</label>
                        <input type="number" value={editFormData?.quantity || 1} onChange={(e) => setEditFormData({ ...editFormData, quantity: parseInt(e.target.value) })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Статус</label>
                        <select value={editFormData?.status || ''} onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                          {STATUSES.filter(s => s !== 'Все').map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Сборщик (email)</label>
                        <input type="email" value={editFormData?.createdBy || ''} onChange={(e) => setEditFormData({ ...editFormData, createdBy: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                      </div>
                    </div>

                    {/* Финансы */}
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                      <h3 className="font-bold text-slate-900 dark:text-white mb-3">Финансы</h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Сумма оплаты (без доставки)</label>
                          <input type="number" value={editFormData?.payment_sum || 0} onChange={(e) => setEditFormData({ ...editFormData, payment_sum: parseInt(e.target.value) })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 mb-1">Стоимость доставки</label>
                          <input type="number" value={editFormData?.delivery_cost || 0} onChange={(e) => setEditFormData({ ...editFormData, delivery_cost: parseInt(e.target.value) })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                        </div>
                      </div>
                    </div>

                    {/* Редактирование мест */}
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-slate-900 dark:text-white">Габариты мест</h3>
                        <button onClick={addPlace} className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded-lg">
                          <Plus className="w-3 h-3" /> Добавить место
                        </button>
                      </div>
                      
                      {/* Групповой ввод */}
                      <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl mb-4">
                        <p className="text-xs font-medium text-slate-600 mb-2">Групповой ввод</p>
                        <div className="grid grid-cols-5 gap-2 mb-2">
                          <input type="text" placeholder="Диапазон (1-3,5)" value={groupInput} onChange={(e) => setGroupInput(e.target.value)} className="col-span-2 px-2 py-1 text-xs rounded-lg border border-slate-200" />
                          <input type="number" placeholder="Д" value={groupD} onChange={(e) => setGroupD(e.target.value)} className="px-2 py-1 text-xs rounded-lg border border-slate-200" />
                          <input type="number" placeholder="Ш" value={groupW} onChange={(e) => setGroupW(e.target.value)} className="px-2 py-1 text-xs rounded-lg border border-slate-200" />
                          <input type="number" placeholder="В" value={groupH} onChange={(e) => setGroupH(e.target.value)} className="px-2 py-1 text-xs rounded-lg border border-slate-200" />
                          <input type="number" placeholder="Вес" value={groupWeight} onChange={(e) => setGroupWeight(e.target.value)} className="px-2 py-1 text-xs rounded-lg border border-slate-200" />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={applyToGroup} className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded-lg">Применить к группе</button>
                          <button onClick={applyToAll} className="flex-1 px-2 py-1 text-xs border border-blue-600 text-blue-600 rounded-lg">Всем как №1</button>
                        </div>
                      </div>
                      
                      {/* Список мест */}
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {editingPlaces.map((place, idx) => (
                          <div key={idx} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                            <span className="w-8 text-xs font-bold text-blue-600">#{idx + 1}</span>
                            <input type="number" value={place.d} onChange={(e) => updatePlace(idx, 'd', parseFloat(e.target.value))} placeholder="Д" className="w-16 px-2 py-1 text-xs rounded-lg border border-slate-200" />
                            <input type="number" value={place.w} onChange={(e) => updatePlace(idx, 'w', parseFloat(e.target.value))} placeholder="Ш" className="w-16 px-2 py-1 text-xs rounded-lg border border-slate-200" />
                            <input type="number" value={place.h} onChange={(e) => updatePlace(idx, 'h', parseFloat(e.target.value))} placeholder="В" className="w-16 px-2 py-1 text-xs rounded-lg border border-slate-200" />
                            <input type="number" value={place.weight} onChange={(e) => updatePlace(idx, 'weight', parseFloat(e.target.value))} placeholder="Вес" className="w-16 px-2 py-1 text-xs rounded-lg border border-slate-200" />
                            <button onClick={() => removePlace(idx)} className="p-1 text-red-500 hover:bg-red-50 rounded"><Minus className="w-3 h-3" /></button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Кнопки сохранения/отмены */}
                    <div className="flex gap-3 pt-4">
                      <button onClick={closeEditMode} className="flex-1 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-medium">Отмена</button>
                      <button onClick={handleSaveEdit} disabled={savingEdit} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium flex items-center justify-center gap-2">
                        {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Сохранить изменения
                      </button>
                    </div>
                  </div>
                ) : (
                  // Режим просмотра
                  <div className="space-y-6">
                    {/* Информация о заказе */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                        <div className="flex items-center gap-2 text-slate-500 mb-1"><User className="w-4 h-4" /><span className="text-[10px] font-black">Сборщик</span></div>
                        <p className="font-bold">{selectedOrderDetails.createdBy?.split('@')[0] || selectedOrderDetails.createdBy || '—'}</p>
                      </div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                        <div className="flex items-center gap-2 text-slate-500 mb-1"><Clock className="w-4 h-4" /><span className="text-[10px] font-black">Время сборки</span></div>
                        <p className="font-bold font-mono">{formatAssemblyTime(selectedOrderDetails.time_start, selectedOrderDetails.time_end)}</p>
                      </div>
                    </div>

                    {/* Логистика */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-white dark:bg-slate-800 border rounded-2xl text-center"><Box className="w-4 h-4 mx-auto mb-1 text-slate-400" /><p className="text-xs text-slate-500">Мест</p><p className="font-bold">{selectedOrderDetails.quantity || 0}</p></div>
                      <div className="p-3 bg-white dark:bg-slate-800 border rounded-2xl text-center"><Weight className="w-4 h-4 mx-auto mb-1 text-slate-400" /><p className="text-xs text-slate-500">Вес</p><p className="font-bold">{getTotalWeight(selectedOrderDetails).toFixed(2)} кг</p></div>
                      <div className="p-3 bg-white dark:bg-slate-800 border rounded-2xl text-center"><Package className="w-4 h-4 mx-auto mb-1 text-slate-400" /><p className="text-xs text-slate-500">Объем</p><p className="font-bold">{getTotalVolume(selectedOrderDetails).toFixed(4)} м³</p></div>
                    </div>

                    {/* Габариты мест */}
                    {selectedOrderDetails.places_data && selectedOrderDetails.places_data.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase flex items-center gap-2"><Hash size={14} className="text-blue-500" />Габариты мест</h3>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {selectedOrderDetails.places_data.map((place: any, idx: number) => (
                            <div key={idx} className="flex justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm">
                              <span className="font-medium">Место {idx + 1}: {place.d || 0}×{place.w || 0}×{place.h || 0} см</span>
                              <span className="font-bold">{place.weight || 0} кг</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Финансы */}
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                      <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2"><DollarSign className="w-4 h-4 text-emerald-500" />Финансовая информация</h3>
                      <div className="flex justify-between p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl"><span className="text-blue-800">Сумма заказа:</span><span className="font-bold">{selectedOrderDetails.payment_sum?.toLocaleString() || 0} ₽</span></div>
                      <div className="flex justify-between p-3 bg-orange-50 dark:bg-orange-950/30 rounded-xl"><span className="text-orange-800">Стоимость доставки:</span><span className="font-bold">{selectedOrderDetails.delivery_cost?.toLocaleString() || 0} ₽</span></div>
                      <div className="flex justify-between p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl"><span className="text-emerald-800">Чистая прибыль:</span><span className="font-bold text-lg">{((selectedOrderDetails.payment_sum || 0) - (selectedOrderDetails.delivery_cost || 0)).toLocaleString()} ₽</span></div>
                      <button onClick={handleSaveFinance} disabled={savingFinance} className="w-full py-2 bg-blue-600 text-white rounded-xl text-sm font-medium">{savingFinance ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Сохранить финансы'}</button>
                    </div>

                    {/* Управление возвратами */}
                    <ReturnManagement order={selectedOrderDetails} onUpdate={loadAllOrders} />

                    {/* Управление статусом */}
                    <div className="bg-blue-50 dark:bg-blue-950/30 p-5 rounded-3xl space-y-4">
                      <div className="flex items-center gap-2 text-blue-700"><CheckCircle2 size={18} /><span className="text-xs font-black uppercase">Управление статусом</span></div>
                      <div className="flex flex-wrap gap-2">
                        {selectedOrderDetails.carrier === 'Самовывоз' && selectedOrderDetails.status === 'Готов к выдаче' && (
                          <button onClick={() => handleSingleStatusChange(selectedOrderDetails.id, 'Выдан')} disabled={updatingStatusId === selectedOrderDetails.id} className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl">{updatingStatusId === selectedOrderDetails.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'ВЫДАТЬ КЛИЕНТУ'}</button>
                        )}
                        {selectedOrderDetails.carrier !== 'Самовывоз' && selectedOrderDetails.status === 'Ожидает оформления' && (
                          <button onClick={() => handleSingleStatusChange(selectedOrderDetails.id, 'Оформлен')} disabled={updatingStatusId === selectedOrderDetails.id} className="px-4 py-2 bg-orange-500 text-white text-xs font-bold rounded-xl">{updatingStatusId === selectedOrderDetails.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'ОФОРМИТЬ НАКЛАДНУЮ'}</button>
                        )}
                        {selectedOrderDetails.status === 'Оформлен' && (
                          <button onClick={() => handleSingleStatusChange(selectedOrderDetails.id, 'Отправлен')} disabled={updatingStatusId === selectedOrderDetails.id} className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl">{updatingStatusId === selectedOrderDetails.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'ОТМЕТИТЬ ОТПРАВЛЕННЫМ'}</button>
                        )}
                      </div>
                      <select value={selectedOrderDetails.status} onChange={(e) => handleSingleStatusChange(selectedOrderDetails.id, e.target.value)} disabled={updatingStatusId === selectedOrderDetails.id} className="w-full bg-white border-2 border-blue-200 text-sm font-bold rounded-2xl p-3">
                        {STATUSES.filter(s => s !== 'Все').map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>

                    {/* История изменений */}
                    {selectedOrderDetails.history && selectedOrderDetails.history.length > 0 && (
                      <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                        <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3"><Clock className="w-4 h-4 text-slate-400" />История изменений</h3>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {selectedOrderDetails.history.slice().reverse().map((item: any, idx: number) => (
                            <div key={idx} className="flex items-start gap-3 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                              <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-500 shrink-0"></div>
                              <div className="flex-1"><div className="flex justify-between"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getStatusColor(item.status)}`}>{item.status}</span><span className="text-[10px] text-slate-500">{format(new Date(item.timestamp), 'dd.MM.yyyy HH:mm')}</span></div><p className="text-[10px] text-slate-500 mt-0.5">{item.user}</p></div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Danger Zone */}
                    <div className="pt-4 border-t border-red-200 dark:border-red-800">
                      <button onClick={() => handleDeleteOrder(selectedOrderDetails.id)} disabled={deletingOrderId === selectedOrderDetails.id} className="w-full flex items-center justify-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 text-red-600 rounded-xl text-xs font-bold uppercase hover:bg-red-100 transition-all">
                        {deletingOrderId === selectedOrderDetails.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 size={14} />}
                        Удалить заказ навсегда
                      </button>
                    </div>
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