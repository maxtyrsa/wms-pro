'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { motion } from 'motion/react';
import { ArrowLeft, Loader2, Package, Truck, Clock, Info, Hash, Weight, Box } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

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
}

export default function OrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState<string | null>(null);
  const { role } = useAuth();
  
  const isAdmin = role === 'admin';

  // Функция для расчета общего объема
  const calculateTotalVolume = (order: OrderData): number => {
    if (order.totalVolume) return order.totalVolume;
    if (order.places_data && order.places_data.length > 0) {
      return order.places_data.reduce((acc, p) => {
        const v = (Number(p.d || 0) * Number(p.w || 0) * Number(p.h || 0)) / 1000000;
        return acc + (isNaN(v) ? 0 : v);
      }, 0);
    }
    return 0;
  };

  // Функция для расчета общего веса
  const calculateTotalWeight = (order: OrderData): number => {
    if (order.totalWeight) return order.totalWeight;
    if (order.places_data && order.places_data.length > 0) {
      return order.places_data.reduce((acc, p) => acc + (Number(p.weight) || 0), 0);
    }
    return 0;
  };

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

  // Расчет времени сборки
  useEffect(() => {
    if (!order?.time_start || order?.time_end) {
      setElapsedTime(null);
      return;
    }

    const updateTimer = () => {
      const start = order.time_start?.toDate ? order.time_start.toDate() : new Date(order.time_start);
      const now = new Date();
      const diff = Math.floor((now.getTime() - start.getTime()) / 1000);
      const mins = Math.floor(diff / 60);
      const secs = diff % 60;
      setElapsedTime(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [order?.time_start, order?.time_end]);

  // Финальное время сборки
  const getFinalAssemblyTime = () => {
    if (!order?.time_start || !order?.time_end) return null;
    const start = order.time_start.toDate ? order.time_start.toDate() : new Date(order.time_start);
    const end = order.time_end.toDate ? order.time_end.toDate() : new Date(order.time_end);
    const diff = Math.floor((end.getTime() - start.getTime()) / 1000);
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    if (!status) return 'bg-slate-100 text-slate-800';
    switch (status) {
      case 'Новый': return 'bg-purple-100 text-purple-800';
      case 'Комплектация': return 'bg-blue-100 text-blue-800';
      case 'В работе': return 'bg-blue-100 text-blue-800';
      case 'Ожидает оформления': return 'bg-amber-100 text-amber-800';
      case 'Готов к выдаче': return 'bg-emerald-100 text-emerald-800';
      case 'Оформлен': return 'bg-emerald-100 text-emerald-800';
      case 'Завершен': return 'bg-slate-200 text-slate-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getNextAction = () => {
    if (!order) return null;
    
    // Для сотрудников - только навигация
    if (!isAdmin) {
      if (order.status === 'Новый') {
        const href = order.carrier === 'Самовывоз' ? `/employee/assembly/${id}` : `/employee/add_money/${id}`;
        return (
          <Link href={href} className="block w-full text-center bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-colors shadow-sm">
            Перейти к оплате/сборке
          </Link>
        );
      }
      
      if (order.status === 'В работе' || order.status === 'Комплектация') {
        if (order.time_end && order.carrier !== 'Самовывоз') {
          return (
            <Link href={`/employee/add_dimensions/${id}`} className="block w-full text-center bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-colors shadow-sm flex items-center justify-center gap-2">
              <Package className="w-5 h-5" />
              Ввести габариты
            </Link>
          );
        }
        return (
          <Link href={`/employee/assembly/${id}`} className="block w-full text-center bg-amber-500 text-white py-4 rounded-2xl font-bold hover:bg-amber-600 transition-colors shadow-sm flex items-center justify-center gap-2">
            <Clock className="w-5 h-5" />
            Продолжить сборку
          </Link>
        );
      }
      
      if (order.status === 'Ожидает оформления') {
        return (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl flex items-center gap-3">
            <Info className="w-6 h-6 text-amber-600 shrink-0" />
            <div>
              <p className="font-bold">Ожидает оформления</p>
              <p className="text-sm text-amber-700">Заказ ожидает оформления администратором.</p>
            </div>
          </div>
        );
      }
      
      if (order.status === 'Готов к выдаче') {
        return (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl flex items-center gap-3">
            <Info className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <p className="font-bold">Готов к выдаче</p>
              <p className="text-sm text-emerald-700">Заказ собран и готов к передаче клиенту.</p>
            </div>
          </div>
        );
      }
      
      return null;
    }

    // Администраторская панель
    if (order.status === 'Новый') {
      const href = order.carrier === 'Самовывоз' ? `/employee/assembly/${id}` : `/employee/add_money/${id}`;
      return (
        <Link href={href} className="block w-full text-center bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-colors shadow-sm">
          Перейти к оплате/сборке
        </Link>
      );
    }
    
    return null;
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

  const finalTime = getFinalAssemblyTime();
  const isTimerActive = (order.status === 'В работе' || order.status === 'Комплектация') && order.time_start && !order.time_end;
  const totalVolume = calculateTotalVolume(order);
  const totalWeight = calculateTotalWeight(order);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 transition-colors duration-200">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-4 sticky top-0 z-10 flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-400" />
        </button>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Карточка заказа</h1>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-6"
        >
          {/* Header Info */}
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
              <span className="font-bold text-slate-900 dark:text-white">{order.carrier || '—'}</span>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
              <div className="flex items-center gap-3 text-slate-700 dark:text-slate-300">
                <Info className="w-5 h-5 text-purple-500" />
                <span className="font-medium">Статус</span>
              </div>
              <span className={`px-3 py-1 rounded-lg text-sm font-bold uppercase tracking-wider ${getStatusColor(order.status)}`}>
                {order.status || '—'}
              </span>
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
              <span className="font-bold text-slate-900 dark:text-white">{order.quantity || 0}</span>
            </div>

            {(isTimerActive || finalTime) && (
              <div className={`flex items-center justify-between p-4 rounded-2xl ${isTimerActive ? 'bg-blue-50 dark:bg-blue-950/30' : 'bg-slate-50 dark:bg-slate-800'}`}>
                <div className="flex items-center gap-3">
                  <Clock className={`w-5 h-5 ${isTimerActive ? 'text-blue-500' : 'text-slate-500'}`} />
                  <span className="font-medium">Время сборки</span>
                </div>
                <span className={`font-mono font-bold text-lg ${isTimerActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-900 dark:text-white'}`}>
                  {isTimerActive ? elapsedTime : finalTime}
                </span>
              </div>
            )}
          </div>

          {/* Places Info */}
          {order.places_data && order.places_data.length > 0 ? (
            <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Box className="w-5 h-5 text-slate-400" />
                Информация о местах
              </h3>
              <div className="space-y-2">
                {order.places_data.map((place, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm">
                    <span className="font-medium text-slate-700 dark:text-slate-300">Место {index + 1}</span>
                    <span className="text-slate-600 dark:text-slate-400">
                      {place.d || 0}×{place.w || 0}×{place.h || 0} см, {place.weight || 0} кг
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-2 space-y-2">
                <div className="flex justify-between items-center bg-blue-50 dark:bg-blue-950/30 p-3 rounded-xl">
                  <span className="text-blue-800 dark:text-blue-300 font-medium flex items-center gap-2">
                    <Weight className="w-4 h-4" />
                    Общий вес:
                  </span>
                  <span className="text-blue-900 dark:text-blue-200 font-bold">
                    {totalWeight.toFixed(2)} кг
                  </span>
                </div>
                <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-xl">
                  <span className="text-emerald-800 dark:text-emerald-300 font-medium flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Общий объем:
                  </span>
                  <span className="text-emerald-900 dark:text-emerald-200 font-bold">
                    {totalVolume.toFixed(4)} м³
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
              <p className="text-slate-500 dark:text-slate-400 text-center italic">Габариты не указаны</p>
            </div>
          )}

          {/* Финансовая информация (только для оформленных заказов) */}
          {(order.payment_sum !== undefined && order.payment_sum !== null) || 
           (order.delivery_cost !== undefined && order.delivery_cost !== null) ? (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <h3 className="font-bold text-slate-900 dark:text-white">Финансовая информация</h3>
              {order.payment_sum !== undefined && order.payment_sum !== null && (
                <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <span className="text-slate-600 dark:text-slate-400">Сумма оплаты:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{order.payment_sum.toLocaleString()} ₽</span>
                </div>
              )}
              {order.delivery_cost !== undefined && order.delivery_cost !== null && (
                <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <span className="text-slate-600 dark:text-slate-400">Стоимость доставки:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{order.delivery_cost.toLocaleString()} ₽</span>
                </div>
              )}
              {order.profit !== undefined && order.profit !== null && (
                <div className="flex justify-between items-center p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl">
                  <span className="text-emerald-700 dark:text-emerald-300 font-medium">Прибыль:</span>
                  <span className="font-bold text-emerald-800 dark:text-emerald-200">{order.profit.toLocaleString()} ₽</span>
                </div>
              )}
            </div>
          ) : null}

          {/* Action Buttons */}
          <div className="pt-4">
            {getNextAction()}
          </div>
        </motion.div>
      </main>
    </div>
  );
}