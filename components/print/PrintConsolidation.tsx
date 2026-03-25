'use client';

import React, { useState, useRef } from 'react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { 
  Printer, X, Package, Truck, CalendarDays, User, 
  Edit2, Save, Plus, Minus, Trash2, AlertCircle 
} from 'lucide-react';
import { updateDoc, doc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { showToast } from '@/components/Toast';

interface Order {
  id: string;
  orderNumber?: string;
  quantity?: number;
  totalWeight?: number;
  totalVolume?: number;
  profit?: number;
  carrier?: string;
  status?: string;
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
  const printRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [currentOrders, setCurrentOrders] = useState<Order[]>(consolidation.orders);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
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

  // Обновление итогов при изменении заказов
  const updateTotals = (orders: Order[]) => {
    const newTotals = calculateTotals(orders);
    setTotals(newTotals);
    return newTotals;
  };

  // Добавление заказа в консоль
  const handleAddOrder = async () => {
    if (!selectedOrderId) {
      showToast('Выберите заказ для добавления', 'error');
      return;
    }

    const orderToAdd = availableOrders.find(o => o.id === selectedOrderId);
    if (!orderToAdd) return;

    // Проверяем, не добавлен ли уже заказ
    if (currentOrders.some(o => o.id === orderToAdd.id)) {
      showToast('Этот заказ уже добавлен в консоль', 'error');
      return;
    }

    setLoading(true);
    try {
      const newOrders = [...currentOrders, orderToAdd];
      const newTotals = updateTotals(newOrders);
      
      // Обновляем в Firebase
      const consolidationRef = doc(db, 'consolidations', consolidation.id);
      await updateDoc(consolidationRef, {
        orders: newOrders,
        totalOrders: newTotals.totalOrders,
        totalWeight: newTotals.totalWeight,
        totalVolume: newTotals.totalVolume,
        totalProfit: newTotals.totalProfit
      });

      setCurrentOrders(newOrders);
      setSelectedOrderId('');
      setShowAddModal(false);
      showToast('Заказ добавлен в консоль', 'success');
      onUpdate();
    } catch (error) {
      console.error('Error adding order to consolidation:', error);
      showToast('Ошибка при добавлении заказа', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Удаление заказа из консоли
  const handleRemoveOrder = async (orderId: string) => {
    if (!confirm('Удалить заказ из консоли?')) return;

    setLoading(true);
    try {
      const newOrders = currentOrders.filter(o => o.id !== orderId);
      const newTotals = updateTotals(newOrders);
      
      // Обновляем в Firebase
      const consolidationRef = doc(db, 'consolidations', consolidation.id);
      await updateDoc(consolidationRef, {
        orders: newOrders,
        totalOrders: newTotals.totalOrders,
        totalWeight: newTotals.totalWeight,
        totalVolume: newTotals.totalVolume,
        totalProfit: newTotals.totalProfit
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

  // Сохранение изменений (для ручного режима)
  const handleSaveChanges = async () => {
    setLoading(true);
    try {
      const consolidationRef = doc(db, 'consolidations', consolidation.id);
      await updateDoc(consolidationRef, {
        orders: currentOrders,
        totalOrders: totals.totalOrders,
        totalWeight: totals.totalWeight,
        totalVolume: totals.totalVolume,
        totalProfit: totals.totalProfit
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

  // Отмена редактирования
  const handleCancelEdit = () => {
    setCurrentOrders(consolidation.orders);
    setTotals(calculateTotals(consolidation.orders));
    setIsEditing(false);
    setShowAddModal(false);
  };

  // Форматирование
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

  const formatWeight = (weight: number) => {
    return weight.toFixed(1).replace('.', ',');
  };

  const formatVolume = (volume: number) => {
    return volume.toFixed(6).replace('.', ',');
  };

  const formatProfit = (profit: number) => {
    return profit.toLocaleString('ru-RU');
  };

  const totalPlaces = currentOrders.reduce((sum, o) => sum + (o.quantity || 0), 0);

  // Печать
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

          {/* Содержимое */}
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
                        Добавить заказ
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

      {/* Модальное окно добавления заказа */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">Добавить заказ в консоль</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {availableOrders.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Нет доступных заказов для добавления</p>
                </div>
              ) : (
                <>
                  <select
                    value={selectedOrderId}
                    onChange={(e) => setSelectedOrderId(e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    <option value="">Выберите заказ</option>
                    {availableOrders.map(order => (
                      <option key={order.id} value={order.id}>
                        {order.orderNumber || order.id.slice(-6)} - {order.carrier}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAddOrder}
                    disabled={loading || !selectedOrderId}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium disabled:opacity-50"
                  >
                    {loading ? 'Добавление...' : 'Добавить'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}