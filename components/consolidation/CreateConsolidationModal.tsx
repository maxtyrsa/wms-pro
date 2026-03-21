'use client';

import React, { useState } from 'react';
import { X, Loader2, Calendar, User, Package, Truck, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, writeBatch } from 'firebase/firestore';
import { showToast } from '@/components/Toast';
import { format } from 'date-fns';

interface ConsolidationOrder {
  id: string;
  orderNumber: string;
  carrier: string;
  quantity: number;
  totalWeight: number;
  totalVolume: number;
  createdBy: string;
  payment_sum: number;
  profit: number;
}

interface CreateConsolidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedOrders: ConsolidationOrder[];
  onSuccess: () => void;
}

export function CreateConsolidationModal({ isOpen, onClose, selectedOrders, onSuccess }: CreateConsolidationModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    plannedShipmentDate: format(new Date(), 'yyyy-MM-dd'),
    responsiblePerson: '',
    notes: ''
  });

  console.log('Modal isOpen:', isOpen);
  console.log('Selected orders:', selectedOrders);

  if (!isOpen) return null;

  const carriers = [...new Set(selectedOrders.map(o => o.carrier))];
  const mainCarrier = carriers.length === 1 ? carriers[0] : 'mixed';
  
  const totalOrders = selectedOrders.length;
  const totalWeight = selectedOrders.reduce((sum, o) => sum + (o.totalWeight || 0), 0);
  const totalVolume = selectedOrders.reduce((sum, o) => sum + (o.totalVolume || 0), 0);
  const totalProfit = selectedOrders.reduce((sum, o) => sum + (o.profit || 0), 0);

  const generateConsolidationNumber = () => {
    const date = new Date();
    const dateStr = format(date, 'yyyy-MM-dd');
    const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
    return `CON-${dateStr}-${random}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.responsiblePerson.trim()) {
      showToast('Укажите ответственного сотрудника', 'error');
      return;
    }

    setLoading(true);

    try {
      const consolidationNumber = generateConsolidationNumber();
      const now = new Date().toISOString();

      const consolidationData = {
        consolidationNumber,
        carrier: mainCarrier,
        createdAt: now,
        createdBy: formData.responsiblePerson,
        orders: selectedOrders.map(o => ({
          id: o.id,
          orderNumber: o.orderNumber,
          quantity: o.quantity,
          totalWeight: o.totalWeight,
          totalVolume: o.totalVolume,
          createdBy: o.createdBy,
          payment_sum: o.payment_sum,
          profit: o.profit
        })),
        totalOrders,
        totalWeight,
        totalVolume,
        totalProfit,
        plannedShipmentDate: formData.plannedShipmentDate,
        status: 'pending',
        responsiblePerson: formData.responsiblePerson,
        notes: formData.notes
      };

      console.log('Creating consolidation:', consolidationData);

      const docRef = await addDoc(collection(db, 'consolidations'), consolidationData);

      const batch = writeBatch(db);
      selectedOrders.forEach(order => {
        const orderRef = doc(db, 'orders', order.id);
        batch.update(orderRef, {
          status: 'В консолидации',
          consolidationId: docRef.id
        });
      });
      await batch.commit();

      showToast(`Консоль ${consolidationNumber} успешно создана`, 'success');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating consolidation:', error);
      showToast('Ошибка при создании консоли', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers className="w-6 h-6 text-blue-600" />
                  Создание консоли
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Выбрано {selectedOrders.length} заказов
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl space-y-3">
                <h3 className="font-semibold text-slate-900 dark:text-white">Параметры партии</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Транспортная компания</p>
                    <p className="font-semibold text-slate-900 dark:text-white">{mainCarrier === 'mixed' ? 'Разные ТК' : mainCarrier}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Количество заказов</p>
                    <p className="font-semibold text-slate-900 dark:text-white">{totalOrders}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Общий вес</p>
                    <p className="font-semibold text-slate-900 dark:text-white">{totalWeight.toFixed(1)} кг</p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Общий объем</p>
                    <p className="font-semibold text-slate-900 dark:text-white">{totalVolume.toFixed(4)} м³</p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Общая прибыль</p>
                    <p className="font-semibold text-emerald-600 dark:text-emerald-400">{totalProfit.toLocaleString()} ₽</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    <User className="w-4 h-4 inline mr-1" />
                    Ответственный сотрудник *
                  </label>
                  <input
                    type="text"
                    value={formData.responsiblePerson}
                    onChange={(e) => setFormData({ ...formData, responsiblePerson: e.target.value })}
                    placeholder="Фамилия И.О."
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Планируемая дата отправки *
                  </label>
                  <input
                    type="date"
                    value={formData.plannedShipmentDate}
                    onChange={(e) => setFormData({ ...formData, plannedShipmentDate: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Примечания
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Дополнительная информация..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Входящие заказы</h3>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {selectedOrders.map(order => (
                    <div key={order.id} className="flex items-center justify-between text-sm p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <span className="font-medium text-slate-900 dark:text-white">{order.orderNumber}</span>
                      <span className="text-slate-500 dark:text-slate-400">{order.quantity} мест</span>
                      <span className="text-slate-500 dark:text-slate-400">{order.totalWeight} кг</span>
                      <span className="text-emerald-600 dark:text-emerald-400">{order.profit.toLocaleString()} ₽</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Truck className="w-5 h-5" />
                  )}
                  Создать консоль
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}