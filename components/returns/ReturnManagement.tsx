'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeftRight, Package, Truck, AlertTriangle, 
  CheckCircle2, XCircle, Loader2, Calendar, User,
  FileText, MessageSquare, RefreshCw, Send, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { showToast } from '@/components/Toast';
import { doc, updateDoc, collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ORDER_STATUSES, RETURN_REASONS } from '@/lib/constants';

interface ReturnManagementProps {
  order: any;
  onUpdate: () => void;
}

export function ReturnManagement({ order, onUpdate }: ReturnManagementProps) {
  const [loading, setLoading] = useState(false);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [showReshipForm, setShowReshipForm] = useState(false);
  const [returnData, setReturnData] = useState({
    reason: '',
    description: '',
    itemsDamaged: false,
    packagingDamaged: false
  });
  const [reshipData, setReshipData] = useState({
    newCarrier: order?.carrier || '',
    notes: ''
  });

  const isReturnable = ['Отправлен', 'Завершен'].includes(order?.status);
  const isReshippable = ['Возврат получен', 'Возврат одобрен'].includes(order?.status);
  const isInReturn = ['Запрошен возврат', 'Возврат одобрен', 'Возврат получен', 'На повторной обработке'].includes(order?.status);

  const handleRequestReturn = async () => {
    if (!returnData.reason) {
      showToast('Выберите причину возврата', 'error');
      return;
    }

    setLoading(true);
    try {
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, {
        status: 'Запрошен возврат',
        returnRequestedAt: new Date().toISOString(),
        returnReason: returnData.reason,
        returnDescription: returnData.description,
        returnItemsDamaged: returnData.itemsDamaged,
        returnPackagingDamaged: returnData.packagingDamaged
      });

      await addDoc(collection(db, 'returns_history'), {
        orderId: order.id,
        orderNumber: order.orderNumber,
        action: 'return_requested',
        reason: returnData.reason,
        description: returnData.description,
        createdAt: new Date().toISOString(),
        createdBy: 'admin'
      });

      showToast('Запрос на возврат отправлен', 'success');
      setShowReturnForm(false);
      onUpdate();
    } catch (error) {
      console.error('Error requesting return:', error);
      showToast('Ошибка при отправке запроса', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveReturn = async () => {
    setLoading(true);
    try {
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, {
        status: 'Возврат одобрен',
        returnApprovedAt: new Date().toISOString()
      });

      await addDoc(collection(db, 'returns_history'), {
        orderId: order.id,
        orderNumber: order.orderNumber,
        action: 'return_approved',
        createdAt: new Date().toISOString(),
        createdBy: 'admin'
      });

      showToast('Возврат одобрен', 'success');
      onUpdate();
    } catch (error) {
      console.error('Error approving return:', error);
      showToast('Ошибка при одобрении возврата', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReturnReceived = async () => {
    setLoading(true);
    try {
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, {
        status: 'Возврат получен',
        returnReceivedAt: new Date().toISOString()
      });

      await addDoc(collection(db, 'returns_history'), {
        orderId: order.id,
        orderNumber: order.orderNumber,
        action: 'return_received',
        createdAt: new Date().toISOString(),
        createdBy: 'admin'
      });

      showToast('Возврат подтвержден', 'success');
      onUpdate();
    } catch (error) {
      console.error('Error confirming return:', error);
      showToast('Ошибка при подтверждении возврата', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReship = async () => {
    if (!reshipData.newCarrier) {
      showToast('Выберите транспортную компанию', 'error');
      return;
    }

    setLoading(true);
    try {
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, {
        status: 'Повторная отправка',
        reshipmentCarrier: reshipData.newCarrier,
        reshipmentNotes: reshipData.notes,
        reshipmentStartedAt: new Date().toISOString(),
        previousStatus: order.status
      });

      await addDoc(collection(db, 'returns_history'), {
        orderId: order.id,
        orderNumber: order.orderNumber,
        action: 'reshipment_started',
        carrier: reshipData.newCarrier,
        notes: reshipData.notes,
        createdAt: new Date().toISOString(),
        createdBy: 'admin'
      });

      showToast('Заказ отправлен на повторную отправку', 'success');
      setShowReshipForm(false);
      onUpdate();
    } catch (error) {
      console.error('Error starting reshipment:', error);
      showToast('Ошибка при отправке на повторную обработку', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteReship = async () => {
    setLoading(true);
    try {
      const orderRef = doc(db, 'orders', order.id);
      await updateDoc(orderRef, {
        status: 'Отправлен',
        reshipmentCompletedAt: new Date().toISOString()
      });

      await addDoc(collection(db, 'returns_history'), {
        orderId: order.id,
        orderNumber: order.orderNumber,
        action: 'reshipment_completed',
        createdAt: new Date().toISOString(),
        createdBy: 'admin'
      });

      showToast('Повторная отправка завершена', 'success');
      onUpdate();
    } catch (error) {
      console.error('Error completing reshipment:', error);
      showToast('Ошибка при завершении отправки', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getReturnStatusInfo = () => {
    switch (order?.status) {
      case 'Запрошен возврат':
        return {
          color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
          icon: AlertTriangle,
          text: 'Ожидает рассмотрения'
        };
      case 'Возврат одобрен':
        return {
          color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
          icon: CheckCircle2,
          text: 'Ожидает возврата'
        };
      case 'Возврат получен':
        return {
          color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
          icon: Package,
          text: 'Возврат получен, можно отправлять повторно'
        };
      case 'На повторной обработке':
        return {
          color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
          icon: RefreshCw,
          text: 'Готовится к повторной отправке'
        };
      case 'Повторная отправка':
        return {
          color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
          icon: Send,
          text: 'Отправлен повторно'
        };
      default:
        return null;
    }
  };

  const returnInfo = getReturnStatusInfo();

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      {/* Заголовок */}
      <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ArrowLeftRight className="w-5 h-5 text-orange-500" />
            <h3 className="font-bold text-slate-900 dark:text-white">Управление возвратами</h3>
          </div>
          {returnInfo && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${returnInfo.color}`}>
              <returnInfo.icon className="w-3 h-3" />
              <span>{returnInfo.text}</span>
            </div>
          )}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Информация о возврате */}
        {order?.returnReason && (
          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-2">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Причина возврата: {RETURN_REASONS.find(r => r.value === order.returnReason)?.label || order.returnReason}
            </p>
            {order.returnDescription && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {order.returnDescription}
              </p>
            )}
            {(order.returnItemsDamaged || order.returnPackagingDamaged) && (
              <div className="flex gap-3 mt-2">
                {order.returnItemsDamaged && (
                  <span className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 px-2 py-1 rounded">
                    Товар поврежден
                  </span>
                )}
                {order.returnPackagingDamaged && (
                  <span className="text-xs text-orange-600 bg-orange-50 dark:bg-orange-950/30 px-2 py-1 rounded">
                    Упаковка повреждена
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Кнопки действий */}
        {isReturnable && !isInReturn && (
          <button
            onClick={() => setShowReturnForm(true)}
            className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeftRight className="w-4 h-4" />
            Запросить возврат
          </button>
        )}

        {order?.status === 'Запрошен возврат' && (
          <div className="flex gap-3">
            <button
              onClick={handleApproveReturn}
              disabled={loading}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Одобрить возврат
            </button>
            <button
              className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium flex items-center justify-center gap-2"
            >
              <XCircle className="w-4 h-4" />
              Отклонить
            </button>
          </div>
        )}

        {order?.status === 'Возврат одобрен' && (
          <button
            onClick={handleConfirmReturnReceived}
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
            Подтвердить получение возврата
          </button>
        )}

        {isReshippable && (
          <button
            onClick={() => setShowReshipForm(true)}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Отправить повторно
          </button>
        )}

        {order?.status === 'Повторная отправка' && (
          <button
            onClick={handleCompleteReship}
            disabled={loading}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Завершить повторную отправку
          </button>
        )}
      </div>

      {/* Модальное окно запроса возврата */}
      <AnimatePresence>
        {showReturnForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowReturnForm(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Запрос возврата</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Заказ №{order?.orderNumber}</p>
              </div>
              
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Причина возврата *
                  </label>
                  <div className="space-y-2">
                    {RETURN_REASONS.map(reason => (
                      <button
                        key={reason.value}
                        type="button"
                        onClick={() => setReturnData({ ...returnData, reason: reason.value })}
                        className={`w-full p-3 text-left rounded-xl border transition-all flex items-center gap-3 ${
                          returnData.reason === reason.value
                            ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30'
                            : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {reason.value === 'DAMAGED' && <AlertTriangle className="w-5 h-5 text-slate-400" />}
                        {reason.value === 'WRONG_ITEM' && <Package className="w-5 h-5 text-slate-400" />}
                        {reason.value === 'QUALITY' && <AlertCircle className="w-5 h-5 text-slate-400" />}
                        {reason.value === 'CUSTOMER_CANCELLED' && <XCircle className="w-5 h-5 text-slate-400" />}
                        {reason.value === 'DELIVERY_FAILED' && <Truck className="w-5 h-5 text-slate-400" />}
                        {reason.value === 'OTHER' && <FileText className="w-5 h-5 text-slate-400" />}
                        <span className="text-sm font-medium">{reason.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Детальное описание
                  </label>
                  <textarea
                    rows={3}
                    value={returnData.description}
                    onChange={(e) => setReturnData({ ...returnData, description: e.target.value })}
                    placeholder="Опишите причину возврата подробнее..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                </div>

                <div className="flex gap-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={returnData.itemsDamaged}
                      onChange={(e) => setReturnData({ ...returnData, itemsDamaged: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300"
                    />
                    <span className="text-sm text-slate-600 dark:text-slate-400">Товар поврежден</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={returnData.packagingDamaged}
                      onChange={(e) => setReturnData({ ...returnData, packagingDamaged: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300"
                    />
                    <span className="text-sm text-slate-600 dark:text-slate-400">Упаковка повреждена</span>
                  </label>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                <button
                  onClick={() => setShowReturnForm(false)}
                  className="flex-1 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-medium"
                >
                  Отмена
                </button>
                <button
                  onClick={handleRequestReturn}
                  disabled={loading}
                  className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Отправить запрос
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Модальное окно повторной отправки */}
      <AnimatePresence>
        {showReshipForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowReshipForm(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Повторная отправка</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Заказ №{order?.orderNumber}</p>
              </div>
              
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Транспортная компания *
                  </label>
                  <select
                    value={reshipData.newCarrier}
                    onChange={(e) => setReshipData({ ...reshipData, newCarrier: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-purple-500 outline-none"
                  >
                    <option value="">Выберите ТК</option>
                    <option value="CDEK">CDEK</option>
                    <option value="DPD">DPD</option>
                    <option value="Почта России">Почта России</option>
                    <option value="Деловые линии">Деловые линии</option>
                    <option value="ПЭК">ПЭК</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Примечания
                  </label>
                  <textarea
                    rows={3}
                    value={reshipData.notes}
                    onChange={(e) => setReshipData({ ...reshipData, notes: e.target.value })}
                    placeholder="Дополнительная информация для повторной отправки..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-purple-500 outline-none"
                  />
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                <button
                  onClick={() => setShowReshipForm(false)}
                  className="flex-1 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-medium"
                >
                  Отмена
                </button>
                <button
                  onClick={handleReship}
                  disabled={loading}
                  className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Отправить
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}