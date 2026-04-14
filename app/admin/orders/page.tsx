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
  getDocs,
  getDoc,
  where,
  QueryConstraint,
  startAfter,
  limit,
  DocumentSnapshot
} from 'firebase/firestore';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { ru } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { useRouter } from 'next/navigation';
import { 
  CheckSquare, Square, X, ChevronDown, Package, 
  Clock, Hash, CheckCircle2, ArrowLeft, Trash2,
  ChevronRight, Loader2, Search, XCircle, User, Truck, Weight, Box, Calendar, DollarSign,
  Edit2, Save, Plus, Minus, Copy, Filter, Layers, ExternalLink, Store
} from 'lucide-react';
import { showToast } from '@/components/Toast';
import { ReturnManagement } from '@/components/returns/ReturnManagement';
import { useInView } from 'react-intersection-observer';
import Link from 'next/link';

const CARRIERS = ['Все', 'CDEK', 'DPD', 'Деловые линии', 'Почта России', 'ПЭК', 'Самовывоз', 'Образцы', 'OZON_FBS', 'Ярмарка Мастеров', 'Yandex Market', 'WB_FBS', 'AliExpress', 'Бийск', 'OZON_FBO', 'WB_FBO'];

// Статусы для ТК (транспортных компаний)
const TK_STATUSES = ['Новый', 'Комплектация', 'Ожидает оформления', 'Оформлен', 'Отправлен', 'В консолидации'];

// Статусы для самовывоза
const PICKUP_STATUSES = ['Новый', 'Готов к выдаче', 'Выдан'];

// Все статусы для фильтрации
const ALL_STATUSES = ['Все', ...new Set([...TK_STATUSES, ...PICKUP_STATUSES, 'Запрошен возврат', 'Возврат одобрен', 'Возврат получен', 'На повторной обработке', 'Повторная отправка', 'Завершен'])];

const PAGE_SIZE = 20;

// Интерфейс для места
interface Place {
  d: number;
  w: number;
  h: number;
  weight: number;
}

interface Order {
  id: string;
  orderNumber?: string;
  carrier: string;
  status: string;
  createdAt: any;
  createdBy: string;
  quantity?: number;
  totalWeight?: number;
  totalVolume?: number;
  payment_sum?: number;
  delivery_cost?: number;
  profit?: number;
  time_start?: any;
  time_end?: any;
  places_data?: Place[];
  history?: Array<{
    status: string;
    previousStatus?: string;
    timestamp: string;
    user: string;
    action?: string;
    consolidationId?: string;
    consolidationNumber?: string;
    comment?: string;
  }>;
  consolidationId?: string;
  consolidationNumber?: string;
  registeredAt?: any;
  shippedAt?: any;
  issuedAt?: any;
  completedAt?: any;
  lastEdited?: any;
  lastEditedBy?: string;
}

interface Filters {
  startDate: string;
  endDate: string;
  carrier: string;
  status: string;
  searchQuery: string;
}

// Хук для пагинированной загрузки заказов
function usePaginatedOrders(filters: Filters) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buildConstraints = useCallback((): QueryConstraint[] => {
    const constraints: QueryConstraint[] = [];

    if (filters.startDate && filters.endDate) {
      const start = startOfDay(new Date(filters.startDate));
      const end = endOfDay(new Date(filters.endDate));
      constraints.push(where('createdAt', '>=', start.toISOString()));
      constraints.push(where('createdAt', '<=', end.toISOString()));
    }

    if (filters.carrier && filters.carrier !== 'Все') {
      constraints.push(where('carrier', '==', filters.carrier));
    }

    if (filters.status && filters.status !== 'Все') {
      constraints.push(where('status', '==', filters.status));
    }

    if (filters.searchQuery && filters.searchQuery.trim()) {
      const searchTerm = filters.searchQuery.trim();
      const endTerm = searchTerm + '\uf8ff';
      constraints.push(where('orderNumber', '>=', searchTerm));
      constraints.push(where('orderNumber', '<=', endTerm));
    }

    constraints.push(orderBy('createdAt', 'desc'));

    return constraints;
  }, [filters]);

  const loadInitialOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const constraints = buildConstraints();
      const q = query(
        collection(db, 'orders'),
        ...constraints,
        limit(PAGE_SIZE)
      );
      
      const snapshot = await getDocs(q);
      const newOrders = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as Order));
      
      setOrders(newOrders);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
      
      if (newOrders.length > 0) {
        const countQuery = query(collection(db, 'orders'), ...constraints);
        const countSnapshot = await getDocs(countQuery);
        setTotalCount(countSnapshot.size);
      }
    } catch (err) {
      console.error('Error loading orders:', err);
      setError('Ошибка при загрузке заказов');
      showToast('Ошибка при загрузке заказов', 'error');
    } finally {
      setLoading(false);
    }
  }, [buildConstraints]);

  const loadMoreOrders = useCallback(async () => {
    if (!hasMore || loadingMore || loading) return;
    
    setLoadingMore(true);
    
    try {
      const constraints = buildConstraints();
      let q = query(
        collection(db, 'orders'),
        ...constraints,
        limit(PAGE_SIZE)
      );
      
      if (lastDoc) {
        q = query(q, startAfter(lastDoc));
      }
      
      const snapshot = await getDocs(q);
      const newOrders = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as Order));
      
      setOrders(prev => [...prev, ...newOrders]);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
    } catch (err) {
      console.error('Error loading more orders:', err);
      showToast('Ошибка при загрузке дополнительных заказов', 'error');
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, loading, lastDoc, buildConstraints]);

  useEffect(() => {
    loadInitialOrders();
  }, [loadInitialOrders]);

  return {
    orders,
    loading,
    loadingMore,
    hasMore,
    totalCount,
    error,
    loadMore: loadMoreOrders,
    refresh: loadInitialOrders
  };
}

export default function AdminOrdersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { ref: loadMoreRef, inView } = useInView();
  
  const [filters, setFilters] = useState<Filters>({
    startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    carrier: 'Все',
    status: 'Все',
    searchQuery: '',
  });
  
  const { 
    orders, 
    loading, 
    loadingMore, 
    hasMore, 
    totalCount,
    error,
    loadMore,
    refresh 
  } = usePaginatedOrders(filters);
  
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<Order | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<any>(null);
  const [editingPlaces, setEditingPlaces] = useState<Place[]>([]);
  const [massStatusMenuOpen, setMassStatusMenuOpen] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [savingFinance, setSavingFinance] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  
  const [groupInput, setGroupInput] = useState('');
  const [groupD, setGroupD] = useState('');
  const [groupW, setGroupW] = useState('');
  const [groupH, setGroupH] = useState('');
  const [groupWeight, setGroupWeight] = useState('');
  
  useEffect(() => {
    if (inView && hasMore && !loadingMore) {
      loadMore();
    }
  }, [inView, hasMore, loadingMore, loadMore]);

  // Функция для получения доступных статусов в зависимости от типа заказа
  const getAvailableStatuses = (carrier: string): string[] => {
    if (carrier === 'Самовывоз') {
      return PICKUP_STATUSES;
    }
    return TK_STATUSES;
  };

  // Функция для проверки допустимости статуса
  const isValidStatusForCarrier = (status: string, carrier: string): boolean => {
    const availableStatuses = getAvailableStatuses(carrier);
    return availableStatuses.includes(status);
  };

  if (loading && orders.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setSelectedOrders(new Set());
  };
  
  const clearSearch = () => handleFilterChange('searchQuery', '');
  const resetDateFilter = () => {
    setFilters(prev => ({
      ...prev,
      startDate: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
      endDate: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    }));
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
    if (selectedOrders.size === orders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(orders.map(o => o.id)));
    }
  };

  const handleMassStatusChange = async (newStatus: string) => {
    if (selectedOrders.size === 0) return;
    
    const selectedOrdersList = orders.filter(o => selectedOrders.has(o.id));
    
    for (const order of selectedOrdersList) {
      if (!isValidStatusForCarrier(newStatus, order.carrier)) {
        showToast(`Статус "${newStatus}" недоступен для заказа ${order.orderNumber} (${order.carrier})`, 'warning');
        return;
      }
    }
    
    setBulkUpdating(true);
    try {
      const batch = writeBatch(db);
      
      for (const order of selectedOrdersList) {
        const orderRef = doc(db, 'orders', order.id);
        const orderSnap = await getDoc(orderRef);
        
        if (!orderSnap.exists()) continue;
        
        const currentData = orderSnap.data();
        
        const historyEntry = {
          status: newStatus,
          previousStatus: order.status,
          timestamp: new Date().toISOString(),
          user: user?.email || 'system',
        };
        
        const currentHistory = currentData.history || [];
        const updatedHistory = [...currentHistory, historyEntry];
        
        const updateData: any = {
          status: newStatus,
          history: updatedHistory,
          lastUpdated: serverTimestamp(),
        };
        
        if (newStatus === 'Оформлен') updateData.registeredAt = serverTimestamp();
        if (newStatus === 'Отправлен') updateData.shippedAt = serverTimestamp();
        if (newStatus === 'Выдан') {
          updateData.issuedAt = serverTimestamp();
          updateData.completedAt = serverTimestamp();
        }
        
        batch.update(orderRef, updateData);
      }
      
      await batch.commit();
      
      setMassStatusMenuOpen(false);
      setSelectedOrders(new Set());
      showToast(`Статус ${selectedOrders.size} заказов изменен на "${newStatus}"`, 'success');
      refresh();
    } catch (error) {
      console.error('Error bulk updating status:', error);
      showToast('Ошибка при массовом изменении статусов: ' + (error as Error).message, 'error');
    } finally {
      setBulkUpdating(false);
    }
  };

  const handleSingleStatusChange = async (id: string, newStatus: string) => {
    console.log('handleSingleStatusChange called:', { id, newStatus });
    
    const order = orders.find(o => o.id === id) || selectedOrderDetails;
    if (!order) {
      console.error('Order not found for id:', id);
      showToast('Заказ не найден', 'error');
      return;
    }
    
    console.log('Current order:', { status: order.status, carrier: order.carrier, orderNumber: order.orderNumber });
    
    if (!isValidStatusForCarrier(newStatus, order.carrier)) {
      console.warn('Invalid status for carrier:', newStatus, order.carrier);
      showToast(`Статус "${newStatus}" недоступен для ${order.carrier}`, 'warning');
      return;
    }
    
    setUpdatingStatusId(id);
    
    try {
      const orderRef = doc(db, 'orders', id);
      const orderSnap = await getDoc(orderRef);
      
      if (!orderSnap.exists()) {
        throw new Error('Документ заказа не найден');
      }
      
      const currentData = orderSnap.data();
      
      const historyEntry = {
        status: newStatus,
        previousStatus: order.status,
        timestamp: new Date().toISOString(),
        user: user?.email || 'system',
      };
      
      const currentHistory = currentData.history || [];
      const updatedHistory = [...currentHistory, historyEntry];
      
      const updateData: any = { 
        status: newStatus,
        history: updatedHistory,
        lastUpdated: serverTimestamp(),
      };
      
      if (newStatus === 'Оформлен') {
        updateData.registeredAt = serverTimestamp();
      }
      
      if (newStatus === 'Отправлен') {
        updateData.shippedAt = serverTimestamp();
      }
      
      if (newStatus === 'Выдан') {
        updateData.issuedAt = serverTimestamp();
        updateData.completedAt = serverTimestamp();
      }
      
      console.log('Updating order with data:', updateData);
      await updateDoc(orderRef, updateData);
      
      if (selectedOrderDetails?.id === id) {
        setSelectedOrderDetails({ 
          ...selectedOrderDetails, 
          status: newStatus, 
          history: updatedHistory,
          ...(newStatus === 'Оформлен' && { registeredAt: new Date() }),
          ...(newStatus === 'Отправлен' && { shippedAt: new Date() }),
          ...(newStatus === 'Выдан' && { issuedAt: new Date(), completedAt: new Date() })
        });
      }
      
      showToast(`Статус изменен: ${order.status} → ${newStatus}`, 'success');
      refresh();
      
    } catch (error) {
      console.error('Error updating status:', error);
      showToast('Ошибка при изменении статуса: ' + (error as Error).message, 'error');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleDeleteOrder = async (id: string) => {
    if (!window.confirm('Вы уверены, что хотите безвозвратно удалить этот заказ?')) return;
    
    setDeletingOrderId(id);
    try {
      await deleteDoc(doc(db, 'orders', id));
      setSelectedOrderDetails(null);
      showToast('Заказ успешно удален', 'success');
      refresh();
    } catch (error) {
      console.error('Error deleting order:', error);
      showToast('Ошибка при удалении заказа', 'error');
    } finally {
      setDeletingOrderId(null);
    }
  };

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
      totalVolume: selectedOrderDetails.totalVolume || 0,
    });
    setEditingPlaces(selectedOrderDetails.places_data || []);
    setIsEditing(true);
  };

  const closeEditMode = () => {
    setIsEditing(false);
    setEditFormData(null);
    setEditingPlaces([]);
  };

  const handleSaveEdit = async () => {
    if (!selectedOrderDetails) return;

    setSavingEdit(true);
    try {
      const orderRef = doc(db, 'orders', selectedOrderDetails.id);
      const statusChanged = editFormData.status !== selectedOrderDetails.status;

      if (!isValidStatusForCarrier(editFormData.status, editFormData.carrier)) {
        showToast(`Статус "${editFormData.status}" недоступен для ${editFormData.carrier}`, 'warning');
        setSavingEdit(false);
        return;
      }

      const orderSnap = await getDoc(orderRef);
      if (!orderSnap.exists()) {
        throw new Error('Документ заказа не найден');
      }
      
      const currentData = orderSnap.data();

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
        lastEditedBy: user?.email || 'system',
      };

      if (statusChanged) {
        const historyEntry = {
          status: editFormData.status,
          previousStatus: selectedOrderDetails.status,
          timestamp: new Date().toISOString(),
          user: user?.email || 'system',
        };
        
        const currentHistory = currentData.history || [];
        updateData.history = [...currentHistory, historyEntry];
        
        if (editFormData.status === 'Оформлен') updateData.registeredAt = serverTimestamp();
        if (editFormData.status === 'Отправлен') updateData.shippedAt = serverTimestamp();
        if (editFormData.status === 'Выдан') {
          updateData.issuedAt = serverTimestamp();
          updateData.completedAt = serverTimestamp();
        }
      }

      if (editingPlaces.length > 0) {
        updateData.places_data = editingPlaces;
        let totalWeight = 0;
        let totalVolume = 0;
        editingPlaces.forEach(place => {
          totalWeight += place.weight || 0;
          const volume = (place.d * place.w * place.h) / 1000000;
          totalVolume += volume;
        });
        updateData.totalWeight = totalWeight;
        updateData.totalVolume = totalVolume;
      }

      await updateDoc(orderRef, updateData);

      const updatedOrderDetails: Order = {
        ...selectedOrderDetails,
        ...editFormData,
        places_data: editingPlaces,
        profit: (Number(editFormData.payment_sum) || 0) - (Number(editFormData.delivery_cost) || 0),
      };

      if (updateData.totalWeight) updatedOrderDetails.totalWeight = updateData.totalWeight;
      if (updateData.totalVolume) updatedOrderDetails.totalVolume = updateData.totalVolume;

      if (statusChanged) {
        updatedOrderDetails.history = updateData.history;
        if (editFormData.status === 'Оформлен') updatedOrderDetails.registeredAt = new Date();
        if (editFormData.status === 'Отправлен') updatedOrderDetails.shippedAt = new Date();
        if (editFormData.status === 'Выдан') {
          updatedOrderDetails.issuedAt = new Date();
          updatedOrderDetails.completedAt = new Date();
        }
      }

      setSelectedOrderDetails(updatedOrderDetails);

      showToast('Заказ успешно обновлен', 'success');
      closeEditMode();
      refresh();
    } catch (error) {
      console.error('Error saving edit:', error);
      showToast('Ошибка при сохранении изменений: ' + (error as Error).message, 'error');
    } finally {
      setSavingEdit(false);
    }
  };

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
      refresh();
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
      case 'Ожидает оформления': return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300';
      case 'Готов к выдаче': return 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300';
      case 'Оформлен': return 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300';
      case 'Отправлен': return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300';
      case 'Выдан': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300';
      case 'В консолидации': return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'Завершен': return 'bg-slate-200 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300';
      case 'Запрошен возврат': return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300';
      case 'Возврат одобрен': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300';
      case 'Возврат получен': return 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300';
      case 'На повторной обработке': return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300';
      case 'Повторная отправка': return 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  const getTotalVolume = (order: Order) => {
    if (order.totalVolume) return order.totalVolume;
    if (order.places_data) {
      return order.places_data.reduce((acc, p) => {
        const v = (Number(p.d || 0) * Number(p.w || 0) * Number(p.h || 0)) / 1000000;
        return acc + (isNaN(v) ? 0 : v);
      }, 0);
    }
    return 0;
  };

  const getTotalWeight = (order: Order) => {
    if (order.totalWeight) return order.totalWeight;
    if (order.places_data) {
      return order.places_data.reduce((acc, p) => acc + (Number(p.weight) || 0), 0);
    }
    return 0;
  };

  const formatHistoryTimestamp = (timestamp: any) => {
    if (!timestamp) return '—';
    
    try {
      let date: Date;
      
      if (typeof timestamp === 'string') {
        date = new Date(timestamp);
      } else if (timestamp instanceof Date) {
        date = timestamp;
      } else if (timestamp.seconds) {
        date = new Date(timestamp.seconds * 1000);
      } else {
        return '—';
      }
      
      if (isNaN(date.getTime())) return '—';
      
      const now = new Date();
      const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
      
      if (diffInHours < 24 && date.getDate() === now.getDate()) {
        return `Сегодня, ${format(date, 'HH:mm')}`;
      }
      
      if (diffInHours < 48 && date.getDate() === now.getDate() - 1) {
        return `Вчера, ${format(date, 'HH:mm')}`;
      }
      
      if (date.getFullYear() === now.getFullYear()) {
        return format(date, 'd MMMM, HH:mm', { locale: ru });
      }
      
      return format(date, 'd MMMM yyyy, HH:mm', { locale: ru });
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return '—';
    }
  };

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
                {totalCount !== null ? `Всего: ${totalCount} заказов • Показано: ${orders.length}` : `Загружено: ${orders.length} заказов`}
                {hasMore && <span className="ml-2 text-blue-500">(есть еще)</span>}
              </p>
            </div>
          </div>
          <div className="hidden md:block text-sm font-semibold text-blue-600 bg-blue-50 dark:bg-blue-950/30 dark:text-blue-400 px-3 py-1 rounded-lg">
            Панель администратора
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {/* Фильтры */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Поиск по номеру заказа..."
              value={filters.searchQuery}
              onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
              className="w-full pl-12 pr-10 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            {filters.searchQuery && (
              <button onClick={clearSearch} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">От даты</label>
              <input 
                type="date" 
                value={filters.startDate} 
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">До даты</label>
              <input 
                type="date" 
                value={filters.endDate} 
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all" 
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Компания</label>
              <select 
                value={filters.carrier} 
                onChange={(e) => handleFilterChange('carrier', e.target.value)}
                className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none cursor-pointer"
              >
                {CARRIERS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Статус</label>
              <select 
                value={filters.status} 
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="block w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none cursor-pointer"
              >
                {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          
          {(filters.carrier !== 'Все' || filters.status !== 'Все' || filters.searchQuery) && (
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="text-xs text-slate-500">Активные фильтры:</span>
              {filters.carrier !== 'Все' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 rounded-lg text-xs">
                  ТК: {filters.carrier}
                  <button onClick={() => handleFilterChange('carrier', 'Все')} className="hover:text-blue-900">×</button>
                </span>
              )}
              {filters.status !== 'Все' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300 rounded-lg text-xs">
                  Статус: {filters.status}
                  <button onClick={() => handleFilterChange('status', 'Все')} className="hover:text-purple-900">×</button>
                </span>
              )}
              {filters.searchQuery && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs">
                  Поиск: {filters.searchQuery}
                  <button onClick={clearSearch} className="hover:text-slate-900">×</button>
                </span>
              )}
              <button onClick={resetDateFilter} className="text-xs text-blue-600 hover:underline ml-auto">
                Сбросить даты
              </button>
            </div>
          )}
        </div>

        {/* Bulk Actions Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 gap-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={toggleAllSelection} 
              className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-bold text-slate-700 dark:text-slate-300 transition-all border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
            >
              {selectedOrders.size === orders.length && orders.length > 0 ? 
                <CheckSquare className="w-5 h-5 text-blue-600" /> : <Square className="w-5 h-5 text-slate-300" />}
              Выбрать все
            </button>
            <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-700 hidden md:block" />
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Найдено: <b className="text-slate-900 dark:text-white">{orders.length}</b>
              {totalCount !== null && totalCount > orders.length && <span className="text-xs ml-1">(из {totalCount})</span>}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button 
                onClick={() => setMassStatusMenuOpen(!massStatusMenuOpen)} 
                disabled={selectedOrders.size === 0 || bulkUpdating}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 dark:bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-black disabled:opacity-30 transition-all"
              >
                {bulkUpdating ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <>
                    Массовое изменение ({selectedOrders.size})
                    <ChevronDown className="w-3 h-3" />
                  </>
                )}
              </button>
              
              <AnimatePresence>
                {massStatusMenuOpen && !bulkUpdating && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-3 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden z-40 p-1 max-h-80 overflow-y-auto"
                  >
                    <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase">Для ТК</div>
                    {TK_STATUSES.map(status => (
                      <button 
                        key={status} 
                        onClick={() => handleMassStatusChange(status)}
                        className="w-full text-left px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/30 hover:text-blue-700 dark:hover:text-blue-400 rounded-xl transition-all"
                      >
                        {status}
                      </button>
                    ))}
                    <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase mt-2">Для Самовывоза</div>
                    {PICKUP_STATUSES.map(status => (
                      <button 
                        key={status} 
                        onClick={() => handleMassStatusChange(status)}
                        className="w-full text-left px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-green-50 dark:hover:bg-green-950/30 hover:text-green-700 dark:hover:text-green-400 rounded-xl transition-all"
                      >
                        {status}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Таблица заказов */}
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
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-20 text-center text-slate-400 dark:text-slate-500 font-medium">
                      {filters.searchQuery || filters.carrier !== 'Все' || filters.status !== 'Все' 
                        ? 'Заказы не найдены по выбранным фильтрам' 
                        : 'Заказов пока нет'}
                    </td>
                  </tr>
                ) : (
                  orders.map(order => (
                    <tr 
                      key={order.id} 
                      onClick={() => setSelectedOrderDetails(order)}
                      className={`group hover:bg-blue-50/30 dark:hover:bg-blue-950/30 transition-all cursor-pointer ${selectedOrders.has(order.id) ? 'bg-blue-50 dark:bg-blue-950/20' : ''}`}
                    >
                      <td className="p-5" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => toggleOrderSelection(order.id)} className="transition-transform active:scale-90">
                          {selectedOrders.has(order.id) ? <CheckSquare className="w-6 h-6 text-blue-600" /> : <Square className="w-6 h-6 text-slate-200 group-hover:text-slate-300" />}
                        </button>
                      </td>
                      <td className="p-5 text-slate-500 dark:text-slate-400 text-xs font-medium whitespace-nowrap">
                        {order.createdAt ? format(new Date(order.createdAt.seconds ? order.createdAt.seconds * 1000 : order.createdAt), 'dd.MM.yy HH:mm') : '-'}
                      </td>
                      <td className="p-5 font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center gap-2">
                          {order.orderNumber || '—'}
                          {order.carrier === 'Самовывоз' && (
                            <Store className="w-3 h-3 text-green-500" title="Самовывоз" />
                          )}
                        </div>
                      </td>
                      <td className="p-5 text-slate-600 dark:text-slate-400 font-semibold text-xs uppercase">{order.carrier}</td>
                      <td className="p-5">
                        <span className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border uppercase tracking-tight ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="p-5 text-slate-600 dark:text-slate-400 text-xs font-medium truncate max-w-[120px]">
                        {order.createdBy || 'Система'}
                      </td>
                      <td className="p-5 text-center font-mono text-xs text-slate-500 dark:text-slate-400">
                        {formatAssemblyTime(order.time_start, order.time_end)}
                      </td>
                      <td className="p-5 text-right font-bold text-slate-900 dark:text-white">
                        {order.totalWeight ? `${Number(order.totalWeight).toFixed(1)} кг` : '—'}
                      </td>
                      <td className="p-5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                        {order.profit ? `${order.profit.toLocaleString()} ₽` : '—'}
                      </td>
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
          
          {orders.length > 0 && hasMore && (
            <div ref={loadMoreRef} className="flex items-center justify-center px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30">
              {loadingMore ? (
                <div className="flex items-center gap-2 text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Загрузка...</span>
                </div>
              ) : (
                <button
                  onClick={loadMore}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                  Загрузить еще
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Модальное окно деталей заказа */}
      <AnimatePresence>
        {selectedOrderDetails && (
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={() => { setSelectedOrderDetails(null); closeEditMode(); }}>
            <motion.div 
              initial={{ x: '100%' }} 
              animate={{ x: 0 }} 
              exit={{ x: '100%' }} 
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              onClick={(e) => e.stopPropagation()} 
              className="bg-white dark:bg-slate-900 h-full w-full max-w-2xl shadow-2xl flex flex-col relative"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                      {isEditing ? 'Редактирование заказа' : `Заказ ${selectedOrderDetails.orderNumber}`}
                    </h2>
                    {selectedOrderDetails.carrier === 'Самовывоз' ? (
                      <span className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-xs font-bold">
                        Самовывоз
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold">
                        ТК
                      </span>
                    )}
                  </div>
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
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Номер заказа</label>
                        <input type="text" value={editFormData?.orderNumber || ''} onChange={(e) => setEditFormData({ ...editFormData, orderNumber: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Транспортная компания</label>
                        <select 
                          value={editFormData?.carrier || ''} 
                          onChange={(e) => {
                            const newCarrier = e.target.value;
                            const availableStatuses = getAvailableStatuses(newCarrier);
                            const newStatus = availableStatuses.includes(editFormData?.status) 
                              ? editFormData?.status 
                              : availableStatuses[0];
                            setEditFormData({ ...editFormData, carrier: newCarrier, status: newStatus });
                          }} 
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                        >
                          {CARRIERS.filter(c => c !== 'Все').map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Количество мест</label>
                        <input type="number" value={editFormData?.quantity || 1} onChange={(e) => setEditFormData({ ...editFormData, quantity: parseInt(e.target.value) })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Статус</label>
                        <select 
                          value={editFormData?.status || ''} 
                          onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                        >
                          {getAvailableStatuses(editFormData?.carrier).map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Сборщик (email)</label>
                        <input type="email" value={editFormData?.createdBy || ''} onChange={(e) => setEditFormData({ ...editFormData, createdBy: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800" />
                      </div>
                    </div>

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

                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-bold text-slate-900 dark:text-white">Габариты мест</h3>
                        <button onClick={addPlace} className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded-lg">
                          <Plus className="w-3 h-3" /> Добавить место
                        </button>
                      </div>
                      
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

                    <div className="flex gap-3 pt-4">
                      <button onClick={closeEditMode} className="flex-1 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-medium">Отмена</button>
                      <button onClick={handleSaveEdit} disabled={savingEdit} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium flex items-center justify-center gap-2">
                        {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Сохранить изменения
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Блок консолидации - только для ТК */}
                    {selectedOrderDetails.carrier !== 'Самовывоз' && (selectedOrderDetails.consolidationNumber || selectedOrderDetails.consolidationId || selectedOrderDetails.status === 'В консолидации') && (
                      <Link href="/admin/consolidations" className="block group">
                        <div className="p-4 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 border border-purple-200 dark:border-purple-800/50 rounded-2xl transition-all hover:shadow-md">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-purple-100 dark:bg-purple-900/50 rounded-xl">
                                <Layers className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-0.5">
                                  Консолидация
                                </p>
                                <p className="font-bold text-purple-900 dark:text-purple-200 text-lg">
                                  {selectedOrderDetails.consolidationNumber || selectedOrderDetails.consolidationId || 'В процессе консолидации'}
                                </p>
                                {selectedOrderDetails.status === 'В консолидации' && !selectedOrderDetails.consolidationNumber && (
                                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                                    Заказ ожидает присвоения номера консолидации
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-purple-500 group-hover:text-purple-700 transition-colors">
                                Перейти к консоли
                              </span>
                              <ExternalLink className="w-4 h-4 text-purple-400 group-hover:text-purple-600 transition-colors" />
                            </div>
                          </div>
                        </div>
                      </Link>
                    )}

                    {/* Быстрые действия для консолидации */}
                    {selectedOrderDetails.carrier !== 'Самовывоз' && selectedOrderDetails.status === 'В консолидации' && (
                      <div className="bg-purple-50 dark:bg-purple-950/30 p-5 rounded-3xl space-y-3">
                        <div className="flex items-center gap-2 text-purple-700">
                          <Layers size={18} />
                          <span className="text-xs font-black uppercase">Действия с консолидацией</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button 
                            onClick={() => window.open('/admin/consolidations', '_blank')}
                            className="py-2 px-3 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-xl text-xs font-medium hover:bg-purple-200 transition-colors flex items-center justify-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Открыть консоль
                          </button>
                          <button 
                            onClick={() => {
                              if (selectedOrderDetails.consolidationNumber) {
                                navigator.clipboard?.writeText(selectedOrderDetails.consolidationNumber);
                                showToast('Номер консолидации скопирован', 'success');
                              }
                            }}
                            className="py-2 px-3 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-xl text-xs font-medium hover:bg-purple-200 transition-colors flex items-center justify-center gap-1"
                            disabled={!selectedOrderDetails.consolidationNumber}
                          >
                            <Copy className="w-3 h-3" />
                            Копировать номер
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                        <div className="flex items-center gap-2 text-slate-500 mb-1"><User className="w-4 h-4" /><span className="text-[10px] font-black">Сборщик</span></div>
                        <p className="font-bold">{selectedOrderDetails.createdBy || '—'}</p>
                      </div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                        <div className="flex items-center gap-2 text-slate-500 mb-1"><Clock className="w-4 h-4" /><span className="text-[10px] font-black">Время сборки</span></div>
                        <p className="font-bold font-mono">{formatAssemblyTime(selectedOrderDetails.time_start, selectedOrderDetails.time_end)}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 bg-white dark:bg-slate-800 border rounded-2xl text-center"><Box className="w-4 h-4 mx-auto mb-1 text-slate-400" /><p className="text-xs text-slate-500">Мест</p><p className="font-bold">{selectedOrderDetails.quantity || 0}</p></div>
                      <div className="p-3 bg-white dark:bg-slate-800 border rounded-2xl text-center"><Weight className="w-4 h-4 mx-auto mb-1 text-slate-400" /><p className="text-xs text-slate-500">Вес</p><p className="font-bold">{getTotalWeight(selectedOrderDetails).toFixed(2)} кг</p></div>
                      <div className="p-3 bg-white dark:bg-slate-800 border rounded-2xl text-center"><Package className="w-4 h-4 mx-auto mb-1 text-slate-400" /><p className="text-xs text-slate-500">Объем</p><p className="font-bold">{getTotalVolume(selectedOrderDetails).toFixed(4)} м³</p></div>
                    </div>

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

                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-3">
                      <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2"><DollarSign className="w-4 h-4 text-emerald-500" />Финансовая информация</h3>
                      <div className="flex justify-between p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl"><span className="text-blue-800">Сумма заказа:</span><span className="font-bold">{selectedOrderDetails.payment_sum?.toLocaleString() || 0} ₽</span></div>
                      <div className="flex justify-between p-3 bg-orange-50 dark:bg-orange-950/30 rounded-xl"><span className="text-orange-800">Стоимость доставки:</span><span className="font-bold">{selectedOrderDetails.delivery_cost?.toLocaleString() || 0} ₽</span></div>
                      <div className="flex justify-between p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl"><span className="text-emerald-800">Чистая прибыль:</span><span className="font-bold text-lg">{((selectedOrderDetails.payment_sum || 0) - (selectedOrderDetails.delivery_cost || 0)).toLocaleString()} ₽</span></div>
                      <button onClick={handleSaveFinance} disabled={savingFinance} className="w-full py-2 bg-blue-600 text-white rounded-xl text-sm font-medium">{savingFinance ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Сохранить финансы'}</button>
                    </div>

                    <ReturnManagement order={selectedOrderDetails} onUpdate={refresh} />

                    {/* Блок управления статусом */}
                    <div className={`p-5 rounded-3xl space-y-4 ${
                      selectedOrderDetails.carrier === 'Самовывоз' 
                        ? 'bg-green-50 dark:bg-green-950/30' 
                        : 'bg-blue-50 dark:bg-blue-950/30'
                    }`}>
                      <div className={`flex items-center gap-2 ${
                        selectedOrderDetails.carrier === 'Самовывоз' 
                          ? 'text-green-700' 
                          : 'text-blue-700'
                      }`}>
                        <CheckCircle2 size={18} />
                        <span className="text-xs font-black uppercase">Управление статусом</span>
                        <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          selectedOrderDetails.carrier === 'Самовывоз' 
                            ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200' 
                            : 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200'
                        }`}>
                          {selectedOrderDetails.carrier === 'Самовывоз' ? 'Самовывоз' : 'ТК'}
                        </span>
                      </div>
                      
                      {/* Кнопки быстрой смены статуса */}
                      <div className="grid grid-cols-2 gap-2">
                        {selectedOrderDetails.carrier === 'Самовывоз' ? (
                          // Кнопки для самовывоза
                          <>
                            {selectedOrderDetails.status === 'Новый' && (
                              <button
                                type="button"
                                onClick={() => handleSingleStatusChange(selectedOrderDetails.id, 'Готов к выдаче')}
                                disabled={updatingStatusId === selectedOrderDetails.id}
                                className="col-span-2 py-2.5 px-3 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold hover:bg-indigo-200 dark:hover:bg-indigo-800/50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                              >
                                {updatingStatusId === selectedOrderDetails.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Package className="w-3 h-3" />
                                )}
                                Готов к выдаче
                              </button>
                            )}
                            
                            {selectedOrderDetails.status === 'Готов к выдаче' && (
                              <button
                                type="button"
                                onClick={() => handleSingleStatusChange(selectedOrderDetails.id, 'Выдан')}
                                disabled={updatingStatusId === selectedOrderDetails.id}
                                className="col-span-2 py-2.5 px-3 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded-xl text-xs font-bold hover:bg-green-200 dark:hover:bg-green-800/50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                              >
                                {updatingStatusId === selectedOrderDetails.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <CheckSquare className="w-3 h-3" />
                                )}
                                Выдать заказ
                              </button>
                            )}
                          </>
                        ) : (
                          // Кнопки для ТК
                          <>
                            {selectedOrderDetails.status === 'Новый' && (
                              <button
                                type="button"
                                onClick={() => handleSingleStatusChange(selectedOrderDetails.id, 'Комплектация')}
                                disabled={updatingStatusId === selectedOrderDetails.id}
                                className="col-span-2 py-2.5 px-3 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-xl text-xs font-bold hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                              >
                                {updatingStatusId === selectedOrderDetails.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Package className="w-3 h-3" />
                                )}
                                В комплектацию
                              </button>
                            )}
                            
                            {selectedOrderDetails.status === 'Комплектация' && (
                              <button
                                type="button"
                                onClick={() => handleSingleStatusChange(selectedOrderDetails.id, 'Ожидает оформления')}
                                disabled={updatingStatusId === selectedOrderDetails.id}
                                className="col-span-2 py-2.5 px-3 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-xl text-xs font-bold hover:bg-amber-200 dark:hover:bg-amber-800/50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                              >
                                {updatingStatusId === selectedOrderDetails.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Clock className="w-3 h-3" />
                                )}
                                Ожидает оформления
                              </button>
                            )}
                            
                            {selectedOrderDetails.status === 'Ожидает оформления' && (
                              <button
                                type="button"
                                onClick={() => handleSingleStatusChange(selectedOrderDetails.id, 'Оформлен')}
                                disabled={updatingStatusId === selectedOrderDetails.id}
                                className="col-span-2 py-2.5 px-3 bg-cyan-100 dark:bg-cyan-900/50 text-cyan-700 dark:text-cyan-300 rounded-xl text-xs font-bold hover:bg-cyan-200 dark:hover:bg-cyan-800/50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                              >
                                {updatingStatusId === selectedOrderDetails.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3 h-3" />
                                )}
                                Оформить
                              </button>
                            )}
                            
                            {selectedOrderDetails.status === 'Оформлен' && (
                              <button
                                type="button"
                                onClick={() => handleSingleStatusChange(selectedOrderDetails.id, 'Отправлен')}
                                disabled={updatingStatusId === selectedOrderDetails.id}
                                className="col-span-2 py-2.5 px-3 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-xl text-xs font-bold hover:bg-emerald-200 dark:hover:bg-emerald-800/50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                              >
                                {updatingStatusId === selectedOrderDetails.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Truck className="w-3 h-3" />
                                )}
                                Отправить
                              </button>
                            )}
                            
                            {/* Кнопка "В консолидацию" */}
                            {(selectedOrderDetails.status === 'Новый' || 
                              selectedOrderDetails.status === 'Комплектация' || 
                              selectedOrderDetails.status === 'Ожидает оформления') && (
                              <button
                                type="button"
                                onClick={() => handleSingleStatusChange(selectedOrderDetails.id, 'В консолидации')}
                                disabled={updatingStatusId === selectedOrderDetails.id}
                                className="col-span-2 py-2.5 px-3 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-xl text-xs font-bold hover:bg-purple-200 dark:hover:bg-purple-800/50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                              >
                                {updatingStatusId === selectedOrderDetails.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Layers className="w-3 h-3" />
                                )}
                                В консолидацию
                              </button>
                            )}
                          </>
                        )}
                      </div>
                      
                      {/* Индикатор последовательности статусов */}
                      <div className="relative pt-2">
                        <div className="flex items-center justify-between">
                          {(selectedOrderDetails.carrier === 'Самовывоз' ? PICKUP_STATUSES : TK_STATUSES).map((status, index, array) => {
                            const statusIndex = array.indexOf(selectedOrderDetails.status);
                            const isCompleted = statusIndex >= index;
                            const isCurrent = selectedOrderDetails.status === status;
                            const color = selectedOrderDetails.carrier === 'Самовывоз' ? 'green' : 'blue';
                            
                            return (
                              <div key={status} className="flex flex-col items-center relative z-10">
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all
                                  ${isCompleted
                                    ? `bg-${color}-600 text-white shadow-lg shadow-${color}-200` 
                                    : isCurrent
                                      ? `bg-${color}-100 text-${color}-600 border-2 border-${color}-600`
                                      : 'bg-slate-100 text-slate-400 dark:bg-slate-800'}`}
                                >
                                  {index + 1}
                                </div>
                                <span className={`text-[8px] font-bold mt-1 uppercase tracking-wider text-center
                                  ${isCompleted ? `text-${color}-600` : 'text-slate-400'}`}>
                                  {status === 'Готов к выдаче' ? 'Готов' : 
                                   status === 'Ожидает оформления' ? 'Ожидает' :
                                   status === 'В консолидации' ? 'Консоль' : status}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="absolute top-3 left-0 right-0 h-0.5 bg-slate-200 dark:bg-slate-700 -z-0">
                          <div 
                            className={`h-full transition-all duration-500 ${
                              selectedOrderDetails.carrier === 'Самовывоз' ? 'bg-green-600' : 'bg-blue-600'
                            }`}
                            style={{ 
                              width: (() => {
                                const statuses = selectedOrderDetails.carrier === 'Самовывоз' ? PICKUP_STATUSES : TK_STATUSES;
                                const index = statuses.indexOf(selectedOrderDetails.status);
                                return index >= 0 ? `${(index / (statuses.length - 1)) * 100}%` : '0%';
                              })()
                            }}
                          />
                        </div>
                      </div>
                      
                      {/* Выпадающий список для всех статусов */}
                      <div className="relative">
                        <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                          Все статусы
                        </label>
                        <select 
                          value={selectedOrderDetails.status} 
                          onChange={(e) => handleSingleStatusChange(selectedOrderDetails.id, e.target.value)} 
                          disabled={updatingStatusId === selectedOrderDetails.id}
                          className="w-full bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-sm font-bold rounded-2xl p-3 cursor-pointer hover:border-slate-300 transition-all disabled:opacity-50"
                        >
                          {getAvailableStatuses(selectedOrderDetails.carrier).map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        {updatingStatusId === selectedOrderDetails.id && (
                          <div className="absolute right-3 top-9">
                            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                          </div>
                        )}
                      </div>
                      
                      {/* Подсказка по текущему статусу */}
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800/50 p-2 rounded-lg">
                        {selectedOrderDetails.status === 'Новый' && '📝 Заказ создан, ожидает обработки'}
                        {selectedOrderDetails.status === 'Комплектация' && '📦 Идет сборка заказа на складе'}
                        {selectedOrderDetails.status === 'Ожидает оформления' && '⏳ Заказ ожидает оформления документов'}
                        {selectedOrderDetails.status === 'Готов к выдаче' && '✅ Заказ собран и готов к выдаче клиенту'}
                        {selectedOrderDetails.status === 'Оформлен' && '📋 Документы оформлены, готов к отправке'}
                        {selectedOrderDetails.status === 'Отправлен' && '🚚 Заказ передан в транспортную компанию'}
                        {selectedOrderDetails.status === 'В консолидации' && '📦 Заказ находится в процессе консолидации с другими отправлениями'}
                        {selectedOrderDetails.status === 'Выдан' && '🎉 Заказ успешно выдан получателю'}
                        
                        <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                          {selectedOrderDetails.carrier === 'Самовывоз' ? (
                            <span className="text-green-600 dark:text-green-400">🚶 Самовывоз:</span>
                          ) : (
                            <span className="text-blue-600 dark:text-blue-400">🚛 Транспортная компания:</span>
                          )}
                          {' '}
                          {selectedOrderDetails.carrier === 'Самовывоз' 
                            ? 'Статусы: Новый → Готов к выдаче → Выдан'
                            : 'Статусы: Новый → Комплектация → Ожидает оформления → Оформлен → Отправлен (или В консолидации)'}
                        </div>
                      </div>
                    </div>

                    {/* Расширенная история изменений */}
                    {selectedOrderDetails.history && selectedOrderDetails.history.length > 0 && (
                      <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <Clock className="w-4 h-4 text-slate-400" />
                            История изменений
                          </h3>
                          <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                            {selectedOrderDetails.history.length} {selectedOrderDetails.history.length === 1 ? 'запись' : 
                              selectedOrderDetails.history.length >= 2 && selectedOrderDetails.history.length <= 4 ? 'записи' : 'записей'}
                          </span>
                        </div>
                        
                        <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                          {selectedOrderDetails.history
                            .slice()
                            .sort((a, b) => {
                              const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
                              const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
                              return timeB - timeA;
                            })
                            .map((item, idx: number) => {
                              const isConsolidationEvent = item.action === 'added_to_consolidation' || item.action === 'removed_from_consolidation';
                              
                              const getEventIcon = () => {
                                if (isConsolidationEvent) return <Layers className="w-4 h-4" />;
                                if (item.status === 'Новый') return <Hash className="w-4 h-4" />;
                                if (item.status === 'Комплектация') return <Package className="w-4 h-4" />;
                                if (item.status === 'Ожидает оформления') return <Clock className="w-4 h-4" />;
                                if (item.status === 'Оформлен') return <CheckCircle2 className="w-4 h-4" />;
                                if (item.status === 'Отправлен') return <Truck className="w-4 h-4" />;
                                if (item.status === 'Выдан') return <CheckSquare className="w-4 h-4" />;
                                if (item.status === 'Готов к выдаче') return <Store className="w-4 h-4" />;
                                return <Clock className="w-4 h-4" />;
                              };
                              
                              return (
                                <div key={idx} className="relative pl-6 pb-3">
                                  {idx < selectedOrderDetails.history.length - 1 && (
                                    <div className="absolute left-2 top-6 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700" />
                                  )}
                                  
                                  <div className={`absolute left-0 top-1 w-4 h-4 rounded-full border-2 flex items-center justify-center
                                    ${isConsolidationEvent 
                                      ? 'bg-purple-100 border-purple-300 dark:bg-purple-900/50 dark:border-purple-700' 
                                      : 'bg-blue-100 border-blue-300 dark:bg-blue-900/50 dark:border-blue-700'}`}
                                  >
                                    <div className={`w-1.5 h-1.5 rounded-full 
                                      ${isConsolidationEvent 
                                        ? 'bg-purple-500 dark:bg-purple-400' 
                                        : 'bg-blue-500 dark:bg-blue-400'}`} 
                                    />
                                  </div>
                                  
                                  <div className={`p-4 rounded-xl transition-all
                                    ${isConsolidationEvent 
                                      ? 'bg-gradient-to-r from-purple-50 to-transparent dark:from-purple-950/20 dark:to-transparent border-l-2 border-purple-300 dark:border-purple-700' 
                                      : 'bg-slate-50 dark:bg-slate-800/50'}`}
                                  >
                                    <div className="flex items-start justify-between gap-3 mb-2">
                                      <div className="flex items-center gap-2">
                                        <span className={`p-1.5 rounded-lg ${isConsolidationEvent ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-600' : 'bg-blue-100 dark:bg-blue-900/50 text-blue-600'}`}>
                                          {getEventIcon()}
                                        </span>
                                        <div>
                                          <div className="flex items-center gap-2 flex-wrap">
                                            {isConsolidationEvent ? (
                                              <span className="font-bold text-purple-700 dark:text-purple-300">
                                                {item.action === 'added_to_consolidation' ? 'Добавлен в консолидацию' : 'Удален из консолидации'}
                                              </span>
                                            ) : (
                                              <>
                                                <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${getStatusColor(item.status)}`}>
                                                  {item.status}
                                                </span>
                                                {item.previousStatus && (
                                                  <>
                                                    <span className="text-slate-400 text-xs">←</span>
                                                    <span className="text-xs text-slate-500">
                                                      {item.previousStatus}
                                                    </span>
                                                  </>
                                                )}
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      <time className="text-xs text-slate-500 font-medium whitespace-nowrap">
                                        {formatHistoryTimestamp(item.timestamp)}
                                      </time>
                                    </div>
                                    
                                    {item.consolidationNumber && (
                                      <div className="mt-3 p-3 bg-white dark:bg-slate-900/50 rounded-lg border border-purple-100 dark:border-purple-800/30">
                                        <div className="flex items-center gap-2">
                                          <Layers className="w-4 h-4 text-purple-500" />
                                          <span className="text-sm font-mono font-bold text-purple-700 dark:text-purple-300">
                                            {item.consolidationNumber}
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                    
                                    {item.comment && (
                                      <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-100 dark:border-amber-800/30">
                                        <p className="text-sm text-amber-800 dark:text-amber-300 italic">
                                          "{item.comment}"
                                        </p>
                                      </div>
                                    )}
                                    
                                    <div className="mt-3 flex items-center gap-2 text-xs">
                                      <User className="w-3 h-3 text-slate-400" />
                                      <span className="text-slate-600 dark:text-slate-400 font-medium">
                                        {item.user || 'Система'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}

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