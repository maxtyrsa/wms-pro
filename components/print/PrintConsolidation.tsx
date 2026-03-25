'use client';

import React, { useState } from 'react';
import { Printer, Package, Truck, CalendarDays, User, Hash, Weight, Box, DollarSign, X, Plus, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { showToast } from '@/components/Toast';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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

interface PrintConsolidationProps {
  consolidation: Consolidation;
  onClose: () => void;
  onUpdate?: () => void;
  availableOrders?: any[];
}

export function PrintConsolidation({ consolidation, onClose, onUpdate, availableOrders = [] }: PrintConsolidationProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const handlePrint = () => {
    const printContent = document.getElementById('print-content');
    if (!printContent) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Консоль ${consolidation.consolidationNumber}</title>
          <meta charset="UTF-8">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: 'Segoe UI', 'Roboto', 'Arial', sans-serif; padding: 20px; background: white; color: #1e293b; }
            .container { max-width: 1200px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #e2e8f0; }
            .header h1 { font-size: 28px; font-weight: bold; margin-bottom: 8px; color: #0f172a; }
            .header p { color: #64748b; font-size: 14px; }
            .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; margin-bottom: 30px; background: #f8fafc; padding: 20px; border-radius: 12px; }
            .info-item { display: flex; align-items: center; gap: 12px; }
            .info-icon { width: 40px; height: 40px; background: #e2e8f0; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
            .info-content { flex: 1; }
            .info-label { font-size: 11px; text-transform: uppercase; font-weight: 600; color: #64748b; letter-spacing: 0.5px; margin-bottom: 4px; }
            .info-value { font-size: 16px; font-weight: 600; color: #0f172a; }
            .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 30px; }
            .stat-card { background: #f1f5f9; padding: 16px; border-radius: 12px; text-align: center; }
            .stat-value { font-size: 28px; font-weight: bold; color: #2563eb; margin-bottom: 4px; }
            .stat-label { font-size: 12px; color: #475569; text-transform: uppercase; font-weight: 500; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { background: #f1f5f9; padding: 12px; text-align: left; font-size: 12px; font-weight: 600; color: #475569; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; }
            td { padding: 12px; font-size: 13px; border-bottom: 1px solid #e2e8f0; color: #334155; }
            .total-row { background: #f8fafc; font-weight: 600; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8; }
            @media print { body { padding: 0; } .no-print { display: none; } }
          </style>
        </head>
        <body>
          <div class="container" id="print-content">
            ${printContent.innerHTML}
          </div>
          <div class="footer">
            Документ сформирован: ${format(new Date(), 'dd.MM.yyyy HH:mm', { locale: ru })}<br>
            WMS Kupi-Flakon — Система управления складом
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.print();
    printWindow.onafterprint = () => printWindow.close();
  };

  const handleRemoveOrder = async (orderId: string) => {
    if (!confirm('Удалить заказ из консоли?')) return;
    
    setLoading(true);
    try {
      const orderToRemove = consolidation.orders.find(o => o.id === orderId);
      if (!orderToRemove) return;
      
      const consolidationRef = doc(db, 'consolidations', consolidation.id);
      await updateDoc(consolidationRef, {
        orders: arrayRemove(orderToRemove),
        totalOrders: consolidation.totalOrders - 1,
        totalWeight: consolidation.totalWeight - (orderToRemove.totalWeight || 0),
        totalVolume: consolidation.totalVolume - (orderToRemove.totalVolume || 0),
        totalProfit: consolidation.totalProfit - (orderToRemove.profit || 0)
      });
      
      // Возвращаем заказ в статус "Оформлен"
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        status: 'Оформлен',
        consolidationId: null
      });
      
      showToast('Заказ удален из консоли', 'success');
      if (onUpdate) onUpdate();
      onClose();
    } catch (error) {
      console.error('Error removing order:', error);
      showToast('Ошибка при удалении заказа', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddOrders = async () => {
    if (selectedOrders.size === 0) return;
    
    setLoading(true);
    try {
      const ordersToAdd = availableOrders.filter(o => selectedOrders.has(o.id));
      let newTotalWeight = consolidation.totalWeight;
      let newTotalVolume = consolidation.totalVolume;
      let newTotalProfit = consolidation.totalProfit;
      const newOrders = [...consolidation.orders];
      
      for (const order of ordersToAdd) {
        newOrders.push(order);
        newTotalWeight += order.totalWeight || 0;
        newTotalVolume += order.totalVolume || 0;
        newTotalProfit += order.profit || 0;
        
        // Меняем статус заказа
        const orderRef = doc(db, 'orders', order.id);
        await updateDoc(orderRef, {
          status: 'В консолидации',
          consolidationId: consolidation.id
        });
      }
      
      const consolidationRef = doc(db, 'consolidations', consolidation.id);
      await updateDoc(consolidationRef, {
        orders: newOrders,
        totalOrders: newOrders.length,
        totalWeight: newTotalWeight,
        totalVolume: newTotalVolume,
        totalProfit: newTotalProfit
      });
      
      showToast(`Добавлено ${selectedOrders.size} заказов`, 'success');
      setShowAddModal(false);
      setSelectedOrders(new Set());
      if (onUpdate) onUpdate();
      onClose();
    } catch (error) {
      console.error('Error adding orders:', error);
      showToast('Ошибка при добавлении заказов', 'error');
    } finally {
      setLoading(false);
    }
  };

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
    if (selectedOrders.size === availableOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(availableOrders.map(o => o.id)));
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Ожидает отправки';
      case 'shipped': return 'Отправлена';
      case 'cancelled': return 'Отменена';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return '#f59e0b';
      case 'shipped': return '#10b981';
      case 'cancelled': return '#ef4444';
      default: return '#64748b';
    }
  };

  const isEditable = consolidation.status === 'pending';

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
      <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Консоль {consolidation.consolidationNumber}</h2>
        <div className="flex gap-2">
          {isEditable && (
            <>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Добавить заказы
              </button>
              <button
                onClick={handlePrint}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
              >
                <Printer className="w-4 h-4" />
                Печать
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>

      <div id="print-content" className="p-6">
        {/* Заголовок */}
        <div className="text-center mb-8 pb-4 border-b border-slate-200 dark:border-slate-800">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Консоль отправки #{consolidation.consolidationNumber}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Сформирована: {format(new Date(consolidation.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
          </p>
        </div>

        {/* Основная информация */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 bg-slate-50 dark:bg-slate-800 p-5 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-lg flex items-center justify-center">
              <Truck className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">Транспортная компания</p>
              <p className="font-bold text-slate-900 dark:text-white">{consolidation.carrier}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">Ответственный</p>
              <p className="font-bold text-slate-900 dark:text-white">{consolidation.responsiblePerson}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-lg flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">Планируемая отправка</p>
              <p className="font-bold text-slate-900 dark:text-white">
                {format(new Date(consolidation.plannedShipmentDate), 'dd.MM.yyyy', { locale: ru })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-lg flex items-center justify-center">
              <div className="w-5 h-5 rounded-full" style={{ backgroundColor: getStatusColor(consolidation.status) }} />
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">Статус</p>
              <p className="font-bold" style={{ color: getStatusColor(consolidation.status) }}>
                {getStatusText(consolidation.status)}
              </p>
            </div>
          </div>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{consolidation.totalOrders}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 uppercase mt-1">Заказов</div>
          </div>
          <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{consolidation.totalWeight.toFixed(1)}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 uppercase mt-1">Вес, кг</div>
          </div>
          <div className="text-center p-4 bg-purple-50 dark:bg-purple-950/30 rounded-xl">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{consolidation.totalVolume.toFixed(4)}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 uppercase mt-1">Объем, м³</div>
          </div>
          <div className="text-center p-4 bg-amber-50 dark:bg-amber-950/30 rounded-xl">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{consolidation.totalProfit.toLocaleString()}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 uppercase mt-1">Прибыль, ₽</div>
          </div>
        </div>

        {/* Таблица заказов */}
        <div className="mb-6">
          <h3 className="font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
            <Package className="w-4 h-4" />
            Список заказов в консоли
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800">
                  <th className="px-3 py-2 text-left text-xs font-semibold">№ п/п</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Номер заказа</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Мест</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Вес, кг</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold">Объем, м³</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold">Прибыль, ₽</th>
                  {isEditable && <th className="px-3 py-2 text-center text-xs font-semibold"></th>}
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {consolidation.orders.map((order, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2 text-sm">{idx + 1}</td>
                    <td className="px-3 py-2 text-sm font-medium">{order.orderNumber}</td>
                    <td className="px-3 py-2 text-sm">{order.quantity}</td>
                    <td className="px-3 py-2 text-sm">{order.totalWeight?.toFixed(2) || 0}</td>
                    <td className="px-3 py-2 text-sm">{order.totalVolume?.toFixed(6) || 0}</td>
                    <td className="px-3 py-2 text-sm text-right font-medium text-emerald-600 dark:text-emerald-400">
                      {order.profit?.toLocaleString() || 0}
                    </td>
                    {isEditable && (
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => handleRemoveOrder(order.id)}
                          disabled={loading}
                          className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
                <tr className="bg-slate-50 dark:bg-slate-800 font-semibold">
                  <td colSpan={2} className="px-3 py-3 text-sm">ИТОГО:</td>
                  <td className="px-3 py-3 text-sm">{consolidation.totalOrders}</td>
                  <td className="px-3 py-3 text-sm">{consolidation.totalWeight.toFixed(2)}</td>
                  <td className="px-3 py-3 text-sm">{consolidation.totalVolume.toFixed(6)}</td>
                  <td className="px-3 py-3 text-sm text-right text-emerald-700 dark:text-emerald-400">
                    {consolidation.totalProfit.toLocaleString()}
                  </td>
                  {isEditable && <td></td>}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {consolidation.notes && (
          <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase mb-2">Примечания</p>
            <p className="text-sm text-slate-700 dark:text-slate-300">{consolidation.notes}</p>
          </div>
        )}
      </div>

      {/* Модальное окно добавления заказов */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Добавить заказы в консоль</h3>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-100 rounded-full">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {availableOrders.length === 0 ? (
                <p className="text-center text-slate-500 py-8">Нет доступных заказов для добавления</p>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <button
                      onClick={toggleAllSelection}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      {selectedOrders.size === availableOrders.length ? 'Снять все' : 'Выбрать все'}
                    </button>
                    <span className="text-sm text-slate-500">Выбрано: {selectedOrders.size}</span>
                  </div>
                  
                  <div className="space-y-2">
                    {availableOrders.map(order => (
                      <div
                        key={order.id}
                        className={`p-4 rounded-xl border cursor-pointer transition-all ${
                          selectedOrders.has(order.id)
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                        onClick={() => toggleOrderSelection(order.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">Заказ №{order.orderNumber}</p>
                            <p className="text-sm text-slate-500">{order.carrier} · {order.quantity} мест · {order.totalWeight} кг</p>
                          </div>
                          <span className="text-emerald-600 font-bold">{order.profit?.toLocaleString()} ₽</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            
            <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-3 border border-slate-200 rounded-xl text-slate-700 font-medium"
              >
                Отмена
              </button>
              <button
                onClick={handleAddOrders}
                disabled={selectedOrders.size === 0 || loading}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Добавить ({selectedOrders.size})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}