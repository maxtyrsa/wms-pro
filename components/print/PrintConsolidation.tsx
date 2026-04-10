// components/print/PrintConsolidation.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { 
  Printer, X, Package, Truck, CalendarDays, User, 
  Edit2, Save, Plus, Minus, Trash2, AlertCircle, 
  CheckSquare, Square, Search, XCircle, Layers,
  Loader2
} from 'lucide-react';
import { updateDoc, doc, writeBatch, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { showToast } from '@/components/Toast';
import { useAuth } from '@/context/AuthContext';

interface Order {
  id: string;
  orderNumber?: string;
  quantity?: number;
  totalWeight?: number;
  totalVolume?: number;
  profit?: number;
  carrier?: string;
  status?: string;
  createdBy?: string;
  payment_sum?: number;
}

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
  orders: Order[];
}

interface PrintConsolidationProps {
  consolidation: Consolidation;
  onClose: () => void;
  onUpdate: () => void;
  availableOrders: Order[];
}

export function PrintConsolidation({ 
  consolidation, 
  onClose, 
  onUpdate,
  availableOrders 
}: PrintConsolidationProps) {
  const { user } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [currentOrders, setCurrentOrders] = useState<Order[]>(consolidation.orders);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const canEdit = consolidation.status === 'pending';

  // Расчет итогов
  const calculateTotals = (orders: Order[]) => {
    const totalOrders = orders.length;
    const totalPlaces = orders.reduce((sum, o) => sum + (o.quantity || 0), 0);
    const totalWeight = orders.reduce((sum, o) => sum + (o.totalWeight || 0), 0);
    const totalVolume = orders.reduce((sum, o) => sum + (o.totalVolume || 0), 0);
    const totalProfit = orders.reduce((sum, o) => sum + (o.profit || 0), 0);
    
    return { totalOrders, totalPlaces, totalWeight, totalVolume, totalProfit };
  };

  const [totals, setTotals] = useState(() => calculateTotals(currentOrders));

  const updateTotals = (orders: Order[]) => {
    const newTotals = calculateTotals(orders);
    setTotals(newTotals);
    return newTotals;
  };

  // Фильтрация доступных заказов
  const availableForAdd = availableOrders.filter(order => 
    !currentOrders.some(o => o.id === order.id) && order.carrier === consolidation.carrier
  );

  const filteredAvailableOrders = availableForAdd.filter(order => {
    if (!searchQuery.trim()) return true;
    const queryLower = searchQuery.trim().toLowerCase();
    return order.orderNumber?.toLowerCase().includes(queryLower);
  });

  const toggleOrderSelection = (orderId: string) => {
    const newSelection = new Set(selectedOrderIds);
    if (newSelection.has(orderId)) {
      newSelection.delete(orderId);
    } else {
      newSelection.add(orderId);
    }
    setSelectedOrderIds(newSelection);
  };

  const toggleAllSelection = () => {
    if (selectedOrderIds.size === filteredAvailableOrders.length) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(filteredAvailableOrders.map(o => o.id)));
    }
  };

  // 🔥 ИСПРАВЛЕНО: Добавление заказов с правильной записью consolidationNumber
  const handleAddSelectedOrders = async () => {
    if (selectedOrderIds.size === 0) {
      showToast('Выберите заказы для добавления', 'error');
      return;
    }

    const ordersToAdd = availableForAdd.filter(o => selectedOrderIds.has(o.id));
    if (ordersToAdd.length === 0) return;

    setLoading(true);
    try {
      const newOrders = [...currentOrders, ...ordersToAdd];
      const newTotals = updateTotals(newOrders);
      
      // Обновляем консоль в Firebase
      const consolidationRef = doc(db, 'consolidations', consolidation.id);
      await updateDoc(consolidationRef, {
        orders: newOrders.map(o => ({
          id: o.id,
          orderNumber: o.orderNumber,
          quantity: o.quantity,
          totalWeight: o.totalWeight,
          totalVolume: o.totalVolume,
          createdBy: o.createdBy,
          payment_sum: (o as any).payment_sum,
          profit: o.profit
        })),
        totalOrders: newTotals.totalOrders,
        totalWeight: newTotals.totalWeight,
        totalVolume: newTotals.totalVolume,
        totalProfit: newTotals.totalProfit,
        updatedAt: new Date().toISOString()
      });

      // 🔥 Обновляем КАЖДЫЙ заказ с consolidationNumber
      const batch = writeBatch(db);
      for (const order of ordersToAdd) {
        const orderRef = doc(db, 'orders', order.id);
        
        const orderSnap = await getDoc(orderRef);
        const orderData = orderSnap.data();
        const currentHistory = orderData?.history || [];
        
        const historyEntry = {
          status: 'В консолидации',
          timestamp: new Date().toISOString(),
          user: user?.email || 'admin',
          action: 'added_to_consolidation',
          consolidationId: consolidation.id,
          consolidationNumber: consolidation.consolidationNumber
        };
        
        const updatedHistory = [...currentHistory, historyEntry];
        
        batch.update(orderRef, {
          status: 'В консолидации',
          consolidationId: consolidation.id,
          consolidationNumber: consolidation.consolidationNumber, // 🔥 КЛЮЧЕВОЕ ИСПРАВЛЕНИЕ
          history: updatedHistory,
          consolidatedAt: new Date().toISOString(),
          consolidatedBy: user?.email || 'admin',
          previousStatus: orderData?.status || 'Оформлен'
        });
      }
      await batch.commit();

      setCurrentOrders(newOrders);
      setSelectedOrderIds(new Set());
      setSearchQuery('');
      setShowAddModal(false);
      
      showToast(`✅ Добавлено ${ordersToAdd.length} заказов в консоль ${consolidation.consolidationNumber}`, 'success');
      onUpdate();
    } catch (error) {
      console.error('Error adding orders to consolidation:', error);
      showToast('Ошибка при добавлении заказов', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Удаление заказа из консоли
  const handleRemoveOrder = async (orderId: string) => {
    if (!confirm('Удалить заказ из консоли?')) return;

    setLoading(true);
    try {
      const orderToRemove = currentOrders.find(o => o.id === orderId);
      if (!orderToRemove) return;

      const newOrders = currentOrders.filter(o => o.id !== orderId);
      const newTotals = updateTotals(newOrders);
      
      // Обновляем консоль
      const consolidationRef = doc(db, 'consolidations', consolidation.id);
      await updateDoc(consolidationRef, {
        orders: newOrders,
        totalOrders: newTotals.totalOrders,
        totalWeight: newTotals.totalWeight,
        totalVolume: newTotals.totalVolume,
        totalProfit: newTotals.totalProfit,
        updatedAt: new Date().toISOString()
      });

      // Возвращаем заказ в статус "Оформлен"
      const orderRef = doc(db, 'orders', orderId);
      const orderSnap = await getDoc(orderRef);
      const orderData = orderSnap.data();
      const currentHistory = orderData?.history || [];
      
      const historyEntry = {
        status: 'Оформлен',
        timestamp: new Date().toISOString(),
        user: user?.email || 'admin',
        action: 'removed_from_consolidation'
      };
      
      const updatedHistory = [...currentHistory, historyEntry];

      await updateDoc(orderRef, {
        status: 'Оформлен',
        consolidationId: null,
        consolidationNumber: null,
        history: updatedHistory,
        previousStatus: null,
        lastUpdated: new Date().toISOString()
      });

      setCurrentOrders(newOrders);
      showToast('Заказ удален из консоли', 'success');
      onUpdate();
    } catch (error) {
      console.error('Error removing order from consolidation:', error);
      showToast('Ошибка при удалении заказа', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Сохранение изменений
  const handleSaveChanges = async () => {
    setLoading(true);
    try {
      const consolidationRef = doc(db, 'consolidations', consolidation.id);
      await updateDoc(consolidationRef, {
        orders: currentOrders,
        totalOrders: totals.totalOrders,
        totalWeight: totals.totalWeight,
        totalVolume: totals.totalVolume,
        totalProfit: totals.totalProfit,
        updatedAt: new Date().toISOString()
      });

      setIsEditing(false);
      showToast('Изменения сохранены', 'success');
      onUpdate();
    } catch (error) {
      console.error('Error saving consolidation:', error);
      showToast('Ошибка при сохранении', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setCurrentOrders(consolidation.orders);
    setTotals(calculateTotals(consolidation.orders));
    setIsEditing(false);
    setShowAddModal(false);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      return format(new Date(dateStr), 'dd.MM.yyyy', { locale: ru });
    } catch {
      return '—';
    }
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      return format(new Date(dateStr), 'dd.MM.yyyy HH:mm', { locale: ru });
    } catch {
      return '—';
    }
  };

  const formatWeight = (weight: number) => weight.toFixed(1).replace('.', ',');
  const formatVolume = (volume: number) => volume.toFixed(6).replace('.', ',');
  const formatProfit = (profit: number) => profit.toLocaleString('ru-RU');

  const totalPlaces = currentOrders.reduce((sum, o) => sum + (o.quantity || 0), 0);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Пожалуйста, разрешите всплывающие окна для печати');
      return;
    }

    const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
    let stylesHTML = '';
    styles.forEach((style) => {
      if (style.tagName === 'STYLE') {
        stylesHTML += style.outerHTML;
      } else if (style.tagName === 'LINK') {
        stylesHTML += style.outerHTML;
      }
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Консоль ${consolidation.consolidationNumber}</title>
          <meta charset="utf-8" />
          ${stylesHTML}
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; padding: 20px; background: white; font-size: 14px; }
            @media print { body { padding: 0; } button { display: none; } }
          </style>
        </head>
        <body>
          <div>${printContent.innerHTML}</div>
          <script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); };</script>
        </body>
      </html>
    `);
    
    printWindow.document.close();
  };

  return (
    <div className="relative z-50">
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
          {/* Заголовок */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">
                  {isEditing ? 'Редактирование консоли' : 'Консоль отправки'}
                </h2>
                <p className="text-sm text-gray-500">{consolidation.consolidationNumber}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {canEdit && !isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                  Редактировать
                </button>
              )}
              {isEditing && (
                <>
                  <button
                    onClick={handleSaveChanges}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {loading ? 'Сохранение...' : 'Сохранить'}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Отмена
                  </button>
                </>
              )}
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Printer className="w-4 h-4" />
                Печать
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          {/* Содержимое для печати */}
          <div className="flex-1 overflow-auto p-6 bg-gray-100">
            <div ref={printRef} className="bg-white shadow-xl rounded-lg overflow-hidden">
              <div className="p-8 font-sans text-sm">
                {/* Шапка */}
                <div className="text-center mb-8 pb-4 border-b-2 border-gray-300">
                  <h1 className="text-2xl font-bold text-gray-900 mb-1">Консоль отправки</h1>
                  <div className="text-lg font-mono font-bold text-blue-600 mb-2">
                    {consolidation.consolidationNumber}
                  </div>
                  <div className="text-xs text-gray-500">
                    Сформирована: {formatDateTime(consolidation.createdAt)}
                  </div>
                </div>

                {/* Информация */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                      <Truck className="w-4 h-4" />
                      <span>ТК</span>
                    </div>
                    <div className="font-bold text-gray-900">{consolidation.carrier}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                      <User className="w-4 h-4" />
                      <span>Ответственный</span>
                    </div>
                    <div className="font-bold text-gray-900">{consolidation.responsiblePerson}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                      <CalendarDays className="w-4 h-4" />
                      <span>Планируемая отправка</span>
                    </div>
                    <div className="font-bold text-gray-900">{formatDate(consolidation.plannedShipmentDate)}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                      <Package className="w-4 h-4" />
                      <span>Статус</span>
                    </div>
                    <div className={`font-bold ${
                      consolidation.status === 'shipped' ? 'text-green-600' : 
                      consolidation.status === 'cancelled' ? 'text-red-600' : 'text-amber-600'
                    }`}>
                      {consolidation.status === 'pending' ? 'Ожидает отправки' :
                       consolidation.status === 'shipped' ? 'Отправлена' : 'Отменена'}
                    </div>
                  </div>
                </div>

                {/* Сводка */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-700">{totals.totalOrders}</div>
                    <div className="text-xs text-blue-600">Заказов</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-700">{totalPlaces}</div>
                    <div className="text-xs text-green-600">Мест</div>
                  </div>
                  <div className="text-center p-3 bg-amber-50 rounded-lg">
                    <div className="text-2xl font-bold text-amber-700">{formatWeight(totals.totalWeight)}</div>
                    <div className="text-xs text-amber-600">Вес, кг</div>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-700">{formatVolume(totals.totalVolume)}</div>
                    <div className="text-xs text-purple-600">Объем, м³</div>
                  </div>
                  <div className="text-center p-3 bg-emerald-50 rounded-lg">
                    <div className="text-2xl font-bold text-emerald-700">{formatProfit(totals.totalProfit)}</div>
                    <div className="text-xs text-emerald-600">Прибыль, ₽</div>
                  </div>
                </div>

                {/* Таблица заказов */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-300">
                    <h3 className="text-base font-bold text-gray-900">Список заказов в консоли</h3>
                    {isEditing && canEdit && (
                      <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-1 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium"
                      >
                        <Plus className="w-3 h-3" />
                        Добавить заказы
                      </button>
                    )}
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-gray-100 border-b-2 border-gray-300">
                          <th className="text-left py-2 px-3 w-12">№</th>
                          <th className="text-left py-2 px-3">Номер заказа</th>
                          <th className="text-center py-2 px-3 w-16">Мест</th>
                          <th className="text-right py-2 px-3 w-24">Вес, кг</th>
                          <th className="text-right py-2 px-3 w-24">Объем, м³</th>
                          <th className="text-right py-2 px-3 w-28">Прибыль, ₽</th>
                          {isEditing && canEdit && <th className="text-center w-12"></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {currentOrders.map((order, index) => (
                          <tr key={order.id} className="border-b border-gray-200">
                            <td className="py-2 px-3 text-gray-600">{index + 1}</td>
                            <td className="py-2 px-3 font-medium text-gray-900">
                              {order.orderNumber || order.id.slice(-6)}
                            </td>
                            <td className="py-2 px-3 text-center">{order.quantity || 1}</td>
                            <td className="py-2 px-3 text-right font-mono">
                              {formatWeight(order.totalWeight || 0)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono">
                              {formatVolume(order.totalVolume || 0)}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-emerald-700">
                              {formatProfit(order.profit || 0)}
                            </td>
                            {isEditing && canEdit && (
                              <td className="py-2 px-3 text-center">
                                <button
                                  onClick={() => handleRemoveOrder(order.id)}
                                  className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                        <tr>
                          <td colSpan={2} className="py-3 px-3 font-bold">ИТОГО:</td>
                          <td className="py-3 px-3 text-center font-bold">{totalPlaces}</td>
                          <td className="py-3 px-3 text-right font-bold">{formatWeight(totals.totalWeight)}</td>
                          <td className="py-3 px-3 text-right font-bold">{formatVolume(totals.totalVolume)}</td>
                          <td className="py-3 px-3 text-right font-bold text-emerald-700">
                            {formatProfit(totals.totalProfit)}
                          </td>
                          {isEditing && canEdit && <td></td>}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {/* Примечания */}
                {consolidation.notes && (
                  <div className="mb-6 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-xs font-semibold text-gray-500 mb-1">Примечания</div>
                    <div className="text-sm text-gray-700">{consolidation.notes}</div>
                  </div>
                )}

                {/* Подвал */}
                <div className="text-center pt-6 mt-4 border-t border-gray-200">
                  <div className="text-xs text-gray-400">
                    Документ сформирован: {formatDateTime(new Date().toISOString())}
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1">
                    WMS Kupi-Flakon — Система управления Московским складом
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Модальное окно добавления заказов */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-blue-600" />
                  Добавить заказы в консоль
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Выберите заказы для добавления в {consolidation.consolidationNumber}
                </p>
              </div>
              <button 
                onClick={() => setShowAddModal(false)} 
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-4 flex-1 overflow-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Поиск по номеру заказа..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              
              {filteredAvailableOrders.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Нет доступных заказов для добавления</p>
                  <p className="text-xs mt-1">
                    Доступны только заказы со статусом "Оформлен" и ТК "{consolidation.carrier}"
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                    <button
                      onClick={toggleAllSelection}
                      className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600"
                    >
                      {selectedOrderIds.size === filteredAvailableOrders.length ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                      {selectedOrderIds.size === filteredAvailableOrders.length ? 'Снять все' : 'Выбрать все'}
                    </button>
                    <span className="text-xs text-gray-500">
                      Выбрано: <b>{selectedOrderIds.size}</b> из {filteredAvailableOrders.length}
                    </span>
                  </div>
                  
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredAvailableOrders.map(order => (
                      <div
                        key={order.id}
                        onClick={() => toggleOrderSelection(order.id)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          selectedOrderIds.has(order.id)
                            ? 'bg-blue-50 border-blue-300'
                            : 'bg-white border-gray-200 hover:border-blue-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedOrderIds.has(order.id)}
                            onChange={() => {}}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 rounded border-gray-300"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-900">
                                Заказ №{order.orderNumber || order.id.slice(-6)}
                              </span>
                              <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">
                                {order.carrier}
                              </span>
                            </div>
                            <div className="flex gap-4 mt-1 text-xs text-gray-500">
                              <span>Мест: {order.quantity || 1}</span>
                              <span>Вес: {order.totalWeight?.toFixed(1) || 0} кг</span>
                              <span>Прибыль: {(order.profit || 0).toLocaleString()} ₽</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            
            <div className="p-4 border-t border-gray-200 flex gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Отмена
              </button>
              <button
                onClick={handleAddSelectedOrders}
                disabled={loading || selectedOrderIds.size === 0}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Добавить выбранные ({selectedOrderIds.size})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}