'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getOrderById, updateOrderStatus } from '@/lib/orders';
import { useAuth } from '@/context/AuthContext';
import { motion } from 'motion/react';
import { ArrowLeft, Loader2, Package, Truck, Clock, Info } from 'lucide-react';
import Link from 'next/link';

export default function OrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState<string | null>(null);
  const { user } = useAuth();
  const [updating, setUpdating] = useState(false);

  const handleCompleteRegistration = async () => {
    if (!user?.email) return;
    try {
      setUpdating(true);
      await updateOrderStatus(id, 'Оформлен', user.email);
      const data = await getOrderById(id);
      setOrder(data);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    async function fetchOrder() {
      try {
        const data = await getOrderById(id);
        setOrder(data);
      } catch (err: any) {
        setError(err.message || 'Ошибка загрузки заказа');
      } finally {
        setLoading(false);
      }
    }
    fetchOrder();
  }, [id]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (order?.status === 'Комплектация' && order.time_start && !order.time_end) {
      const updateTimer = () => {
        const start = order.time_start.toDate ? order.time_start.toDate().getTime() : new Date(order.time_start).getTime();
        const now = Date.now();
        const diff = Math.max(0, now - start);
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setElapsedTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      };
      updateTimer();
      interval = setInterval(updateTimer, 1000);
    } else {
      setElapsedTime(null);
    }
    return () => clearInterval(interval);
  }, [order]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen p-4 bg-slate-50">
        <div className="bg-red-50 border border-red-100 text-red-700 p-4 rounded-xl">
          {error || 'Заказ не найден'}
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Новый': return 'bg-purple-100 text-purple-800';
      case 'Комплектация': return 'bg-blue-100 text-blue-800';
      case 'Ожидает оформления': return 'bg-amber-100 text-amber-800';
      case 'Готов к выдаче': return 'bg-emerald-100 text-emerald-800';
      case 'Оформлен': return 'bg-emerald-100 text-emerald-800';
      case 'Завершен': return 'bg-slate-200 text-slate-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getNextAction = () => {
    if (order.status === 'Новый') {
      const href = order.carrier === 'Самовывоз' ? `/employee/assembly/${id}` : `/employee/add_money/${id}`;
      return (
        <Link href={href} className="block w-full text-center bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-colors shadow-sm">
          Перейти к оплате/сборке
        </Link>
      );
    }
    if (order.status === 'Комплектация' || order.status === 'В работе') {
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
          Продолжить сборку (таймер)
        </Link>
      );
    }
    if (order.status === 'Готов к выдаче') {
      return (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl flex items-center gap-3">
          <Info className="w-6 h-6 text-emerald-600 flex-shrink-0" />
          <div>
            <p className="font-bold">Ожидает выдачи</p>
            <p className="text-sm text-emerald-700">Заказ собран и готов к передаче клиенту.</p>
          </div>
        </div>
      );
    }
    if (order.status === 'Ожидает оформления') {
      return (
        <button
          onClick={handleCompleteRegistration}
          disabled={updating}
          className="block w-full text-center bg-orange-500 text-white py-4 rounded-2xl font-bold hover:bg-orange-600 transition-colors shadow-sm disabled:opacity-50"
        >
          {updating ? 'Оформление...' : 'Оформить'}
        </button>
      );
    }
    if (order.status === 'Оформлен') {
      return (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl flex items-center gap-3">
          <Info className="w-6 h-6 text-emerald-600 flex-shrink-0" />
          <div>
            <p className="font-bold">Оформлен</p>
            <p className="text-sm text-emerald-700">Накладная создана, ожидает выдачи.</p>
          </div>
        </div>
      );
    }
    if (order.status === 'Завершен') {
      return (
        <div className="bg-slate-100 border border-slate-200 text-slate-800 p-4 rounded-2xl flex items-center gap-3">
          <Info className="w-6 h-6 text-slate-600 flex-shrink-0" />
          <div>
            <p className="font-bold">Завершен</p>
            <p className="text-sm text-slate-700">Заказ успешно обработан.</p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10 flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-slate-600" />
        </button>
        <h1 className="text-xl font-bold text-slate-900">Карточка заказа</h1>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-6"
        >
          {/* Header Info */}
          <div className="text-center space-y-2">
            <p className="text-sm text-slate-500 font-medium uppercase tracking-wider">Заказ №</p>
            <h2 className="text-4xl font-black text-slate-900">{order.orderNumber || 'Без номера'}</h2>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
              <div className="flex items-center gap-3 text-slate-700">
                <Truck className="w-5 h-5 text-blue-500" />
                <span className="font-medium">Транспортная компания</span>
              </div>
              <span className="font-bold text-slate-900">{order.carrier}</span>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
              <div className="flex items-center gap-3 text-slate-700">
                <Info className="w-5 h-5 text-purple-500" />
                <span className="font-medium">Статус</span>
              </div>
              <span className={`px-3 py-1 rounded-lg text-sm font-bold uppercase tracking-wider ${getStatusColor(order.status)}`}>
                {order.status}
              </span>
            </div>

            {elapsedTime && (
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-2xl">
                <div className="flex items-center gap-3 text-blue-700">
                  <Clock className="w-5 h-5 text-blue-500" />
                  <span className="font-medium">Время сборки</span>
                </div>
                <span className="font-bold text-blue-900 font-mono text-lg">{elapsedTime}</span>
              </div>
            )}
          </div>

          {/* Places Info */}
          {order.places_data && order.places_data.length > 0 ? (
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-slate-400" />
                Информация о местах
              </h3>
              <div className="space-y-2">
                {order.places_data.map((place: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl text-sm">
                    <span className="font-medium text-slate-700">Место {index + 1}</span>
                    <span className="text-slate-600">
                      {place.d || 0} × {place.w || 0} × {place.h || 0} см{place.weight ? `, ${place.weight} кг` : ''}
                    </span>
                  </div>
                ))}
              </div>

              {order.status === 'Оформлен' && (
                <div className="pt-2 space-y-2">
                  <div className="flex justify-between items-center bg-emerald-50 p-3 rounded-xl">
                    <span className="text-emerald-800 font-medium">Итоговый объем:</span>
                    <span className="text-emerald-900 font-bold">
                      {(() => {
                        const total = order.places_data.reduce((acc: number, p: any) => {
                          const v = (Number(p.d || 0) * Number(p.w || 0) * Number(p.h || 0)) / 1000000;
                          return acc + (isNaN(v) ? 0 : v);
                        }, 0);
                        return isNaN(total) ? "0.0000" : total.toFixed(4);
                      })()} м³
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-emerald-50 p-3 rounded-xl">
                    <span className="text-emerald-800 font-medium">Общий вес:</span>
                    <span className="text-emerald-900 font-bold">
                      {order.places_data.reduce((acc: number, p: any) => acc + (Number(p.weight) || 0), 0).toFixed(2)} кг
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="pt-4 border-t border-slate-100">
              <p className="text-slate-500 text-center italic">Габариты не указаны</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-4">
            {getNextAction()}
          </div>
        </motion.div>
      </main>
    </div>
  );
}
