'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { motion } from 'motion/react';
import { 
  ArrowLeft, 
  Play, 
  CheckCircle2, 
  Clock, 
  Package, 
  Truck, 
  Hash,
  Loader2,
  Home
} from 'lucide-react';
import Link from 'next/link';
import { showToast } from '@/components/Toast';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

interface OrderData {
  orderNumber?: string;
  carrier: string;
  quantity: number;
  status: string;
  time_start?: any;
  time_end?: any;
}

export default function AssemblyPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [starting, setStarting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!id) return;

    const docRef = doc(db, 'orders', id as string);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as OrderData;
        setOrder(data);
        
        if (data.time_start && !data.time_end) {
          const startTime = data.time_start.toDate().getTime();
          const updateTimer = () => {
            const now = Date.now();
            setElapsedTime(Math.floor((now - startTime) / 1000));
          };
          
          updateTimer();
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = setInterval(updateTimer, 1000);
        } else if (data.time_start && data.time_end) {
          const start = data.time_start.toDate().getTime();
          const end = data.time_end.toDate().getTime();
          setElapsedTime(Math.floor((end - start) / 1000));
          if (timerRef.current) clearInterval(timerRef.current);
        } else {
          setElapsedTime(0);
          if (timerRef.current) clearInterval(timerRef.current);
        }
      } else {
        console.error('Order not found');
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [id]);

  const handleStart = async () => {
    if (!id || !user) return;
    setStarting(true);
    try {
      const docRef = doc(db, 'orders', id as string);
      await updateDoc(docRef, {
        time_start: serverTimestamp(),
        status: 'В работе'
      });
      showToast('Сборка начата', 'success');
    } catch (err) {
      console.error('Error starting assembly:', err);
      showToast('Ошибка при начале сборки', 'error');
    } finally {
      setStarting(false);
    }
  };

  const handleFinish = async () => {
    if (!id || !user || !order) return;
    setFinishing(true);
    try {
      const docRef = doc(db, 'orders', id as string);
      
      if (order.carrier === 'Самовывоз') {
        await updateDoc(docRef, {
          time_end: serverTimestamp(),
          status: 'Готов к выдаче'
        });
        showToast('Сборка завершена! Заказ готов к выдаче', 'success');
        // После завершения сборки для Самовывоза переходим на главную
        router.push('/');
      } else {
        await updateDoc(docRef, {
          time_end: serverTimestamp(),
          status: 'Комплектация'
        });
        showToast('Сборка завершена! Переход к вводу габаритов', 'success');
        router.push(`/employee/add_dimensions/${id}`);
      }
    } catch (err) {
      console.error('Error finishing assembly:', err);
      showToast('Ошибка при завершении сборки', 'error');
    } finally {
      setFinishing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [
      h > 0 ? h.toString().padStart(2, '0') : null,
      m.toString().padStart(2, '0'),
      s.toString().padStart(2, '0')
    ].filter(Boolean).join(':');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen p-4 bg-slate-50 dark:bg-slate-950">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl text-center border border-slate-200 dark:border-slate-800">
          <p className="text-slate-600 dark:text-slate-400">Заказ не найден</p>
          <Link href="/" className="mt-4 text-blue-600 dark:text-blue-400 inline-block">Вернуться на главную</Link>
        </div>
      </div>
    );
  }

  const isStarted = !!order.time_start;
  const isFinished = !!order.time_end;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 transition-colors duration-200">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-4 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-400" />
          </button>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Сборка заказа</h1>
        </div>
        <ThemeToggle />
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-6">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-4"
        >
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
                <Hash className="w-4 h-4" />
                <span>Номер заказа</span>
              </div>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{order.orderNumber || 'Без номера'}</p>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-bold ${
              order.status === 'Собрано' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
              order.status === 'В работе' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
              'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
            }`}>
              {order.status}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
                <Truck className="w-4 h-4" />
                <span>ТК</span>
              </div>
              <p className="font-semibold text-slate-900 dark:text-white">{order.carrier}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
                <Package className="w-4 h-4" />
                <span>Мест</span>
              </div>
              <p className="font-semibold text-slate-900 dark:text-white">{order.quantity}</p>
            </div>
          </div>
        </motion.div>

        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
            <Clock className="w-5 h-5" />
            <span className="text-sm font-medium uppercase tracking-wider">Время сборки</span>
          </div>
          <div className="text-6xl font-mono font-bold text-slate-900 dark:text-white tabular-nums">
            {formatTime(elapsedTime)}
          </div>
        </div>

        <div className="space-y-4">
          {!isStarted ? (
            <button
              onClick={handleStart}
              disabled={starting}
              className="w-full h-20 bg-blue-600 hover:bg-blue-700 text-white rounded-3xl font-bold text-xl shadow-lg shadow-blue-200 dark:shadow-blue-950/30 transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {starting ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Play className="w-6 h-6 fill-current" />
              )}
              {starting ? 'Запуск...' : 'Начать сборку'}
            </button>
          ) : !isFinished ? (
            <button
              onClick={handleFinish}
              disabled={finishing}
              className="w-full h-20 bg-emerald-600 hover:bg-emerald-700 text-white rounded-3xl font-bold text-xl shadow-lg shadow-emerald-200 dark:shadow-emerald-950/30 transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {finishing ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <CheckCircle2 className="w-6 h-6" />
              )}
              {finishing ? 'Завершение...' : 'Завершить сборку'}
            </button>
          ) : (
            <button
              onClick={() => router.push('/')}
              className="w-full h-20 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-3xl font-bold text-xl transition-all flex items-center justify-center gap-3"
            >
              <Home className="w-6 h-6" />
              На главную
            </button>
          )}
        </div>
      </main>
    </div>
  );
}