'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Package, Search, X, Loader2, Calendar, User, Truck, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { RETURN_REASONS } from '@/lib/constants';

interface ReturnHistory {
  id: string;
  orderId: string;
  orderNumber: string;
  action: string;
  reason?: string;
  description?: string;
  carrier?: string;
  createdAt: string;
  createdBy: string;
}

export default function ReturnsHistoryPage() {
  const router = useRouter();
  const { role, loading } = useAuth();
  const [returns, setReturns] = useState<ReturnHistory[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (loading) return;
    if (role !== 'admin') {
      router.push('/');
      return;
    }
    fetchReturnsHistory();
  }, [role, loading, router]); // Добавлен router

  const fetchReturnsHistory = async () => {
    try {
      const q = query(collection(db, 'returns_history'), orderBy('createdAt', 'desc'), limit(100));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReturnHistory));
      setReturns(data);
    } catch (error) {
      console.error('Error fetching returns history:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const filteredReturns = returns.filter(r =>
    r.orderNumber?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'return_requested': return 'Запрошен возврат';
      case 'return_approved': return 'Возврат одобрен';
      case 'return_received': return 'Возврат получен';
      case 'reshipment_started': return 'Начата повторная отправка';
      case 'reshipment_completed': return 'Повторная отправка завершена';
      default: return action;
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'return_requested': return <AlertTriangle className="w-4 h-4" />;
      case 'return_approved': return <CheckCircle2 className="w-4 h-4" />;
      case 'return_received': return <Package className="w-4 h-4" />;
      case 'reshipment_started': return <RefreshCw className="w-4 h-4" />;
      case 'reshipment_completed': return <CheckCircle2 className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'return_requested': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
      case 'return_approved': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'return_received': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
      case 'reshipment_started': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'reshipment_completed': return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300';
      default: return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-4 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-400" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-orange-600" />
              История возвратов
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Отслеживание всех операций с возвратами
            </p>
          </div>
        </div>
        <ThemeToggle />
      </header>

      <main className="max-w-6xl mx-auto p-4">
        {/* Поиск */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Поиск по номеру заказа..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        {filteredReturns.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
            <Package className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 dark:text-slate-500">История возвратов пуста</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredReturns.map(record => (
              <div
                key={record.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-lg ${getActionColor(record.action)}`}>
                        {getActionIcon(record.action)}
                      </div>
                      <h3 className="font-bold text-lg text-slate-900 dark:text-white">
                        Заказ №{record.orderNumber}
                      </h3>
                      <span className={`px-2 py-1 rounded-lg text-xs font-bold ${getActionColor(record.action)}`}>
                        {getActionLabel(record.action)}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-600 dark:text-slate-400">
                          {format(new Date(record.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400" />
                        <span className="text-slate-600 dark:text-slate-400">{record.createdBy}</span>
                      </div>
                      {record.carrier && (
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-600 dark:text-slate-400">{record.carrier}</span>
                        </div>
                      )}
                    </div>
                    
                    {record.reason && (
                      <div className="mt-3 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          <span className="font-medium">Причина:</span> {RETURN_REASONS.find(r => r.value === record.reason)?.label || record.reason}
                        </p>
                        {record.description && (
                          <p className="text-sm text-slate-500 dark:text-slate-500 mt-1">
                            {record.description}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}