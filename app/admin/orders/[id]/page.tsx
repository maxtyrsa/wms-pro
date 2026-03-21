'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
impoaff rt { motion } from 'motion/react';
import { ArrowLeft, Loader2, Package, Truck, Clock, Info, Hash, Weight, Box, CheckCircle2, X, Edit2, Save } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { showToast } from '@/components/Toast';

interface OrderData {
  id: string;
  orderNumber?: string;
  carrier: string;
  quantity: number;
  status: string;
  createdAt: string;
  createdBy: string;
  time_start?: any;
  time_end?: any;
  places_data?: Array<{ d: number; w: number; h: number; weight: number }>;
  totalVolume?: number;
  totalWeight?: number;
  payment_sum?: number;
  delivery_cost?: number;
  profit?: number;
  history?: Array<{ status: string; timestamp: string; user: string }>;
}

const STATUSES = ['Новый', 'Комплектация', 'Ожидает оформления', 'Готов к выдаче', 'Оформлен', 'Отправлен', 'Выдан'];

export default function AdminOrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { user, role } = useAuth();

  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [editingPayment, setEditingPayment] = useState(false);
  const [tempPaymentSum, setTempPaymentSum] = useState<number>(0);
  const [tempDeliveryCost, setTempDeliveryCost] = useState<number>(0);

  useEffect(() => {
    if (role !== 'admin') {
      router.push('/');
      return;
    }
  }, [role, router]);

  useEffect(() => {
    if (!id) {
      setError('ID заказа не указан');
      setLoading(false);
      return;
    }

    async function fetchOrder() {
      try {
        const docRef = doc(db, 'orders', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setOrder({ id: docSnap.id, ...data } as OrderData);
          setTempPaymentSum(data.payment_sum || 0);
          setTempDeliveryCost(data.delivery_cost || 0);
        } else {
          setError('Заказ не найден');
        }
      } catch (err: any) {
        console.error('Error fetching order:', err);
        setError(err.message || 'Ошибка загрузки заказа');
      } finally {
        setLoading(false);
      }
    }
    
    fetchOrder();
  }, [id]);

  const handleStatusChange = async (newStatus: string) => {
    if (!order) return;
    
    setUpdating(true);
    try {
      const orderRef = doc(db, 'orders', order.id);
      const updateData: any = { 
        status: newStatus,
        history: [...(order.history || []), {
          status: newStatus,
          timestamp: new Date().toISOString(),
          user: user?.email || 'admin'
        }]
      };
      
      if (newStatus === 'Отправлен') {
        updateData.shippedAt = serverTimestamp();
      }
      if (newStatus === 'Выдан') {
        updateData.issuedAt = serverTimestamp();
      }
      
      await updateDoc(orderRef, updateData);
      setOrder({ ...order, ...updateData });
      showToast(`Статус изменен на "${newStatus}"`, 'success');
    } catch (error) {
      console.error('Error updating status:', error);
      showToast('Ошибка при изменении статуса', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveFinance = async () => {
    if (!order) return;
    
    setUpdating(true);
    try {
      const orderRef = doc(db, 'orders', order.id);
      const profit = tempPaymentSum - tempDeliveryCost;
      await updateDoc(orderRef, {
        payment_sum: tempPaymentSum,
        delivery_cost: tempDeliveryCost,
        profit: profit
      });
      setOrder({ ...order, payment_sum: tempPaymentSum, delivery_cost: tempDeliveryCost, profit });
      setEditingPayment(false);
      showToast('Финансовая информация сохранена', 'success');
    } catch (error) {
      console.error('Error saving finance:', error);
      showToast('Ошибка при сохранении финансов', 'error');
    } finally {
      setUpdating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Новый': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'Комплектация': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'В работе': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'Ожидает оформления': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
      case 'Готов к выдаче': return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300';
      case 'Оформлен': return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300';
      case 'Отправлен': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
      case 'Выдан': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
      default: return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  const getAssemblyTime = () => {
    if (!order?.time_start || !order?.time_end) return null;
    const start = order.time_start.toDate ? order.time_start.toDate() : new Date(order.time_start);
    const end = order.time_end.toDate ? order.time_end.toDate() : new Date(order.time_end);
    const diff = Math.floor((end.getTime() - start.getTime()) / 1000);
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen p-4 bg-slate-50 dark:bg-slate-950">
        <div className="bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-800 text-red-700 dark:text-red-300 p-4 rounded-xl">
          {error || 'Заказ не найден'}
        </div>
      </div>
    );
  }

  const assemblyTime = getAssemblyTime();
  const totalVolume = order.totalVolume || order.places_data?.reduce((acc, p) => acc + (p.d * p.w * p.h) / 1000000, 0) || 0;
  const totalWeight = order.totalWeight || order.places_data?.reduce((acc, p) => acc + p.weight, 0) || 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-4 sticky top-0 z-10 flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-400" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Карточка заказа</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Управление заказом №{order.orderNumber || 'Без номера'}</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-6">
        {/* Основная информация */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-6"
        >
          <div className="text-center space-y-2">
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Заказ №</p>
            <h2 className="text-4xl font-black text-slate-900 dark:text-white">{order.orderNumber || 'Без номера'}</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {order.createdAt && format(new Date(order.createdAt), 'dd MMMM yyyy, HH:mm', { locale: ru })}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
              <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                <Truck className="w-5 h-5 text-blue-500" />
                <span className="font-medium">Транспортная компания</span>
              </div>
              <span className="font-bold text-slate-900 dark:text-white">{order.carrier}</span>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
              <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                <Package className="w-5 h-5 text-emerald-500" />
                <span className="font-medium">Сборщик</span>
              </div>
              <span className="font-bold text-slate-900 dark:text-white">{order.createdBy?.split('@')[0] || order.createdBy || '—'}</span>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
              <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                <Box className="w-5 h-5 text-orange-500" />
                <span className="font-medium">Количество мест</span>
              </div>
              <span className="font-bold text-slate-900 dark:text-white">{order.quantity}</span>
            </div>

            {assemblyTime && (
              <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-950/30 rounded-2xl">
                <div className="flex items-center gap-3 text-blue-700 dark:text-blue-300">
                  <Clock className="w-5 h-5 text-blue-500" />
                  <span className="font-medium">Время сборки</span>
                </div>
                <span className="font-bold text-blue-900 dark:text-blue-300 font-mono text-lg">{assemblyTime}</span>
              </div>
            )}
          </div>
        </motion.div>

        {/* Управление статусом */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800"
        >
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            Управление статусом
          </h2>
          
          <div className="flex flex-wrap gap-2 mb-4">
            {STATUSES.map(status => (
              <button
                key={status}
                onClick={() => handleStatusChange(status)}
                disabled={updating || order.status === status}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  order.status === status
                    ? `bg-slate-900 dark:bg-slate-700 text-white`
                    : `bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700`
                } disabled:opacity-50`}
              >
                {status}
              </button>
            ))}
          </div>
          
          <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Текущий статус</p>
            <p className={`inline-block px-3 py-1 rounded-lg text-sm font-bold ${getStatusColor(order.status)}`}>
              {order.status}
            </p>
          </div>
        </motion.div>

        {/* Финансовая информация */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>💰 Финансовая информация</span>
            </h2>
            {!editingPayment && (
              <button
                onClick={() => setEditingPayment(true)}
                className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {editingPayment ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Сумма заказа (без доставки)
                </label>
                <input
                  type="number"
                  value={tempPaymentSum}
                  onChange={(e) => setTempPaymentSum(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Стоимость доставки
                </label>
                <input
                  type="number"
                  value={tempDeliveryCost}
                  onChange={(e) => setTempDeliveryCost(Number(e.target.value))}
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSaveFinance}
                  disabled={updating}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {updating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Сохранить
                </button>
                <button
                  onClick={() => {
                    setEditingPayment(false);
                    setTempPaymentSum(order.payment_sum || 0);
                    setTempDeliveryCost(order.delivery_cost || 0);
                  }}
                  className="flex-1 py-3 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl">
                <span className="text-blue-800 dark:text-blue-300 font-medium">Сумма заказа (без доставки):</span>
                <span className="font-bold text-blue-900 dark:text-blue-200">{order.payment_sum?.toLocaleString() || 0} ₽</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-orange-50 dark:bg-orange-950/30 rounded-xl">
                <span className="text-orange-800 dark:text-orange-300 font-medium">Стоимость доставки:</span>
                <span className="font-bold text-orange-900 dark:text-orange-200">{order.delivery_cost?.toLocaleString() || 0} ₽</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl">
                <span className="text-emerald-800 dark:text-emerald-300 font-medium">Чистая прибыль:</span>
                <span className="font-bold text-emerald-900 dark:text-emerald-200 text-lg">{order.profit?.toLocaleString() || 0} ₽</span>
              </div>
            </div>
          )}
        </motion.div>

        {/* Габариты мест */}
        {order.places_data && order.places_data.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800"
          >
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Hash className="w-5 h-5 text-blue-500" />
              Габариты мест
            </h2>
            <div className="space-y-2">
              {order.places_data.map((place, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-blue-500 bg-blue-50 dark:bg-blue-950/50 w-6 h-6 flex items-center justify-center rounded-lg">{idx + 1}</span>
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {place.d}×{place.w}×{place.h} см
                    </span>
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white">{place.weight} кг</span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-3">
              <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400">Общий вес</p>
                <p className="font-bold text-slate-900 dark:text-white">{totalWeight.toFixed(2)} кг</p>
              </div>
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl text-center">
                <p className="text-xs text-slate-500 dark:text-slate-400">Общий объем</p>
                <p className="font-bold text-slate-900 dark:text-white">{totalVolume.toFixed(4)} м³</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* История изменений */}
        {order.history && order.history.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800"
          >
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-slate-400" />
              История изменений
            </h2>
            <div className="space-y-2">
              {order.history.slice().reverse().map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <div className="w-2 h-2 mt-2 rounded-full bg-blue-500 shrink-0"></div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${getStatusColor(item.status)}`}>
                        {item.status}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {format(new Date(item.timestamp), 'dd.MM.yyyy HH:mm')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {item.user}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}